const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mini', {
  onState: cb => ipcRenderer.on('mini-state', (_e, s) => cb(s)),
  action: a => ipcRenderer.send('mini-action', a),
});
