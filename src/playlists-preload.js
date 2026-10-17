const { contextBridge, ipcRenderer } = require('electron');

const on = (ch, cb) => {
  const h = (_e, d) => cb(d);
  ipcRenderer.on(ch, h);
  return () => ipcRenderer.removeListener(ch, h);
};

contextBridge.exposeInMainWorld('pl', {
  services: () => ipcRenderer.invoke('pl:services'),
  connect: id => ipcRenderer.invoke('pl:connect', id),
  disconnect: id => ipcRenderer.invoke('pl:disconnect', id),
  list: id => ipcRenderer.invoke('pl:list', id),
  transfer: job => ipcRenderer.invoke('pl:transfer', job),
  cancel: () => ipcRenderer.invoke('pl:cancel'),
  backup: id => ipcRenderer.invoke('pl:backup', id),
  saveReport: report => ipcRenderer.invoke('pl:saveReport', report),
  openPortal: id => ipcRenderer.invoke('pl:openPortal', id),
  onProgress: cb => on('pl:progress', cb),
  onBackupProgress: cb => on('pl:backup-progress', cb),
});
