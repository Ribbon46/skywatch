/* Capture phone-aspect (1080×1920) and wide desktop (1920×1080) screenshots
 * of the main tabs for use in manifest.webmanifest. Run from the repo root:
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

/* Phone form factor: 432×768 CSS at DPR 1, upscaled to 1080×1920 */
const PHONE = { cssW: 432, cssH: 768, outW: 1080, outH: 1920 };
/* Wide form factor: 1280×720 CSS at DPR 1, upscaled to 1920×1080 */
const WIDE  = { cssW: 1280, cssH: 720, outW: 1920, outH: 1080 };

async function captureForViewport(viewport, namePrefix) {
  const outDir = path.join(__dirname, '..', 'screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const win = new BrowserWindow({
    width: viewport.cssW, height: viewport.cssH,
    show: false,
    backgroundColor: '#04060e',
    webPreferences: {
      contextIsolation: true, nodeIntegration: false, sandbox: true, offscreen: false
    }
  });
  win.webContents.setZoomFactor(1);
  await win.webContents.loadFile(path.join(__dirname, '..', 'index.html'));

  for (let i = 0; i < TABS.length; i++) {
    const tab = TABS[i];
    await win.webContents.executeJavaScript(
      `location.hash = '#${tab.hash}'; void 0`
    );
    await new Promise(r => setTimeout(r, i === 0 ? 6000 : 1200));
    const img = await win.webContents.capturePage();
    const resized = img.resize({ width: viewport.outW, height: viewport.outH, quality: 'best' });
    const out = path.join(outDir, `${namePrefix}${tab.name}.png`);
    fs.writeFileSync(out, resized.toPNG());
    console.log('wrote', out, `(${resized.getSize().width}×${resized.getSize().height})`);
  }
  win.close();
}

async function main() {
  await captureForViewport(PHONE, '');
  await captureForViewport(WIDE,  'wide-');
}

app.whenReady().then(main).then(() => app.quit()).catch(err => {
  console.error(err);
  process.exit(1);
});
