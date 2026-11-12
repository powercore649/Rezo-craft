const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('softwareCenter', {
  open: () => Promise.resolve(true),
  close: () => ipcRenderer.invoke('sc:close'),
  state: () => ipcRenderer.invoke('sc:state'),
  install: () => ipcRenderer.invoke('sc:install'),
  launch: (id) => ipcRenderer.invoke('sc:launch', id),
  openExternal: (url) => ipcRenderer.invoke('sc:open-external', url),
})
