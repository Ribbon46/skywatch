# Building SkyWatch as a native app

Three ways to use SkyWatch on Windows / macOS / Linux, ranked from easiest to most polished.

## 1. Double-click `launch.bat` (Windows) or `launch.sh` (macOS/Linux) — no install

Opens the app in Chrome / Edge / Brave in **chromeless app mode** — no URL bar, no tabs, looks like a real native window. Requires Chrome, Edge, or Brave installed (you almost certainly have one). No npm, no build, no Node.

```bat
:: Windows
launch.bat
```

```bash
# macOS / Linux
chmod +x launch.sh
./launch.sh
```

Pin the launcher to your taskbar / dock for one-click access.

## 2. Build a proper Windows installer (.exe) with Electron

Produces a real installer `.exe` plus a portable `.exe` you can run without installing. About 80 MB each because Electron bundles Chromium.

Prerequisites: [Node.js 18+](https://nodejs.org/) installed.

```bash
# from the SkyWatch folder
npm install

# run in dev mode (opens DevTools because the bundle is unsigned/dev)
npm start

# build distributables for your current OS
npm run dist

# or target a specific OS (build from that OS for best results)
npm run dist:win     # Windows -> NSIS installer + portable .exe in dist/
npm run dist:mac     # macOS  -> DMG in dist/
npm run dist:linux   # Linux  -> AppImage + .deb in dist/
```

Output for the Windows build (`npm run dist:win`):

| File | Purpose |
|------|---------|
| `dist/SkyWatch Setup 1.0.0.exe` | NSIS installer — adds Start menu + desktop shortcut + uninstaller |
| `dist/SkyWatch 1.0.0.exe` | Portable single-file `.exe` — no install, just double-click |
| `dist/SkyWatch Setup 1.0.0.exe.blockmap` | Differential-update metadata (only needed if you publish updates) |
| `dist/win-unpacked/` | Unpacked app tree — handy for debugging the packaged build |

Both installers are **unsigned** by default. Windows SmartScreen will show a "Windows protected your PC" warning on first launch — click **More info → Run anyway**. To eliminate the warning, you need an EV code-signing certificate (~$200/yr); see the [electron-builder code-signing docs](https://www.electron.build/code-signing) and add a `win.certificateFile` config block once you have one.

First `npm run dist:win` takes ~2 minutes because electron-builder downloads the Electron Windows runtime (~115 MB) plus NSIS / winCodeSign helpers. Subsequent builds are ~20 seconds.

## 3. Install as a PWA on Android (Galaxy S25+ etc.)

1. Host the folder somewhere with HTTPS — GitHub Pages, Netlify, or Cloudflare Pages all work and are free.
2. Open the URL in Chrome on your phone.
3. Three-dot menu → **Add to Home screen** → **Install**.
4. The app installs with its own icon, opens fullscreen, runs offline after first load.

The Chrome install card shows the three screenshots in `screenshots/` (Tonight / Sky / Targets). Regenerate them after any UI change:

```bash
npm run screenshots
```

For a real Play Store-ready APK / AAB, paste the hosted URL into [pwabuilder.com](https://www.pwabuilder.com) and download what it produces, **or** use Google's official Bubblewrap CLI for an offline build:

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://YOUR_HOST/manifest.webmanifest
# prompts for package name (use io.skywatch.app), signing key, splash colour, etc.
bubblewrap build
# outputs app-release-signed.apk + app-release-bundle.aab in this folder
```

Sideload to a phone with `adb install app-release-signed.apk`, or transfer + tap-install with "unknown sources" allowed.

To remove the small Chrome URL hint bar at the top of the TWA, deploy `.well-known/assetlinks.json` (Bubblewrap prints the exact JSON) and verify your host serves it.

## Troubleshooting

**The HTML page is blank when I double-click `index.html`.**
Chrome/Edge block `fetch()` on `file://` URLs for security. SkyWatch works around this by inlining catalog data — but the **first** time you open the file, the service worker can't register from `file://`, and some features (geolocation, refresh) may be quirky. Use `launch.bat` / `launch.sh` to get a chromeless window with proper file-access flags, or install via Electron for the best experience.

**Geolocation isn't working.**
Browsers require HTTPS or `localhost` for geolocation. `file://` works in some browsers but is unreliable. The Electron build registers a `setPermissionRequestHandler` that auto-grants geolocation, so "Use my location" works without a prompt. On the web, host on GitHub Pages or similar.

**The forecast won't load.**
Check that you have internet access — Open-Meteo is the only external dependency. The first load needs network; subsequent loads use the service-worker cache (PWA / hosted build) or the in-memory cache (Electron `file://` mode).

**`npm install` fails on Windows with native-module errors.**
electron-builder sometimes needs Visual Studio Build Tools. The cleanest fix is to install Visual Studio Build Tools 2022 with the **"Desktop development with C++"** workload from the [VS Build Tools downloads page](https://visualstudio.microsoft.com/downloads/?q=build+tools). The legacy `npm install --global windows-build-tools` is deprecated and only works with Node ≤16.

**electron-builder reports "Cannot find icon file".**
Ensure `icon-512.png` exists in the project root and is at least 256×256. It ships at 512×512.

**`npm audit` warns about high-severity vulnerabilities.**
Most are in transitive dev-only dependencies of `electron-builder`. Running `npm audit fix --force` will pin you to an older electron-builder major and likely break the build. Leave them — they don't affect the runtime app.

**DevTools logs `Autofill.enable wasn't found` on dev launch.**
Benign — Chromium's autofill protocol method isn't exposed by Electron's embedded DevTools front-end. Safe to ignore.
