# Screenshots

These PNGs are referenced from `manifest.webmanifest` and shown in:

- The Chrome / Edge "Install app" prompt on Android.
- PWABuilder's generated APK / AAB store listing.
- Bubblewrap's TWA install card.

## Regenerate

```bash
npm run screenshots
```

This runs `scripts/capture-screenshots.js`, an offscreen Electron renderer
that loads SkyWatch at phone-ish dimensions, switches through the Tonight /
Sky / Targets tabs, and writes 1080×1920 PNGs here.

Internet is required on first run so the cloud-forecast XHR can populate the
Tonight verdict; subsequent regenerations can run offline.
