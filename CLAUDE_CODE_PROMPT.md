# Prompt for Claude Code — finish SkyWatch (Windows .exe + polished APK path)

Copy everything between the `---` lines below into Claude Code at the root of this project (`C:\Users\maste\Desktop\astrophoto-bucharest`).

---

You are continuing work on **SkyWatch**, an open-source astrophotography planning app at `C:\Users\maste\Desktop\astrophoto-bucharest`. The PWA shell and all JS modules are already built, tested, and documented (see `README.md`, `BUILD.md`, `CONTRIBUTING.md`). Your job has two parts:

## Part A — Build a real Windows `.exe` via Electron

The `package.json` and `electron/main.js` are already configured for `electron-builder`. Execute the build, verify it works, fix anything that breaks.

### Steps

1. **Verify prerequisites.** Run `node --version` and `npm --version`. Need Node ≥18. If not installed, instruct the user to install from https://nodejs.org/ and stop.

2. **Install dependencies.** Run `npm install` in the project root. This pulls Electron ~33 and electron-builder ~25 (~400 MB on disk).
   - If `electron-builder` complains about native modules, install Visual Studio Build Tools or run `npm install --global windows-build-tools` (older Node) or just install Visual Studio Build Tools 2022 with "Desktop development with C++" workload.
   - On first run electron-builder may download Windows code-signing tooling — that's normal.

3. **Smoke-test the Electron dev shell.** Run `npm start`. Window should open showing SkyWatch. Verify:
   - Header reads "SkyWatch" with a status dot
   - Bottom nav shows all 7 tabs: Tonight, Sky, Targets, Gear, Sites, Events, Log
   - "Tonight" tab loads data (cloud forecast for the default Bucharest site — internet required first time)
   - DevTools opens automatically because `isDev = !app.isPackaged`
   - No console errors of severity ≥ warning

   Close the window when done.

4. **Build production installers.** Run `npm run dist:win`. Expect outputs in `dist/`:
   - `SkyWatch Setup 1.0.0.exe` — NSIS installer (~90 MB)
   - `SkyWatch 1.0.0.exe` — portable single-file `.exe` (~95 MB)
   - `latest.yml`, `*.blockmap` — auto-updater metadata

5. **Test the installer.** Double-click `SkyWatch Setup 1.0.0.exe`, walk through install (it will warn about an unsigned publisher — that's expected without a code-signing certificate; click "More info" → "Run anyway"). Verify Start menu entry created, app launches, behaves like the dev build. Uninstall via Settings to clean up.

6. **Test the portable.** Double-click `SkyWatch 1.0.0.exe` — should launch immediately with no install. Confirm the same UI loads.

7. **If either installer fails to build,** read the electron-builder error carefully. The most common Windows issues:
   - "Cannot find module '@electron/rebuild'" → `npm install --save-dev @electron/rebuild`
   - "Application entry file does not exist" → check `main` field in package.json points to `electron/main.js`
   - "Cannot find icon file" → ensure `icon-512.png` exists in project root and is at least 256×256
   - "Code signing failed" → user has no certificate; comment out `"sign"` config if any was added, or skip signing entirely

8. **Common Electron-specific runtime issues to look for and fix:**
   - **Service worker registration warning:** in Electron, `navigator.serviceWorker` works only over `https://` or `file://` with specific flags. The existing `navigator.serviceWorker.register('sw.js').catch(()=>{})` already swallows the error — but check the console. If noisy, gate it with `if(location.protocol === 'https:' || location.protocol === 'http:') ...`.
   - **Geolocation:** Electron requires `webPreferences.geolocation` to be enabled (it is by default in Electron 33+) and the user grants on first prompt. If the "Use my location" button in Sites tab does nothing, check console for `permissions` errors and add a `session.setPermissionRequestHandler` in `electron/main.js`.
   - **Window-open links:** the existing handler routes `http(s)://` links to the system browser. Verify clicking "Maps" / "Lt. pollution" in the Sites tab opens the system Chrome, not a new Electron window.
   - **Auto-refresh interval running after close:** check if `state.autoRefreshHandle` keeps the renderer alive. If app refuses to quit, add `app.on('before-quit', () => clearInterval(...))` — or just leave it since Electron closes the renderer on window close.

9. **Update BUILD.md and README.md** with whatever you actually did and any new troubleshooting notes. If the Windows build worked cleanly, just confirm the existing instructions. If you had to fix anything, document it.

10. **Commit and tag.** If a git repo exists, `git add -A && git commit -m "build: Electron Windows .exe build verified"` and `git tag v1.0.0`.

## Part B — Polish the PWA / APK path

The PWA works but a few things would make PWABuilder produce a cleaner, store-ready APK. Bubblewrap (Google's official PWA-to-APK CLI) is also a good alternative.

### Steps

1. **Add screenshots to the manifest.** Most PWA installers (including PWABuilder, and the Chrome "Install" prompt on Android) show screenshots in the install card. Take 2–3 screenshots of the running app at phone aspect ratio (1080×1920 or similar). Save under `screenshots/` and add to `manifest.webmanifest`:
   ```json
   "screenshots": [
     { "src": "screenshots/tonight.png", "sizes": "1080x1920", "type": "image/png", "form_factor": "narrow", "label": "Tonight verdict" },
     { "src": "screenshots/sky.png",     "sizes": "1080x1920", "type": "image/png", "form_factor": "narrow", "label": "Live sky positions" },
     { "src": "screenshots/targets.png", "sizes": "1080x1920", "type": "image/png", "form_factor": "narrow", "label": "Deep-sky targets" }
   ]
   ```
   The user's phone (Galaxy S25+) is 1080×2340 — that aspect works.

   If you can't easily get phone-aspect screenshots, capture them at narrow desktop width (430×800) in the Electron dev window — DevTools device emulation (Pixel 5) is the easy path.

2. **Verify maskable icons render correctly.** Open `icon-512.png` and check that the camera body and moon graphic stay inside the inner 80% safe zone (Android crops the outer 20% on circular launchers). If they don't, regenerate `icon-512.png` and `icon-192.png` from `icon.svg` after adding a safer padding. Adobe's `maskable.app` tool is a one-shot fix if needed.

3. **Add `display_override`** to the manifest for better tablet behavior:
   ```json
   "display_override": ["window-controls-overlay", "standalone"],
   ```

4. **Add `prefer_related_applications: false`** so Android doesn't try to push users to a fake native app.

5. **Set up Bubblewrap (offline APK build, optional but better than PWABuilder for power users).**

   a. Globally install: `npm install -g @bubblewrap/cli`
   b. Initialize: `bubblewrap init --manifest=https://YOUR_HOST/manifest.webmanifest`
      - This needs the PWA hosted somewhere with HTTPS. If the user hasn't pushed to GitHub Pages yet, do that first (`git push` then enable Pages in repo settings → main / root).
   c. Bubblewrap will prompt for: package name (use `io.skywatch.app`), signing key (let it create one — save the keystore + password somewhere safe), splash screen color, etc.
   d. Build: `bubblewrap build`
   e. Result: `app-release-signed.apk` + `app-release-bundle.aab` in the project root. Sideload the APK to the S25+ to test.

   Save the generated `twa-manifest.json` in the project root so future builds can re-run without prompting.

6. **Add a `.well-known/assetlinks.json`** file if the user wants the TWA to remove the Chrome custom-tabs URL bar. Without this, Android shows a small URL bar at the top during launch (the "TWA hint"). Bubblewrap prints the exact JSON to use and the URL to deploy it to. Add the file under `.well-known/assetlinks.json` and ensure GitHub Pages serves it — it does by default but verify.

7. **Test the install on the S25+:**
   - Sideload the APK: `adb install app-release-signed.apk` (USB debugging on)
   - Or have the user transfer via Quick Share and tap "Install" with "Install unknown apps" allowed for Files app
   - First launch should show the SkyWatch splash, then the standalone PWA — no Chrome chrome at all if assetlinks is correct
   - Verify: location permission prompt, forecast loads, all tabs render

8. **(Optional) Sign with a real cert** for production. Bubblewrap creates a debug keystore by default — fine for personal sideload but not for the Play Store. Document the path to upload to Play Console if user wants that later.

9. **Update README.md** with the actual hosted URL (once GitHub Pages is live) and a one-line note about the Bubblewrap path being available for users who want offline APK builds.

10. **Commit.**

## Verification checklist

When done, all of these should be true:

- [ ] `dist/SkyWatch Setup 1.0.0.exe` exists and installs cleanly on Windows
- [ ] `dist/SkyWatch 1.0.0.exe` (portable) runs without install
- [ ] All 7 tabs render with no console errors in the installed app
- [ ] Forecast data loads from Open-Meteo on first launch
- [ ] Location permission works (Sites → "Use my location")
- [ ] External links (Maps, Lt. pollution) open in the user's default browser
- [ ] `manifest.webmanifest` validates at https://manifest-validator.appspot.com/ with no errors
- [ ] `screenshots/` folder has at least 2 PNGs referenced in the manifest
- [ ] If Bubblewrap was set up, `app-release-signed.apk` exists and installs on the S25+

## Things to NOT do

- Don't add any analytics, telemetry, or "phone home" code.
- Don't pull in any framework (React/Vue/etc) — vanilla JS only.
- Don't introduce a build step for the web code — `js/` and `css/` ship as written.
- Don't store the signing keystore in the repo. Add it to `.gitignore` if it ends up in the project folder.
- Don't auto-update without user consent. The Electron config can support electron-updater later, but leave it off for v1.

## Reference

- Existing project structure: see `README.md` § Architecture
- Existing build options: see `BUILD.md`
- The user's hardware: Sony A7 III camera + Tamron 17-28 and 70-300 lenses, Samsung Galaxy S25+
- The user's location: Bucharest, Romania (default site, but Sites tab supports any location)

Work through Part A first; only move to Part B once the `.exe` is verified. Report back with what worked, what didn't, and any decisions you made along the way.
