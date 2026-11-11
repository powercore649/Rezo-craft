const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('files', {
  roots: () => ipcRenderer.invoke('roots:list'),
  list: (dir) => ipcRenderer.invoke('fs:list', dir),
  open: (target) => ipcRenderer.invoke('fs:open', target),
  reveal: (target) => ipcRenderer.invoke('fs:reveal', target),
  recycleBin: () => ipcRenderer.invoke('fs:recycle-bin'),
  network: () => ipcRenderer.invoke('fs:network'),
  trash: (targets) => ipcRenderer.invoke('fs:trash', targets),
  rename: (target, name) => ipcRenderer.invoke('fs:rename', target, name),
  mkdir: (dir, name) => ipcRenderer.invoke('fs:mkdir', dir, name),
  newFile: (dir, name) => ipcRenderer.invoke('fs:new-file', dir, name),
  clipboard: (mode, targets) => ipcRenderer.invoke('fs:clipboard', mode, targets),
  paste: (dir) => ipcRenderer.invoke('fs:paste', dir),
  info: (target) => ipcRenderer.invoke('fs:info', target),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximized: (callback) => {
    const listener = (_event, value) => callback(Boolean(value))
    ipcRenderer.on('window:maximized', listener)
    return () => ipcRenderer.removeListener('window:maximized', listener)
  },
})
