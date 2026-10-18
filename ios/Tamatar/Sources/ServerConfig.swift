import Foundation

/// Where the Next.js app is served from. Precedence: the in-app server sheet, then
/// TAMATAR_SERVER_URL from Config/Local.xcconfig, then auto-detection.
enum ServerConfig {
    private static let overrideKey = "serverURLOverride"

    static var current: URL { override ?? configured ?? detected }

    /// Saved from the in-app server sheet; nil means "automatic".
    static var override: URL? {
        get { UserDefaults.standard.string(forKey: overrideKey).flatMap(parse) }
        set { UserDefaults.standard.set(newValue?.absoluteString, forKey: overrideKey) }
    }

    static var configured: URL? { info("TamatarServerURL").flatMap(parse) }

    /// The Simulator shares the Mac's network, so localhost works. A real iPad reaches the
    /// Mac by its Bonjour name, which the "Detect dev server" build phase writes into Info.plist.
    static var detected: URL {
        let port = info("TamatarDevPort") ?? "3000"
        #if targetEnvironment(simulator)
        return URL(string: "http://localhost:\(port)")!
        #else
        return info("TamatarDevServerURL").flatMap(parse) ?? URL(string: "http://localhost:\(port)")!
        #endif
    }

    /// Accepts "192.168.1.20:3000" as well as full http(s) URLs.
    static func parse(_ text: String) -> URL? {
        var s = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !s.isEmpty else { return nil }
        if !s.contains("://") { s = "http://" + s }
        guard let url = URL(string: s),
              let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https",
              url.host != nil else { return nil }
        return url
    }

    private static func info(_ key: String) -> String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String, !value.isEmpty else { return nil }
        return value
    }
}
