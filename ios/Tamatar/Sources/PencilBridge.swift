import UIKit
import UIKit.UIGestureRecognizerSubclass
import WebKit

/// The Apple Pencil features a web page can't see on its own, sent to the page as
/// `tamatar:pencil` CustomEvents (see lib/native.ts):
///
/// - double-tap (Pencil 2, Pro) and squeeze (Pro), with the action the user picked in
///   Settings → Apple Pencil, plus where the tip was hovering at the time
/// - hover height (Pencil 2 / USB-C / Pro on iPads with hover) and barrel roll (Pro)
/// - the "Only Draw with Apple Pencil" and hover-preview settings
///
/// Pressure, tilt, hover position, coalesced and predicted samples already reach the page
/// through Pointer Events. The page asks for Pencil Pro haptics with
/// `webkit.messageHandlers.tamatar.postMessage({type: "haptic", ...})`.
@MainActor
final class PencilBridge: NSObject {
    private weak var webView: WKWebView?
    private let pencil = UIPencilInteraction()
    private var canvasFeedback: AnyObject? // UICanvasFeedbackGenerator, iOS 17.5+
    private var lastPose: (roll: Double, z: Double, touching: Bool)?

    init(webView: WKWebView) {
        self.webView = webView
        super.init()

        pencil.delegate = self
        webView.addInteraction(pencil)

        let hover = UIHoverGestureRecognizer(target: self, action: #selector(hovered(_:)))
        hover.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.pencil.rawValue)]
        hover.delegate = self
        webView.addGestureRecognizer(hover)

        let touches = PencilTouchObserver { [weak self] touch in self?.touched(touch) }
        touches.delegate = self
        webView.addGestureRecognizer(touches)

        if #available(iOS 17.5, *) {
            canvasFeedback = UICanvasFeedbackGenerator(view: webView)
        }

        let content = webView.configuration.userContentController
        content.add(WeakMessageHandler(self), name: "tamatar")
        installPreferencesScript()
    }

    // MARK: Preferences

    /// Re-sent whenever the app becomes active, since the user may have changed them in Settings.
    func refreshPreferences() {
        installPreferencesScript()
        send(["type": "prefs", "prefs": preferences()])
    }

    private func installPreferencesScript() {
        guard let content = webView?.configuration.userContentController,
              let json = json(preferences()) else { return }
        let source = "window.__tamatarNative = { platform: 'ipad', prefs: \(json) };"
        content.removeAllUserScripts()
        content.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        webView?.evaluateJavaScript(source)
    }

    private func preferences() -> [String: Any] {
        var hoverPreview = true
        var squeeze = "showContextualPalette"
        if #available(iOS 17.5, *) {
            hoverPreview = UIPencilInteraction.prefersHoverToolPreview
            squeeze = name(UIPencilInteraction.preferredSqueezeAction)
        }
        return [
            "prefersPencilOnlyDrawing": UIPencilInteraction.prefersPencilOnlyDrawing,
            "prefersHoverToolPreview": hoverPreview,
            "tapAction": name(UIPencilInteraction.preferredTapAction),
            "squeezeAction": squeeze,
        ]
    }

    private func name(_ action: UIPencilPreferredAction) -> String {
        if #available(iOS 17.5, *) {
            switch action {
            case .showContextualPalette: return "showContextualPalette"
            case .runSystemShortcut: return "runSystemShortcut"
            default: break
            }
        }
        switch action {
        case .switchEraser: return "switchEraser"
        case .switchPrevious: return "switchPrevious"
        case .showColorPalette: return "showColorPalette"
        case .showInkAttributes: return "showInkAttributes"
        default: return "ignore"
        }
    }

    // MARK: Hover and barrel roll

    @objc private func hovered(_ g: UIHoverGestureRecognizer) {
        switch g.state {
        case .began, .changed:
            var roll: Double?
            if #available(iOS 17.5, *) { roll = Double(g.rollAngle) }
            pose(roll: roll, z: Double(g.zOffset), touching: false)
        default:
            lastPose = nil
            send(["type": "pose", "touching": false])
        }
    }

    private func touched(_ touch: UITouch) {
        guard #available(iOS 17.5, *) else { return }
        pose(roll: Double(touch.rollAngle), z: 0, touching: touch.phase != .ended && touch.phase != .cancelled)
    }

    /// Only forwards real changes, so a resting Pencil doesn't flood the page with events.
    private func pose(roll: Double?, z: Double, touching: Bool) {
        if let last = lastPose, last.touching == touching, abs(last.roll - (roll ?? 0)) < 0.01, abs(last.z - z) < 0.02 { return }
        lastPose = (roll ?? 0, z, touching)
        var detail: [String: Any] = ["type": "pose", "z": z, "touching": touching]
        if let roll { detail["roll"] = roll }
        send(detail)
    }

    // MARK: Haptics (Pencil Pro)

    fileprivate func receive(_ body: Any) {
        guard let msg = body as? [String: Any], msg["type"] as? String == "haptic" else { return }
        let point = CGPoint(x: msg["x"] as? Double ?? 0, y: msg["y"] as? Double ?? 0)
        guard #available(iOS 17.5, *), let feedback = canvasFeedback as? UICanvasFeedbackGenerator else { return }
        if msg["kind"] as? String == "pathCompleted" {
            feedback.pathCompleted(at: point)
        } else {
            feedback.alignmentOccurred(at: point)
        }
    }

    // MARK: Sending

    private func send(_ detail: [String: Any]) {
        guard let webView, let json = json(detail) else { return }
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('tamatar:pencil', { detail: \(json) }))")
    }

    private func json(_ object: Any) -> String? {
        guard let data = try? JSONSerialization.data(withJSONObject: object) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// Hover location in page (CSS) pixels: the web view isn't zoomed, so its points are CSS px.
    private func location(_ point: CGPoint?) -> [String: Any] {
        guard let point else { return [:] }
        return ["x": Double(point.x), "y": Double(point.y)]
    }
}

// MARK: - Double-tap and squeeze

extension PencilBridge: UIPencilInteractionDelegate {
    @available(iOS 17.5, *)
    func pencilInteraction(_ interaction: UIPencilInteraction, didReceiveTap tap: UIPencilInteraction.Tap) {
        var detail: [String: Any] = ["type": "tap", "action": name(UIPencilInteraction.preferredTapAction)]
        detail.merge(location(tap.hoverPose?.location)) { $1 }
        send(detail)
    }

    @available(iOS 17.5, *)
    func pencilInteraction(_ interaction: UIPencilInteraction, didReceiveSqueeze squeeze: UIPencilInteraction.Squeeze) {
        let phase: String
        switch squeeze.phase {
        case .began: phase = "began"
        case .changed: phase = "changed"
        case .ended: phase = "ended"
        default: phase = "cancelled"
        }
        var detail: [String: Any] = ["type": "squeeze", "phase": phase, "action": name(UIPencilInteraction.preferredSqueezeAction)]
        detail.merge(location(squeeze.hoverPose?.location)) { $1 }
        send(detail)
    }

    /// iPadOS 17.0–17.4 (no hover location there). Newer systems call the method above instead.
    func pencilInteractionDidTap(_ interaction: UIPencilInteraction) {
        if #available(iOS 17.5, *) { return } // never toggle twice
        send(["type": "tap", "action": name(UIPencilInteraction.preferredTapAction)])
    }
}

extension PencilBridge: UIGestureRecognizerDelegate {
    // Never compete with WebKit's own recognizers: the page must still get every pointer event.
    func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
}

/// Watches Pencil touches (for barrel roll while drawing) without ever claiming them.
private final class PencilTouchObserver: UIGestureRecognizer {
    private let onTouch: (UITouch) -> Void

    init(onTouch: @escaping (UITouch) -> Void) {
        self.onTouch = onTouch
        super.init(target: nil, action: nil)
        cancelsTouchesInView = false
        delaysTouchesBegan = false
        delaysTouchesEnded = false
        allowedTouchTypes = [NSNumber(value: UITouch.TouchType.pencil.rawValue)]
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) { touches.forEach(onTouch) }
    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) { touches.forEach(onTouch) }
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
        touches.forEach(onTouch)
        state = .failed
    }
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
        touches.forEach(onTouch)
        state = .failed
    }
    override func canPrevent(_ preventedGestureRecognizer: UIGestureRecognizer) -> Bool { false }
    override func canBePrevented(by preventingGestureRecognizer: UIGestureRecognizer) -> Bool { false }
}

/// WKUserContentController holds its handlers strongly; this breaks the cycle.
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    private weak var target: PencilBridge?
    init(_ target: PencilBridge) { self.target = target }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.receive(message.body)
    }
}
