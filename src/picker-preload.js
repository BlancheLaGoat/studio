const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studio', {
  platforms: () => ipcRenderer.invoke('platforms'),
  choose: id => ipcRenderer.send('choose', id),
  back: () => ipcRenderer.send('picker:back'),
});
