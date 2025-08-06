const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  querySystem: (query) => ipcRenderer.invoke('query-system', query),
  onInitializationStatus: (callback) => ipcRenderer.on('initialization-status', callback)
});