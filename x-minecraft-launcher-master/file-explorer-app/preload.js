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
  copyPath: (target) => ipcRenderer.invoke('fs:copy-path', target),
  terminal: (dir) => ipcRenderer.invoke('fs:terminal', dir),
  newWindow: () => ipcRenderer.invoke('window:new'),
  tags: {
    get: () => ipcRenderer.invoke('tags:get'),
    set: (target, color) => ipcRenderer.invoke('tags:set', target, color),
  },
  updates: {
    check: () => ipcRenderer.invoke('update:check'),
    download: (url) => ipcRenderer.invoke('update:download', url),
    install: (file) => ipcRenderer.invoke('update:install', file),
  },
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
