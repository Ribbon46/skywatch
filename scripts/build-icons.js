/* build-icons.js — generate maskable PNG variants of icon.svg.
 * Maskable icons need their visual content inside the inner 80% radius so
 * Android circular-launcher crops don't clip critical art. We do this by
 * compositing the source SVG at 70% scale on top of a flat-color canvas at
 * the target size. Runs via: npm run build:icons
 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC  = path.join(ROOT, 'icon.svg');

/* Inner-content scale relative to canvas (0.70 = strong safe zone, well
 * inside the 80% maskable spec). */
const INNER = 0.70;
const BG    = '#05060b';

async function render(size, dest){
  const tmp = path.join(__dirname, `_icon-tmp-${size}.html`);
  /* Use plain HTML with the SVG embedded as <img> so we don't have to deal
   * with viewBox math — the browser scales it for us. */
  fs.writeFileSync(tmp,
`<!doctype html><html><head><style>
  html,body{margin:0;padding:0;background:${BG};}
  body{display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;overflow:hidden;}
  img{width:${Math.round(size*INNER)}px;height:${Math.round(size*INNER)}px;display:block;}
</style></head><body><img src="file:///${SRC.replace(/\\/g,'/')}"></body></html>`);

  const win = new BrowserWindow({
    width: size, height: size,
    show: false,
    backgroundColor: BG,
    useContentSize: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  await win.loadFile(tmp);
  /* Let the SVG decode before we capture */
  await new Promise(r => setTimeout(r, 400));
  const img = await win.webContents.capturePage();
  /* capturePage uses device pixels; resize to the exact target size. */
  const resized = img.resize({ width: size, height: size, quality: 'best' });
  fs.writeFileSync(dest, resized.toPNG());
  win.close();
  try { fs.unlinkSync(tmp); } catch(_){}
  console.log('  wrote', path.relative(ROOT, dest), '(' + resized.getSize().width + '×' + resized.getSize().height + ')');
}

app.whenReady().then(async () => {
  await render(192, path.join(ROOT, 'icon-192-maskable.png'));
  await render(512, path.join(ROOT, 'icon-512-maskable.png'));
  app.quit();
}).catch(e => { console.error(e); process.exit(1); });
