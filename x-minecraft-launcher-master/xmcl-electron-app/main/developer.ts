import type { DeveloperInfo } from '@xmcl/runtime-api'
import { app, BrowserWindow, shell } from 'electron'
import type { ControllerPlugin } from '@/controllers/plugin'
import type { ElectronController } from '@/ElectronController'

const logsPath = () => {
  try {
    return app.getPath('logs')
  } catch {
    return app.getPath('userData')
  }
}

/** Support tools for the Settings → Developer section. */
export const developerController: ControllerPlugin = function (this: ElectronController) {
  this.handle('nova-dev:info', (): DeveloperInfo => ({
    appVersion: app.getVersion(),
    electron: process.versions.electron ?? '',
    chrome: process.versions.chrome ?? '',
    node: process.versions.node ?? '',
    platform: `${process.platform} ${process.arch}`,
    dataPath: app.getPath('userData'),
    logsPath: logsPath(),
    locale: app.getLocale(),
  }))

  this.handle('nova-dev:open-logs', async () => {
    await shell.openPath(logsPath())
  })

  this.handle('nova-dev:open-data', async () => {
    await shell.openPath(app.getPath('userData'))
  })

  this.handle('nova-dev:devtools', () => {
    this.openDevTools()
  })

  this.handle('nova-dev:reload', () => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.reload()
    }
  })
}
