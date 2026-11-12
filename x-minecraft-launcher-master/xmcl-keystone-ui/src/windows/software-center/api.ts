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

export interface SoftwareCenterApi {
  open(): Promise<boolean>
  close(): Promise<void>
  state(): Promise<SuiteState>
  install(id?: string): Promise<SuiteInstallResult>
  launch(id: string): Promise<boolean>
  openExternal(url: string): Promise<void>
}

declare global {
  interface Window {
    softwareCenter?: SoftwareCenterApi
  }
}
