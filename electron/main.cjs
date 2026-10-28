const { app, BrowserWindow, Menu, ipcMain, protocol, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

// The renderer is loaded from a scheme instead of file:// so every absolute
// path the web build already uses (/assets, /fonts, /Boxs) keeps working.
const SCHEME = 'box';
const DIST = path.join(__dirname, '..', 'dist');
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

async function serveApp(request) {
  const { pathname } = new URL(request.url);
  const relative = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const filePath = path.normalize(path.join(DIST, relative));

  if (filePath !== DIST && !filePath.startsWith(DIST + path.sep)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const data = await fs.readFile(filePath);
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    return new Response(data, { headers: { 'Content-Type': type } });
  } catch {
    // Single-page app: unknown paths get the shell.
    const html = await fs.readFile(path.join(DIST, 'index.html'));
    return new Response(html, { headers: { 'Content-Type': MIME['.html'] } });
  }
}

let mainWindow = null;

app.setName('Box');
if (process.platform === 'win32') app.setAppUserModelId('com.box.secondbrain');

// Keep local development away from the installed app's database and profile.
if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'Box Dev'));
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    show: false,
    backgroundColor: '#171717',
    ...(app.isPackaged
      ? {}
      : { icon: path.join(__dirname, '..', 'build', 'icon.ico') }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow = win;

  win.once('ready-to-show', () => win.show());

  const sendMaximized = () => {
    if (!win.isDestroyed()) win.webContents.send('window:maximized', win.isMaximized());
  };
  win.on('maximize', sendMaximized);
  win.on('unmaximize', sendMaximized);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (app.isPackaged) {
    win.loadURL(`${SCHEME}://app/index.html`);
  } else {
    win.loadURL(DEV_URL);
  }

  win.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.on('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});
ipcMain.on('window:toggle-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.on('window:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});
ipcMain.handle('window:is-maximized', (event) => {
  return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
});

if (hasSingleInstanceLock) {
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    protocol.handle(SCHEME, serveApp);
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
