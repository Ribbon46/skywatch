# Galaxy S25+ Astrophotography Notes

The S25+ has solid sensors but small phone pixels — best used for nightscapes / Milky Way wide shots, lunar phone-scoping, and Astrophoto mode for star fields.

## Apps to install
- **Expert RAW** (Samsung official, free from Galaxy Store) — gives full manual + DNG output and includes a dedicated **Astrophoto** mode that auto-stacks 4–10 minute exposures.
- **Camera Assistant** (Samsung official) — disables aggressive noise reduction in Pro mode so your DNGs are stackable.
- **Deciview** or **PhotoPills** — for planning Milky Way / moonrise compositions.
- **Stellarium Mobile** (free) — sky map at the field.

## Settings — Expert RAW · Astrophoto mode (preferred)
- Tap **Astrophoto** at top of Expert RAW.
- Mount phone on a tripod (mandatory — even a Joby GorillaPod works).
- Composition: aim phone at sky, ensure stars visible in viewfinder.
- Set duration: 4 min for star fields, 10 min for Milky Way detail.
- ISO is locked auto in this mode; output is a stacked JPEG + a stacked DNG.

## Settings — Expert RAW · Manual mode
For Milky Way panoramas or specific framings where Astrophoto mode won't trigger:
- **Format:** RAW (DNG) — required if you'll stack in Siril
- **ISO:** 1600 (start), push to 3200 for faint nebulosity
- **Shutter:** 10 s (S25+ wide is ~24 mm equiv; NPF cap ≈ 10 s for phone pixel size)
- **Aperture:** fixed (f/1.7 main, f/2.2 ultrawide)
- **Focus:** Manual, slide to infinity (∞), then nudge back 1 tick — phone IR autofocus fails on stars
- **WB:** 3800–4200 K
- **Timer:** 2 s
- **OIS:** the phone may flicker it off automatically with timer; that's fine
- Take 10–20 frames back-to-back, stack in Siril on your computer using DNGs.

## Settings — Moon (300mm reach via Galaxy zoom)
- **Pro mode**, not Astrophoto
- **ISO 50**, **shutter 1/250 s**, **WB 4000 K**, focus manual ∞
- Zoom: optical telephoto first (3×), then digital up to 30× max; beyond that detail collapses
- Use a tripod and tap-anywhere-to-focus disabled

## Conjunctions and bright planets
- Pro mode, **ISO 200, 1/15 s, f/auto, WB 4000 K**, ∞ focus
- For Venus + Moon or Jupiter + Saturn close pairs, shoot multiple exposures and HDR-blend later.

## Using this alert app on the S25+
1. Copy this entire `astrophoto-bucharest` folder onto the phone (Google Drive, USB-C, or Quick Share).
2. Open `alert.html` in Chrome on Android.
3. Tap the three-dot menu → **Add to Home screen** → **Install**. The app installs as a standalone PWA with the moon-camera icon.
4. Open it any time — it pulls fresh Open-Meteo cloud data on launch, every 30 minutes, and every time you bring it back from the background.
5. Tap the **↻ Refresh** button to force-update.
6. Works offline thanks to the bundled service worker — it shows the last cached forecast and re-syncs as soon as you have data.

## Field-night sequence (combo S25+ scout + A7 III shoot)
1. At home, open **AstroAlert** PWA — confirm tonight is GO.
2. Drive to dark site (or rooftop).
3. Use S25+ + Stellarium to identify Milky Way core / target framing.
4. Set up A7 III + Tamron 17-28 on tripod; focus on bright star using live-view zoom.
5. Start a 30-frame burst at 17mm f/2.8 ISO 3200 15s, then reposition for a second framing.
6. While the A7 III is shooting, use Expert RAW Astrophoto on the phone for a 10-min stacked wide of the same sky.
7. Pack down 15 minutes before astronomical twilight begins.
