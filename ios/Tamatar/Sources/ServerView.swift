import SwiftUI

/// Shown when the server can't be reached, or on demand (three-finger hold, ⌘,).
struct ServerView: View {
    let current: URL
    let usingOverride: Bool
    let error: String?
    /// nil = go back to automatic detection.
    let connect: (URL?) -> Void
    let dismiss: () -> Void

    @State private var text = ""
    @State private var invalid = false

    private let tomato = Color(red: 0.76, green: 0.22, blue: 0.18)

    var body: some View {
        NavigationStack {
            Form {
                if let error {
                    Section {
                        Label {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Can't reach the tamatar server").font(.headline)
                                Text(current.absoluteString).font(.callout.monospaced())
                                Text(error).font(.footnote).foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "wifi.exclamationmark").foregroundStyle(tomato)
                        }
                    }
                }

                Section {
                    TextField("http://my-mac.local:3000", text: $text)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.go)
                        .onSubmit(save)
                    if invalid {
                        Text("Enter an http:// or https:// address.").font(.footnote).foregroundStyle(tomato)
                    }
                    Button("Connect", action: save).bold()
                    if usingOverride {
                        Button("Use automatic address") { connect(nil) }
                    }
                } header: {
                    Text("Server address")
                } footer: {
                    Text("Currently \(current.absoluteString)\(usingOverride ? " (set here)" : " (automatic)").")
                }

                Section("Running it from your Mac") {
                    step(1, "On the Mac, in the project folder: npm run dev:ipad")
                    step(2, "Keep the iPad and the Mac on the same Wi‑Fi network. The USB‑C cable installs the app; it doesn't carry the page.")
                    step(3, "If asked, allow tamatar to find devices on your local network (Settings → Privacy & Security → Local Network).")
                    step(4, "If macOS asks whether node may accept incoming connections, click Allow.")
                }
            }
            .navigationTitle(error == nil ? "Server" : "tamatar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(error == nil ? "Close" : "Try again", action: dismiss)
                }
            }
        }
        .tint(tomato)
        .onAppear { text = current.absoluteString }
    }

    private func save() {
        guard let url = ServerConfig.parse(text) else { invalid = true; return }
        invalid = false
        connect(url)
    }

    private func step(_ n: Int, _ s: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("\(n)").font(.callout.bold()).foregroundStyle(tomato)
            Text(s).font(.callout)
        }
    }
}
