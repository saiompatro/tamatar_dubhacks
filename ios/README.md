# tamatar for iPad

A native iPad app around the Next.js site. The page still does all the drawing and
checking; the app adds the Apple Pencil features a browser tab can't reach and runs
full screen like a notebook.

```
iPad app (ios/)  ──WKWebView──▶  Next.js server (npm run dev:ipad on your Mac, or a deployed URL)
   │                                   │
   └─ Pencil double-tap, squeeze,      └─ /api/check, /api/extract (keys stay on the server)
      hover height, barrel roll,
      haptics → "tamatar:pencil" events (lib/native.ts)
```

## Apple Pencil support

| Feature | Pencil | How it works here |
| --- | --- | --- |
| Pressure | all | Pointer Events → stroke width (perfect-freehand) |
| Tilt shading | all | Pencil tool widens when the Pencil is laid down |
| Palm rejection | all | Fingers and palms never ink |
| Low latency | all | Coalesced samples for every point, predicted samples drawn ahead of the tip |
| Hover preview | Pencil 2, USB-C, Pro on hover iPads | Nib (or eraser ring) shown under the tip, fainter as it lifts. Follows Settings → Apple Pencil → Show Hover Preview |
| Double-tap | Pencil 2, Pro | Does what you picked in Settings → Apple Pencil: switch to eraser, switch to previous tool, colour palette, or ink palette |
| Squeeze | Pro | Opens a tool, colour and width palette at the Pencil tip (or whatever squeeze is set to in Settings) |
| Barrel roll | Pro | Rolling the Pencil turns the flat side of the pencil tool's lead; the hover preview shows the nib angle |
| Haptics | Pro | A tick when a ruler line passes 0°, 45° or 90°, and when you circle your answer |
| Finger drawing | none paired | Turn off Settings → Apple Pencil → "Only Draw with Apple Pencil" to draw with a finger (also how the Simulator draws) |
| Scribble | all | Handwriting turns into text in the app's text fields |
| Multi-finger taps | — | Two-finger tap = undo, three-finger tap = redo |

The system's three-finger editing gestures and the back-swipe are turned off so they don't steal strokes, and screen-edge swipes need a second swipe while you draw.

## Running it on your iPad (free Apple ID, no paid developer account)

You need a Mac with **Xcode 16 or newer** (free in the Mac App Store) and an iPad on **iPadOS 17 or newer**.

### 1. Start the server on your Mac

```bash
npm install
npm run dev:ipad
```

`dev:ipad` listens on your network as well as localhost, so the iPad can reach it. If macOS asks whether `node` may accept incoming connections, click **Allow**.

### 2. Sign in to Xcode with your Apple ID

Xcode → Settings → Accounts → **+** → Apple ID. This creates a free "Personal Team".

### 3. Point the project at your team

```bash
cp ios/Config/Local.xcconfig.example ios/Config/Local.xcconfig
```

Edit `ios/Config/Local.xcconfig` and set `DEVELOPMENT_TEAM` to your Personal Team ID (Xcode → Settings → Accounts → select your Apple ID → the 10-character ID next to "Personal Team"). This file is gitignored, so every teammate can use their own Apple ID. You can also pick the team in Xcode under Signing & Capabilities, but that edits the shared project file.

### 4. Connect the iPad and run

1. Plug the iPad into the Mac with the USB‑C cable, unlock it, and tap **Trust**.
2. Open `ios/Tamatar.xcodeproj` and choose your iPad as the run destination at the top of the window.
3. On the iPad: Settings → Privacy & Security → **Developer Mode** → on (the iPad restarts). The option shows up after the iPad has been connected to Xcode once.
4. Press **Run** (⌘R) in Xcode.
5. The first time, the iPad blocks the app: Settings → General → **VPN & Device Management** → your Apple ID → **Trust**. Then run again.
6. When the app asks to find devices on your local network, tap **Allow**.

The cable installs and debugs the app. **The page itself loads over Wi‑Fi**, so keep the iPad and the Mac on the same network. When building for a device, Xcode writes your Mac's Bonjour name (`http://<your-mac>.local:3000`) into the app. The Simulator uses `http://localhost:3000`.

With a free Apple ID the app stops opening after 7 days. Press Run in Xcode again to reinstall it.

### Changing the server

- **In the app:** hold three fingers on the screen for a second (or press ⌘, on a hardware keyboard) to open the server sheet. This sheet also opens by itself when the server can't be reached.
- **At build time:** set `TAMATAR_SERVER_URL` in `Local.xcconfig`, for example a Vercel deployment. Write `//` as `/$()/` there, because `//` starts a comment in xcconfig files.

## Debugging the page

In Debug builds the web view can be inspected: on the Mac, Safari → Settings → Advanced → "Show features for web developers", then Develop → *your iPad* → tamatar.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "Can't reach the tamatar server" | Is `npm run dev:ipad` running? Same Wi‑Fi? Local Network allowed for tamatar in Settings → Privacy & Security? Try the Mac's IP address in the server sheet (System Settings → Wi‑Fi → Details on the Mac). |
| "Failed to register bundle identifier" | Someone else's Personal Team has that ID. Set `TAMATAR_BUNDLE_ID` in `Local.xcconfig` to something unique. |
| "Untrusted Developer" | Settings → General → VPN & Device Management → Trust. |
| Developer Mode isn't in Settings | Connect the iPad to Xcode once with the cable, then look again. |
| App stopped opening after a week | Free provisioning lasts 7 days. Run it from Xcode again. |

## Layout

```
ios/
  Tamatar.xcodeproj         Xcode 16 project; Tamatar/Sources is a synced folder, so new files are picked up automatically
  Config/Base.xcconfig      shared settings (bundle ID, server, port)
  Config/Local.xcconfig     your team ID and overrides (gitignored)
  Tamatar/Info.plist
  Tamatar/Sources/
    WebViewController.swift full-screen web view, downloads (PDF export → share sheet), errors
    PencilBridge.swift      double-tap, squeeze, hover, roll, haptics ↔ the page
    ServerConfig.swift      which server URL to load
    ServerView.swift        the server sheet
```

The web half of the bridge is `lib/native.ts`. It does nothing in a normal browser.
