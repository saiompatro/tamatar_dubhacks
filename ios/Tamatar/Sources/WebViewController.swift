import SwiftUI
import UIKit
import WebKit

/// Full-screen web view around the Next.js app. The page does the drawing with Pointer
/// Events; this shell adds what a browser tab can't: Pencil double-tap/squeeze, hover
/// height, barrel roll and haptics (PencilBridge), PDF downloads to the share sheet,
/// and a screen for picking the server.
final class WebViewController: UIViewController {
    private var webView: WKWebView!
    private var pencil: PencilBridge!
    private var serverSheet: UIViewController?
    private var downloads: [WKDownload: URL] = [:]
    private var loadedURL: URL?

    // Paper, not chrome: no status bar, a dimmed home indicator, and edge swipes that need
    // a second swipe, so a stroke that starts at the screen edge stays a stroke.
    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }
    // The system three-finger undo/copy/paste gestures collide with the canvas' three-finger tap.
    override var editingInteractionConfiguration: UIEditingInteractionConfiguration { .none }

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default() // keeps localStorage and the Supabase session
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        // Mobile mode honours the page's viewport tag (no pinch zoom) and makes jsPDF use a
        // download link, which arrives here as a WKDownload.
        config.defaultWebpagePreferences.preferredContentMode = .mobile
        config.applicationNameForUserAgent = "tamatar-ipad/1.0"

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false // an edge swipe would eat strokes
        webView.allowsLinkPreview = false
        webView.isOpaque = false
        webView.backgroundColor = .white
        webView.underPageBackgroundColor = .white
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
        #if DEBUG
        webView.isInspectable = true // Safari → Develop → <iPad> to debug the page
        #endif

        pencil = PencilBridge(webView: webView)

        let root = UIView()
        root.backgroundColor = .white
        root.addSubview(webView)
        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: root.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: root.safeAreaLayoutGuide.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: root.safeAreaLayoutGuide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: root.safeAreaLayoutGuide.trailingAnchor),
        ])
        view = root

        // Three fingers held for a second opens the server sheet (a quick three-finger tap is redo).
        let hold = UILongPressGestureRecognizer(target: self, action: #selector(heldThreeFingers(_:)))
        hold.numberOfTouchesRequired = 3
        hold.minimumPressDuration = 1
        hold.cancelsTouchesInView = false
        hold.delegate = self
        webView.addGestureRecognizer(hold)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        load(ServerConfig.current)
        NotificationCenter.default.addObserver(self, selector: #selector(becameActive), name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        setNeedsUpdateOfScreenEdgesDeferringSystemGestures()
        setNeedsUpdateOfHomeIndicatorAutoHidden()
    }

    // MARK: Loading

    private func load(_ url: URL) {
        loadedURL = url
        webView.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 15))
    }

    @objc private func becameActive() {
        pencil.refreshPreferences() // the user may have changed Pencil settings meanwhile
        if webView.url == nil, let url = loadedURL { load(url) }
    }

    @objc private func reloadPage() {
        if webView.url == nil { load(ServerConfig.current) } else { webView.reload() }
    }

    @objc private func heldThreeFingers(_ g: UILongPressGestureRecognizer) {
        if g.state == .began { showServerSheet(error: nil) }
    }

    @objc private func openServerSheet() { showServerSheet(error: nil) }

    private func showServerSheet(error: String?) {
        guard serverSheet == nil, presentedViewController == nil else { return }
        let screen = ServerView(
            current: ServerConfig.current,
            usingOverride: ServerConfig.override != nil,
            error: error,
            connect: { [weak self] url in
                ServerConfig.override = url
                self?.dismissServerSheet()
                self?.load(ServerConfig.current)
            },
            dismiss: { [weak self] in
                self?.dismissServerSheet()
                if error != nil { self?.load(ServerConfig.current) } // "Try again"
            }
        )
        let host = UIHostingController(rootView: screen)
        host.modalPresentationStyle = error == nil ? .formSheet : .fullScreen
        host.isModalInPresentation = error != nil
        serverSheet = host
        present(host, animated: true)
    }

    private func dismissServerSheet() {
        serverSheet?.dismiss(animated: true)
        serverSheet = nil
    }

    // MARK: Hardware keyboard

    override var keyCommands: [UIKeyCommand]? {
        [
            UIKeyCommand(title: "Reload", action: #selector(reloadPage), input: "r", modifierFlags: .command),
            UIKeyCommand(title: "Server…", action: #selector(openServerSheet), input: ",", modifierFlags: .command),
        ]
    }

    // MARK: Downloads (jsPDF "Export PDF")

    private func share(_ file: URL) {
        let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        if let pop = sheet.popoverPresentationController {
            pop.sourceView = view
            pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            pop.permittedArrowDirections = []
        }
        present(sheet, animated: true)
    }

    private func alert(_ title: String, _ message: String?, actions: [UIAlertAction]) {
        let a = UIAlertController(title: title, message: message, preferredStyle: .alert)
        actions.forEach(a.addAction)
        present(a, animated: true)
    }
}

// MARK: - WKNavigationDelegate

extension WebViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
        if action.shouldPerformDownload { return decisionHandler(.download) }
        guard let url = action.request.url, let scheme = url.scheme?.lowercased() else { return decisionHandler(.allow) }

        if ["mailto", "tel", "sms", "facetime"].contains(scheme) {
            UIApplication.shared.open(url)
            return decisionHandler(.cancel)
        }
        // Links to other sites open in Safari so the app never gets stranded off the server.
        let external = (scheme == "http" || scheme == "https") && url.host != ServerConfig.current.host
        if external, action.navigationType == .linkActivated || action.targetFrame == nil {
            UIApplication.shared.open(url)
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping @MainActor @Sendable (WKNavigationResponsePolicy) -> Void) {
        let disposition = (response.response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Disposition") ?? ""
        let attachment = disposition.lowercased().hasPrefix("attachment")
        decisionHandler(attachment || !response.canShowMIMEType ? .download : .allow)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        failed(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        failed(error)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if serverSheet?.modalPresentationStyle == .fullScreen { dismissServerSheet() }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    private func failed(_ error: Error) {
        let e = error as NSError
        // Cancelled loads and "frame load interrupted" (a download took over) are not failures.
        if e.domain == NSURLErrorDomain && e.code == NSURLErrorCancelled { return }
        if e.domain == "WebKitErrorDomain" && e.code == 102 { return }
        showServerSheet(error: e.localizedDescription)
    }
}

// MARK: - WKDownloadDelegate

extension WebViewController: WKDownloadDelegate {
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String) async -> URL? {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("Downloads", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let file = dir.appendingPathComponent(suggestedFilename.isEmpty ? "tamatar.pdf" : suggestedFilename)
        try? FileManager.default.removeItem(at: file)
        downloads[download] = file
        return file
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let file = downloads.removeValue(forKey: download) else { return }
        share(file)
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloads.removeValue(forKey: download)
        alert("Download failed", error.localizedDescription, actions: [UIAlertAction(title: "OK", style: .default)])
    }
}

// MARK: - WKUIDelegate (alert / confirm / prompt / window.open)

extension WebViewController: WKUIDelegate {
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        // target=_blank on the same server: stay in this view. Other sites were sent to Safari above.
        if let url = action.request.url, url.host == ServerConfig.current.host { webView.load(action.request) }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable () -> Void) {
        alert(message, nil, actions: [UIAlertAction(title: "OK", style: .default) { _ in completionHandler() }])
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable (Bool) -> Void) {
        alert(message, nil, actions: [
            UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) },
            UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) },
        ])
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable (String?) -> Void) {
        let a = UIAlertController(title: prompt, message: nil, preferredStyle: .alert)
        a.addTextField { $0.text = defaultText }
        a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
        present(a, animated: true)
    }
}

extension WebViewController: UIGestureRecognizerDelegate {
    func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
}
