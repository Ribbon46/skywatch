# SkyWatch — Astrophotography Planner PWA

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-ready-blueviolet)]()
[![No build step](https://img.shields.io/badge/build-none-success)]()
[![Open-Meteo](https://img.shields.io/badge/forecast-Open--Meteo-orange)](https://open-meteo.com/)
[![Vanilla JS](https://img.shields.io/badge/JS-vanilla-yellow)]()

> A self-contained, install-anywhere astrophotography planning app. Open `index.html` on desktop or install it as a PWA on Android — same code, same UI, same offline behavior. No build step, no backend, no tracking.

---

## Features

| Tab | What it does |
|-----|--------------|
| **Tonight** | Hero verdict (GO / NO-GO + one-line reason) + key-facts stat grid (cloud peak, moon, usable dark, wind) + colour-coded hourly cloud strip + active meteor showers + "up right now" deep-sky picks + collapsed 14-night list. |
| **Plan** | Curated dark-sky spots ranked into tiers by distance from your active site: **Close to home** (≤30 km) · **Weekend drive** (30-100 km) · **Day trip** (100-300 km) · **Expedition** (>300 km). Each spot shows Bortle, drive-time estimate, facilities, hazards, "best for" tags, with one-tap Maps / light-pollution links and "save as site." 20 spots curated for the Bucharest region. |
| **Sky** | Real-time altitude/azimuth for Sun, Moon, all naked-eye planets (Mercury–Neptune), Milky Way core. Today's sun/moon rise/set + all twilight times. Animated MW-core elevation curve for the next 24 h. **AR mode** projects bodies onto the live rear-camera feed using device compass + tilt (phone only). |
| **Targets** | 160 deep-sky objects — full Messier catalog (M1–M110) + 50 popular NGC/IC targets. Live altitude from your site, sortable, filterable by type, searchable by name or constellation. |
| **Gear (Smart Setup)** | Pick camera + lens + goal — get one consolidated recipe card with shutter, aperture, ISO, focus, stack count, and a one-line explanation. **63 cameras + 52 lenses** preloaded (Sony / Canon / Nikon / Fuji / Pentax / OM System / Panasonic / Leica / Samsung / Apple / Google / ZWO). Sensor dimensions auto-populated — no manual input. Advanced per-calculator UI is hidden behind a disclosure for users who want it. |
| **Log** | Session journal stored in `localStorage`. Frames, exposure, ISO, target list, conditions, free-form notes. Export/import as JSON. |
| **Events** (via Tonight) | Active and upcoming meteor showers from a 10-shower annual database, live planet conjunctions for the next 90 days, equinoxes & solstices. |
| **Sites** (via header pill) | Save multiple observing locations with Bortle ratings. GPS "add current location," distance from active site shown. |

## Live data sources

- **[Open-Meteo](https://open-meteo.com/)** — global cloud cover, visibility, humidity, dew point, wind, precipitation. Free, no key required, CORS-enabled.
- **SunCalc** (BSD-2, Vladimir Agafonkin) — sun and moon rise/set, twilight, illumination.
- **Paul Schlyter's planetary elements** — Mercury through Neptune position to ~1-2 arcmin accuracy.
- **Built-in catalogs** — Messier (110), top NGC/IC (50), brightest stars (30), meteor showers (10), camera bodies (63), lenses (52), observing spots (20). Source of truth in `/data/*.json`; inlined into `js/catalogs.js` via `npm run build:catalogs`.

## Install

### As a PWA on Galaxy S25+ / Android / iOS

1. Push the folder to a static host (GitHub Pages works out of the box — see [Deploy](#deploy)).
2. Open the URL in Chrome / Safari.
3. Tap menu → **Add to Home screen** → **Install**.
4. The app installs with a moon-camera icon, opens fullscreen, and runs offline after first load.

### Locally on desktop

```bash
git clone https://github.com/YOUR_USERNAME/skywatch.git
cd skywatch
python3 -m http.server 8080
# open http://localhost:8080
```

Or just double-click `index.html` — most features work from `file://`, but service-worker registration requires HTTP(S).

### As a native Windows app

```bash
npm install
npm run dist:win
```

Outputs `dist/SkyWatch Setup 1.0.0.exe` (NSIS installer) and `dist/SkyWatch 1.0.0.exe` (portable). See [BUILD.md](BUILD.md) for macOS / Linux targets and code-signing notes.

## Deploy

### GitHub Pages

Push to GitHub. Settings → Pages → Source: `main` branch, `/` root. Done. The included `.github/workflows/pages.yml` will also work as a deploy alternative.

### Netlify / Cloudflare Pages / Vercel

Drop the folder. No build step. Set the publish directory to root.

### Make a real APK

Two paths — both need the PWA hosted somewhere with HTTPS first.

**PWABuilder (web UI, easiest).** Go to [pwabuilder.com](https://www.pwabuilder.com), paste your URL, download the generated APK / AAB.

**Bubblewrap (Google's official CLI, offline, signs locally).**
```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://YOUR_HOST/manifest.webmanifest
bubblewrap build
```
See [BUILD.md § 3](BUILD.md) for the keystore + `.well-known/assetlinks.json` details that remove the Chrome URL hint bar.

## Architecture

```
index.html               # PWA shell
manifest.webmanifest     # PWA manifest (icons, screenshots, shortcuts, display)
sw.js                    # service worker — network-first for API, cache-first for shell
icon.svg / .png          # 192 / 512 icons (maskable-safe)

css/app.css              # mobile-first dark theme

js/
  catalogs.js            # inlined data — lets the app run from file:// without fetch()
  app.js                 # main controller, hash router, all tab renderers
  astronomy.js           # SunCalc + planet ephemerides + coordinate transforms
  forecast.js            # Open-Meteo wrapper + threshold evaluator
  camera.js              # NPF / 500 / 300 / FOV / hyperfocal / stack calculators
  sites.js               # observing sites + geolocation
  calendar.js            # meteor shower + conjunction detection
  log.js                 # session journal (localStorage)

data/                    # source-of-truth JSON, re-inlined into js/catalogs.js
  messier.json           # 110 Messier objects with RA/Dec/mag/type/size
  ngc.json               # 50 popular NGC/IC targets
  stars.json             # 30 brightest stars
  meteor-showers.json    # 10 major annual meteor showers
  cameras.json           # 12 cameras with pixel pitch + sensor dims
  lenses.json            # 11 lenses

electron/main.js         # Electron main process — used by `npm start` / `npm run dist*`
scripts/
  capture-screenshots.js # `npm run screenshots` — regenerates the 1080×1920 PWA assets
screenshots/             # phone-aspect PNGs referenced from manifest.webmanifest
```

Each `js/*.js` module exposes a single global namespace (`Astro`, `Forecast`, `Camera`, `Sites`, `AstroCalendar`, `SessionLog`) and is also `module.exports`-able for Node testing.

## Customizing thresholds

`Forecast.defaults` controls when "Tonight is GO" fires:

```js
{
  cloudMaxPct: 30,         // hourly cloud peak inside dark window
  moonMaxPct: 40,          // either this, OR moon below horizon all night
  minUsableDarkMin: 90,    // astronomical dark minus moon-up time
  forecastDays: 14
}
```

Override in `js/app.js` if you want stricter or looser triggering.

## Privacy

- No analytics, no telemetry, no ads.
- All forecast requests go directly from your browser to Open-Meteo.
- Sites and session log live in your browser's `localStorage` only.
- Source code is fully readable — no minifiers, no tree-shakers, no opaque builds.

## Roadmap

- [ ] Star tracker presets (Move Shoot Move, Star Adventurer, AM5)
- [ ] iCal export for upcoming GO nights
- [ ] FOV-on-target preview overlay (sensor frame against target size)
- [ ] Sky-quality estimation from satellite SQM grid
- [ ] Custom alert webhook (Telegram / Discord) — would need a tiny backend
- [ ] Multi-language UI (PRs welcome — translation strings are isolated in `js/app.js`)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).

## Credits

- Forecast: [Open-Meteo](https://open-meteo.com/)
- Sun / moon: [SunCalc](https://github.com/mourner/suncalc) by Vladimir Agafonkin (BSD-2)
- Planet ephemerides adapted from [Paul Schlyter](https://stjarnhimlen.se/comp/ppcomp.html) (public domain)
- NPF rule: Frédéric Michaud (PhotoPills implementation)
- Bortle scale: John E. Bortle, *Sky & Telescope*, 2001
