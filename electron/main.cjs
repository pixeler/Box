const {
  app,
  BrowserWindow,
  dialog,
  Menu,
  Notification,
  ipcMain,
  nativeImage,
  protocol,
  session,
  shell,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');

// The renderer is loaded from a scheme instead of file:// so every absolute
// path the web build already uses (/assets, /fonts, /Boxs) keeps working.
const SCHEME = 'spacezen';
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
  let pathname;
  let relative;
  try {
    pathname = new URL(request.url).pathname;
    relative = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  } catch {
    // A malformed or non-decodable URL is a bad request, not a crashed handler.
    return new Response('Bad request', { status: 400 });
  }

  if (relative.includes('\0')) {
    return new Response('Not found', { status: 404 });
  }

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

app.setName('SpaceZen');
// A hard-coded AppUserModelID only resolves when a Start-menu shortcut carries
// the same id. A portable build has none, and Windows then paints the taskbar
// button with a blank document icon, so the window keeps the exe's own identity.

// The app shipped as "Box" before the SpaceZen rename. Move the old profile
// into place once, so existing notes, settings and sessions are not lost.
for (const [legacyName, currentName] of [['Box', 'SpaceZen'], ['Box Dev', 'SpaceZen Dev']]) {
  const legacyProfile = path.join(app.getPath('appData'), legacyName);
  const currentProfile = path.join(app.getPath('appData'), currentName);
  try {
    if (!fsSync.existsSync(currentProfile) && fsSync.existsSync(legacyProfile)) {
      fsSync.renameSync(legacyProfile, currentProfile);
    }
  } catch (error) {
    console.warn(`Could not migrate the legacy "${legacyName}" profile:`, error);
  }
}

// Keep local development away from the installed app's database and profile.
if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'SpaceZen Dev'));
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

/**
 * Only real web links leave the app. Note content could otherwise hand
 * `file:`, `spacezen:`, or any registered protocol handler to the OS.
 */
const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function openExternalSafely(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl));
    if (!EXTERNAL_PROTOCOLS.has(parsed.protocol)) return false;
    void shell.openExternal(parsed.toString());
    return true;
  } catch {
    return false;
  }
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
    // Windows takes the taskbar and Task Manager icon from the window, not from
    // whatever the installer embedded, so the packaged app ships its own copy.
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'icon.ico')
      : path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // The renderer runs in the OS sandbox: no Node, no filesystem, no spawn.
      sandbox: true,
    },
  });

  mainWindow = win;

  const showWindowSafely = () => {
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show();
    }
  };
  win.once('ready-to-show', showWindowSafely);
  setTimeout(showWindowSafely, 2500);

  // Keep standard browser debugging & reload shortcuts active even without a menu bar.
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown') return;
    const key = String(input.key || '').toLowerCase();
    const cmdOrCtrl = input.control || input.meta;

    if (key === 'f12' || (cmdOrCtrl && input.shift && key === 'i')) {
      win.webContents.toggleDevTools();
      return;
    }
    if (key === 'f5' || (cmdOrCtrl && !input.shift && key === 'r')) {
      win.webContents.reload();
      return;
    }
    if (cmdOrCtrl && input.shift && key === 'r') {
      win.webContents.reloadIgnoringCache();
    }
  });

  const targetUrl = app.isPackaged ? `${SCHEME}://app/index.html` : DEV_URL;

  const showLoadErrorPage = (title, detail) => {
    if (win.isDestroyed()) return;
    showWindowSafely();
    const safeTitle = String(title || 'خطا در اجرای برنامه').replace(/[<>&"]/g, '');
    const safeDetail = String(detail || '').replace(/[<>&]/g, '');
    const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<title>SpaceZen — خطا</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    background: #171717;
    color: #f5f5f5;
    font-family: Tahoma, system-ui, sans-serif;
    display: flex;
    flex-direction: column;
  }
  .titlebar {
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    background: #121212;
    border-bottom: 1px solid #262626;
    -webkit-app-region: drag;
    user-select: none;
  }
  .controls {
    display: flex;
    gap: 6px;
    -webkit-app-region: no-drag;
  }
  .ctrl-btn {
    background: transparent;
    border: 1px solid #303030;
    color: #d4d4d4;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  .ctrl-btn:hover { background: #262626; color: #fff; }
  .ctrl-btn.close:hover { background: #e11d48; border-color: #e11d48; color: #fff; }
  .main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .card {
    width: 100%;
    max-width: 560px;
    background: #1f1f1f;
    border: 1px solid #2e2e2e;
    border-radius: 12px;
    padding: 24px;
  }
  h1 { margin: 0 0 8px; font-size: 16px; color: #fda4af; }
  p { margin: 0 0 14px; font-size: 13px; color: #a3a3a3; line-height: 1.7; }
  pre {
    margin: 0 0 16px;
    padding: 12px;
    background: #141414;
    border: 1px solid #262626;
    border-radius: 8px;
    color: #e5e5e5;
    font-size: 12px;
    direction: ltr;
    text-align: left;
    overflow: auto;
    max-height: 220px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .btn {
    background: #262626;
    border: 1px solid #383838;
    color: #f5f5f5;
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 12px;
    cursor: pointer;
  }
  .btn.primary { background: #f5f5f5; color: #171717; border-color: #f5f5f5; font-weight: 600; }
</style>
</head>
<body>
  <div class="titlebar">
    <span style="font-size:12px;color:#a3a3a3;">SpaceZen — گزارش خطای دسکتاپ</span>
    <div class="controls" dir="ltr">
      <button class="ctrl-btn" onclick="window.desktop && window.desktop.minimize()">—</button>
      <button class="ctrl-btn" onclick="window.desktop && window.desktop.toggleMaximize()">□</button>
      <button class="ctrl-btn close" onclick="window.desktop && window.desktop.close()">✕</button>
    </div>
  </div>
  <div class="main">
    <div class="card">
      <h1>${safeTitle}</h1>
      <p>بارگذاری پنجره دسکتاپ با خطا مواجه شد. می‌توانید دوباره تلاش کنید یا با کلید F12 ابزار توسعه‌دهنده را بررسی کنید.</p>
      <pre>${safeDetail}</pre>
      <div class="actions">
        <button class="btn primary" onclick="location.href='${targetUrl}'">تلاش مجدد</button>
        <button class="btn" onclick="window.desktop && window.desktop.toggleDevTools()">ابزار توسعه‌دهنده (F12)</button>
      </div>
    </div>
  </div>
</body>
</html>`;
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  };

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return; // Ignore aborted loads
    if (String(validatedURL).startsWith('data:')) return;
    showLoadErrorPage('خطا در بارگذاری صفحه', `${errorDescription} (${errorCode})\nURL: ${validatedURL}`);
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    showLoadErrorPage('فرآیند نمایش متوقف شد', `Reason: ${details?.reason || 'unknown'} (exitCode: ${details?.exitCode ?? 'n/a'})`);
  });

  const sendMaximized = () => {
    if (!win.isDestroyed()) win.webContents.send('window:maximized', win.isMaximized());
  };
  win.on('maximize', sendMaximized);
  win.on('unmaximize', sendMaximized);

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafely(url);
    return { action: 'deny' };
  });

  // The app window only ever shows the app. A link (or a redirect) that tried to
  // replace it would load a foreign page with the desktop bridge in reach.
  win.webContents.on('will-navigate', (event, url) => {
    try {
      const next = new URL(url);
      // Reloads and in-app routes stay inside the app, dev server and all.
      if (next.origin === new URL(targetUrl).origin) return;
      if (next.protocol === `${SCHEME}:`) return;
    } catch {
      // An unparsable URL is never a place to go.
    }
    event.preventDefault();
    openExternalSafely(url);
  });

  win.loadURL(targetUrl);

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
ipcMain.on('window:reload', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.webContents.reload();
});
ipcMain.on('window:toggle-devtools', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.webContents.toggleDevTools();
});

// A note's PDF is written from a hidden window: the print dialog never opens
// and the file lands where the user picks, so exporting is one click.
ipcMain.handle('note:save-pdf', async (event, payload) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const html = typeof payload?.html === 'string' ? payload.html : '';
  const suggested =
    String(typeof payload?.fileName === 'string' ? payload.fileName : '')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/^\.+/, '')
      .trim()
      .slice(0, 80) || 'note';
  if (!html) return { saved: false, error: 'empty document' };

  const options = {
    title: 'ذخیرهٔ PDF',
    defaultPath: path.join(app.getPath('downloads'), `${suggested}.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  };
  const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
  if (result.canceled || !result.filePath) return { saved: false, canceled: true };

  // The note document is untrusted input: it is printed with scripting off, in
  // its own sandboxed renderer, so markup can never run code with the bridge.
  const hidden = new BrowserWindow({
    show: false,
    webPreferences: {
      offscreen: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      javascript: false,
      webSecurity: true,
    },
  });

  try {
    await hidden.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await hidden.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
    });
    await fs.writeFile(result.filePath, pdf);
    return { saved: true, filePath: result.filePath };
  } catch (error) {
    return { saved: false, error: String(error?.message || error) };
  } finally {
    if (!hidden.isDestroyed()) hidden.destroy();
  }
});

// Focus session start/finish: a real Windows toast. The renderer plays its own
// chime, so the toast itself stays silent instead of stacking two sounds.
ipcMain.on('app:notify', (_event, payload) => {
  if (!Notification.isSupported()) return;
  const title = typeof payload?.title === 'string' ? payload.title : 'SpaceZen';
  const body = typeof payload?.body === 'string' ? payload.body : '';
  new Notification({ title, body, silent: true }).show();
});

// Remaining focus minutes on the taskbar button. Windows 11 never repaints a
// taskbar icon that changed after creation, so this uses the overlay badge the
// shell does refresh (always painted in the button's corner). The same minutes
// go into the window title, which is what Windows shows on hover.
ipcMain.on('focus:badge', (event, payload) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;

  const dataUrl = typeof payload === 'string' ? payload : payload?.dataUrl;
  const label = typeof payload === 'object' && payload?.label ? String(payload.label) : '';

  try {
    if (dataUrl) {
      win.setOverlayIcon(
        nativeImage.createFromDataURL(dataUrl),
        label ? `${label} دقیقه تمرکز` : 'Focus timer'
      );
      win.setTitle(label ? `SpaceZen — ${label} دقیقه` : 'SpaceZen');
    } else {
      win.setOverlayIcon(null, '');
      win.setTitle('SpaceZen');
    }
  } catch (error) {
    console.warn('Focus badge could not be applied:', error);
  }
});

if (hasSingleInstanceLock) {
  app.whenReady().then(async () => {
    // Nothing in the app asks for the camera, microphone, location or MIDI, so
    // every such request is refused instead of prompting.
    const ALLOWED_PERMISSIONS = new Set(['clipboard-read', 'clipboard-sanitized-write']);
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
      callback(ALLOWED_PERMISSIONS.has(permission));
    });

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
