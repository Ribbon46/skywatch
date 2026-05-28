/* Electron main process — wraps SkyWatch as a real native window.
 * Run: npm install --save-dev electron electron-builder && npm start
 * Build .exe: npm run dist
 */
const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

function createWindow() {
  /* Grant geolocation + camera (for AR sky view) without UI prompts — Electron
   * has no built-in prompt UI, so these would silently fail otherwise. */
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(permission === 'geolocation' || permission === 'media' || permission === 'camera');
  });
  const win = new BrowserWindow({
    width: 460,
    height: 880,
    minWidth: 360,
    minHeight: 600,
    backgroundColor: '#05060b',
    title: 'SkyWatch',
    icon: path.join(__dirname, '..', 'icon-512.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, '..', 'index.html'));

  /* Open external links in the system browser, not inside the app */
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
}

/* Simple menu — just the essentials */
const template = [
  {
    label: 'SkyWatch',
    submenu: [
      { role: 'reload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'minimize' },
      { role: 'close' }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'togglefullscreen' }
    ]
  }
];
Menu.setApplicationMenu(Menu.buildFromTemplate(template));

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
