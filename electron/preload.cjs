const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizedChange: (callback) => {
    const handler = (_event, maximized) => callback(maximized);
    ipcRenderer.on('window:maximized', handler);
    return () => ipcRenderer.removeListener('window:maximized', handler);
  },
  notify: (title, body) => ipcRenderer.send('app:notify', { title, body }),
  setFocusBadge: (dataUrl, label) => ipcRenderer.send('focus:badge', { dataUrl, label }),
  reload: () => ipcRenderer.send('window:reload'),
  toggleDevTools: () => ipcRenderer.send('window:toggle-devtools'),
  savePdfAsFile: (html, fileName) => ipcRenderer.invoke('note:save-pdf', { html, fileName }),
});
