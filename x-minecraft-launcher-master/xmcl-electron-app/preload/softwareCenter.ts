import { contextBridge, ipcRenderer } from 'electron'

export interface AppState {
  installed: boolean
  exePath?: string
}

export interface SuiteState extends AppState {
  files?: AppState
}

export interface SuiteInstallResult {
  ok: boolean
  action?: 'installed' | 'installing'
  error?: string
}

const api = {
  open: () => ipcRenderer.invoke('nova-software-center:open') as Promise<boolean>,
  close: () => ipcRenderer.invoke('nova-software-center:close') as Promise<void>,
  state: () => ipcRenderer.invoke('nova-software-center:state') as Promise<SuiteState>,
  install: (id?: string) => ipcRenderer.invoke('nova-software-center:install', id) as Promise<SuiteInstallResult>,
  launch: (id: string) => ipcRenderer.invoke('nova-software-center:launch', id) as Promise<boolean>,
  openExternal: (url: string) =>
    ipcRenderer.invoke('nova-software-center:open-external', url) as Promise<void>,
}

contextBridge.exposeInMainWorld('softwareCenter', api)
