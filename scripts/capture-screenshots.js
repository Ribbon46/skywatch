/* Capture phone-aspect (1080×1920) screenshots of the three main tabs for
 * use in manifest.webmanifest. Run from the repo root:
 *   npm run screenshots
 *
 * Requires internet on first run (Open-Meteo cloud forecast).
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const TABS = [
  { hash: 'tonight', name: 'tonight' },
  { hash: 'planner', name: 'planner' },
  { hash: 'sky',     name: 'sky' },
  { hash: 'gear',    name: 'gear' }
];

/* Device-pixel-ratio 1, then 2.5× upscale via deviceScaleFactor so the
 * captured bitmap is a true 1080×1920 even though the renderer thinks
 * it's 432×768 (phone-ish CSS pixels). */
const CSS_W = 432, CSS_H = 768, DPR = 2.5;

async function main() {
  const outDir = path.join(__dirname, '..', 'screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const win = new BrowserWindow({
    width: CSS_W, height: CSS_H,
    show: false,
    backgroundColor: '#05060b',
    webPreferences: {
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      offscreen: false
    }
  });
  win.webContents.setZoomFactor(1);
  await win.webContents.loadFile(path.join(__dirname, '..', 'index.html'));

  /* Give the renderer ~6s on the first tab so the cloud-forecast XHR can
   * complete; subsequent tab switches are local-only and need ~1s. */
  for (let i = 0; i < TABS.length; i++) {
    const tab = TABS[i];
    await win.webContents.executeJavaScript(
      `location.hash = '#${tab.hash}'; void 0`
    );
    await new Promise(r => setTimeout(r, i === 0 ? 6000 : 1200));
    const img = await win.webContents.capturePage();
    /* capturePage respects the window's logical size, so we upscale the
     * resulting bitmap to 1080×1920 with Electron's nativeImage helpers. */
    const resized = img.resize({ width: 1080, height: 1920, quality: 'best' });
    const out = path.join(outDir, `${tab.name}.png`);
    fs.writeFileSync(out, resized.toPNG());
    console.log('wrote', out, `(${resized.getSize().width}×${resized.getSize().height})`);
  }

  app.quit();
}

app.whenReady().then(main).catch(err => {
  console.error(err);
  process.exit(1);
});
