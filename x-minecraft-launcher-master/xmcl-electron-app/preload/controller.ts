import type { AntivirusState, BatteryState, DesktopWidgetState, DeveloperInfo, UpdateLauncherState, WindowController, WindowsUpdateState } from '@xmcl/runtime-api'
import { contextBridge, ipcRenderer, clipboard, webUtils } from 'electron'
import EventEmitter from 'events'

export enum Operation {
  Minimize = 0,
  Maximize = 1,
  Hide = 2,
  Show = 3,
  Close = 4,
}

function createController(): WindowController {
  function show() {
    return ipcRenderer.invoke('control', Operation.Show)
  }
  function close() {
    return ipcRenderer.invoke('control', Operation.Close)
  }
  function hide() {
    return ipcRenderer.invoke('control', Operation.Hide)
  }
  function minimize() {
    return ipcRenderer.invoke('control', Operation.Minimize)
  }
  function maximize() {
    ipcRenderer.invoke('control', Operation.Maximize)
  }
  function flashFrame() {
    ipcRenderer.invoke('flash-frame')
  }
  function focus() {
    ipcRenderer.invoke('focus')
  }
  ipcRenderer.on('maximize', (_, v) => {
    emitter.emit('maximize', v)
  })
  ipcRenderer.on('minimize', (_, v) => {
    emitter.emit('minimize', v)
  })
  ipcRenderer.on('navigate', (_, route: string) => {
    emitter.emit('navigate', route)
  })
  const emitter = new EventEmitter()

  const writeClipboard =
    clipboard && clipboard.writeText && typeof clipboard.writeText === 'function'
      ? (text: string) => clipboard.writeText(text)
      : (text: string) => ipcRenderer.invoke('write-clipboard', text)

  const writeClipboardImage = (imageUrl: string) => {
    ipcRenderer.invoke('write-clipboard-image', imageUrl)
  }
  const getPathForFile = (file: File) => {
    const legacyPath = (file as File & { path?: string }).path
    return webUtils.getPathForFile(file) || legacyPath || ''
  }

  return {
    on(channel, listener) {
      emitter.on(channel, listener)
      return this
    },
    writeClipboardImage,
    writeClipboard,
    getPathForFile,
    queryAudioPermission: () => ipcRenderer.invoke('query-audio-permission'),
    getMonitors: () => ipcRenderer.invoke('get-monitors'),
    setTranslucent(enable) {
      ipcRenderer.invoke('set-translucent', enable)
    },
    launchExternalApp: (filePath, args) => ipcRenderer.invoke('external-app:launch', filePath, args),
    getExternalAppIcon: (filePath) => ipcRenderer.invoke('external-app:icon', filePath),
    startCpuTrace: () => ipcRenderer.invoke('cpu-trace:start'),
    stopCpuTrace: () => ipcRenderer.invoke('cpu-trace:stop'),
    isCpuTraceRecording: () => ipcRenderer.invoke('cpu-trace:recording'),
    once(channel, listener) {
      emitter.once(channel, listener)
      return this
    },
    removeListener(channel, listener) {
      emitter.removeListener(channel, listener)
      return this
    },
    focus,
    flashFrame,
    minimize,
    maximize,
    show,
    close,
    hide,
    showOpenDialog(...options: any[]) {
      return ipcRenderer.invoke('dialog:showOpenDialog', ...options)
    },
    showSaveDialog(...options: any[]) {
      return ipcRenderer.invoke('dialog:showSaveDialog', ...options)
    },
    findInPage(text, options) {
      return ipcRenderer.invoke('find-in-page', text, options)
    },
    stopFindInPage() {
      return ipcRenderer.invoke('stop-find-in-page')
    },
    startProfiling() {
      return ipcRenderer.invoke('start-profiling')
    },
    stopProfiling() {
      return ipcRenderer.invoke('stop-profiling')
    },
    getNetworkSnapshot: () => ipcRenderer.invoke('nova-network:snapshot'),
    scanWifi: () => ipcRenderer.invoke('nova-network:scan'),
    connectWifi: (ssid, password, security) => ipcRenderer.invoke('nova-network:connect', ssid, password, security),
    disconnectWifi: () => ipcRenderer.invoke('nova-network:disconnect'),
    forgetWifi: (ssid) => ipcRenderer.invoke('nova-network:forget', ssid),
    pingNetworkHosts: (hosts) => ipcRenderer.invoke('nova-network:ping', hosts),
    openNetworkSettings: (target) => {
      void ipcRenderer.invoke('nova-network:open-settings', target)
    },
    relaunchAsAdmin: () => {
      void ipcRenderer.invoke('nova-network:relaunch-admin')
    },
    getNews: (force) => ipcRenderer.invoke('nova-news:list', force === true),
    getSystemStats: () => ipcRenderer.invoke('nova-system:stats'),
    setDesktopWidget: (enabled) => ipcRenderer.invoke('nova-widgets:set', enabled === true),
    getDesktopWidgetState: () => ipcRenderer.invoke('nova-widgets:state'),
    onDesktopWidgetState: (callback) => {
      const listener = (_event: unknown, state: DesktopWidgetState) => callback(state)
      ipcRenderer.on('nova-widgets:state', listener)
      return () => {
        ipcRenderer.removeListener('nova-widgets:state', listener)
      }
    },
    openExternalLink: (url) => {
      void ipcRenderer.invoke('nova-news:open', url)
    },
    openUpdateLauncher: () => ipcRenderer.invoke('nova-updater:open'),
    getUpdateLauncherState: () => ipcRenderer.invoke('nova-updater:state'),
    onUpdateLauncherState: (callback) => {
      const listener = (_event: unknown, state: UpdateLauncherState) => callback(state)
      ipcRenderer.on('nova-updater:state', listener)
      return () => {
        ipcRenderer.removeListener('nova-updater:state', listener)
      }
    },
    checkUpdateInLauncher: () => ipcRenderer.invoke('nova-updater:check'),
    downloadUpdateInLauncher: () => ipcRenderer.invoke('nova-updater:download'),
    installUpdateFromLauncher: () => ipcRenderer.invoke('nova-updater:install'),
    closeUpdateLauncher: () => {
      void ipcRenderer.invoke('nova-updater:close')
    },
    getBatteryState: () => ipcRenderer.invoke('nova-battery:state'),
    refreshBattery: () => ipcRenderer.invoke('nova-battery:refresh'),
    onBatteryState: (callback) => {
      const listener = (_event: unknown, state: BatteryState) => callback(state)
      ipcRenderer.on('nova-battery:state', listener)
      return () => {
        ipcRenderer.removeListener('nova-battery:state', listener)
      }
    },
    setBatteryTrayIcon: (enabled) => ipcRenderer.invoke('nova-battery:set-tray', enabled === true),
    setBatteryAlerts: (enabled) => ipcRenderer.invoke('nova-battery:set-alerts', enabled === true),
    getWindowsUpdateState: () => ipcRenderer.invoke('nova-windows-update:state'),
    scanWindowsUpdates: () => ipcRenderer.invoke('nova-windows-update:scan'),
    installWindowsUpdates: () => ipcRenderer.invoke('nova-windows-update:install'),
    getDeveloperInfo: () => ipcRenderer.invoke('nova-dev:info'),
    openDeveloperTools: () => {
      void ipcRenderer.invoke('nova-dev:devtools')
    },
    openLogsFolder: () => {
      void ipcRenderer.invoke('nova-dev:open-logs')
    },
    openDataFolder: () => {
      void ipcRenderer.invoke('nova-dev:open-data')
    },
    reloadLauncherWindow: () => {
      void ipcRenderer.invoke('nova-dev:reload')
    },
    getAntivirusState: () => ipcRenderer.invoke('nova-antivirus:state'),
    refreshAntivirusStatus: () => ipcRenderer.invoke('nova-antivirus:refresh'),
    scanAntivirus: (scope) => ipcRenderer.invoke('nova-antivirus:scan', scope === 'mods' ? 'mods' : 'quick'),
    cancelAntivirusScan: () => ipcRenderer.invoke('nova-antivirus:cancel'),
    openWindowsSecurity: () => {
      void ipcRenderer.invoke('nova-antivirus:open')
    },
    onAntivirusState: (callback) => {
      const listener = (_event: unknown, state: AntivirusState) => callback(state)
      ipcRenderer.on('nova-antivirus:state', listener)
      return () => {
        ipcRenderer.removeListener('nova-antivirus:state', listener)
      }
    },
    openWindowsUpdateSettings: () => {
      void ipcRenderer.invoke('nova-windows-update:open')
    },
    onWindowsUpdateState: (callback) => {
      const listener = (_event: unknown, state: WindowsUpdateState) => callback(state)
      ipcRenderer.on('nova-windows-update:state', listener)
      return () => {
        ipcRenderer.removeListener('nova-windows-update:state', listener)
      }
    },
  }
}

contextBridge.exposeInMainWorld('windowController', createController())
