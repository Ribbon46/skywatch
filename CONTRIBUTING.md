# Contributing to SkyWatch

Thanks for considering a contribution. SkyWatch is a single-page PWA with no build step — you should be able to fork, edit, and reload to see your changes immediately.

## Local development

```bash
git clone https://github.com/YOUR_USERNAME/skywatch.git
cd skywatch
python3 -m http.server 8080
# open http://localhost:8080
```

Edit any file under `js/`, `css/`, `data/`, or `index.html` and refresh. There's no transpiler, bundler, or framework in the way.

## Project structure

See [README.md](README.md#architecture). Every JS module exposes a single global namespace and supports Node-style `module.exports` so you can write quick test scripts.

## Code style

- Vanilla JS, ES2020+. No TypeScript, no JSX, no build step.
- Functions documented with brief block comments when not obvious.
- Constants and units made explicit (e.g. `pixelPitchUm`, `focalMm`, `seconds`).
- Use `const`/`let`, never `var`.
- Two-space indentation.
- Lines should generally stay under ~120 characters.

## What's welcome

- **More targets** — append to `data/messier.json`, `data/ngc.json`, or add new catalog files. Keep RA in decimal degrees (0–360), Dec in decimal degrees (-90 to +90).
- **More cameras / lenses** — extend `data/cameras.json` / `data/lenses.json`. Provide accurate pixel pitch in µm and sensor dimensions in mm.
- **More meteor showers** — extend `data/meteor-showers.json` using IMO's annual list as a reference.
- **Translations** — UI strings currently live inline in `js/app.js`. A clean i18n pass extracting them would be valuable.
- **Better planet positions** — the Schlyter implementation is good to ~1-2 arcmin. A Meeus or VSOP87 upgrade could push this to arcsecond precision.
- **Polar finder / alignment helper** — drift-alignment hints, declination scope.
- **Image stacking guide module** — Siril/DSS workflow walkthrough with file naming and dark/flat/bias scheduling.

## What's NOT in scope

- Any backend or server-side dependency. SkyWatch must stay deployable as a static file bundle.
- Tracking, analytics, or telemetry of any kind.
- Frameworks (React, Vue, Svelte). The whole point is that the source reads top-to-bottom.

## Pull requests

1. Fork & branch off `main`.
2. Make your change. Try to keep PRs single-purpose.
3. Test in Chrome and Firefox at minimum; mobile testing on at least one Android device is appreciated.
4. Update the README if you've added a user-facing feature.
5. Open the PR.

## Bug reports

Use the GitHub issue template. Include:
- Browser + version, OS.
- Steps to reproduce.
- Console errors if any.
- What you expected vs what you saw.

## Adding a catalog target — minimal example

```json
{
  "id": "M99",
  "name": "Coma Pinwheel",
  "type": "GX",
  "ra": 184.7067,
  "dec": 14.4164,
  "mag": 9.9,
  "size": "5×5'",
  "con": "Com"
}
```

Type codes used:
- `GX` galaxy · `GC` globular cluster · `OC` open cluster
- `EN` emission nebula · `PN` planetary nebula · `RN` reflection nebula
- `DN` dark nebula · `SNR` supernova remnant
- `DS` double star · `AS` asterism · `SC` star cloud

## License

By contributing, you agree your work will be released under the [MIT License](LICENSE).
