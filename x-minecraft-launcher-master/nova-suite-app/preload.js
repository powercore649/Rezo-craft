const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('suite', {
  version: () => ipcRenderer.invoke('suite:version'),
  openText: (spec) => ipcRenderer.invoke('suite:open-text', spec),
  saveText: (spec) => ipcRenderer.invoke('suite:save-text', spec),
  exportPdf: (spec) => ipcRenderer.invoke('suite:export-pdf', spec),
  present: (spec) => ipcRenderer.invoke('suite:present', spec),
  openPdf: () => ipcRenderer.invoke('suite:open-pdf'),
  openPdfFile: (file) => ipcRenderer.invoke('suite:open-pdf-file', file),
  openExternal: (url) => ipcRenderer.invoke('suite:open-external', url),
})
