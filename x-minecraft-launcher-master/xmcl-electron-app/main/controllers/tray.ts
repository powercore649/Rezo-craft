import type { BatteryState } from '@xmcl/runtime-api'
import { batteryEvents, drawBatteryIcon, getBatterySnapshot, isBatteryTrayEnabled } from '@/battery'
import { ElectronController } from '@/ElectronController'
import { darkIcon, darkTray, lightIcon, lightTray } from '@/utils/icons'
import { BaseService } from '@xmcl/runtime/app'
import { app, dialog, Menu, Tray, nativeTheme, nativeImage, MenuItemConstructorOptions, shell } from 'electron'
import { ControllerPlugin } from './plugin'
import { kSettings } from '@xmcl/runtime/settings'
import { isCpuTraceRecording, startCpuTrace, stopCpuTrace } from '@/utils/cpuTrace'

export const trayPlugin: ControllerPlugin = function (this: ElectronController) {
  const { t } = this.i18n
  let trayIcons = { dark: darkTray, light: lightTray }
  const toggleTracing = async () => {
    if (!isCpuTraceRecording()) {
      const result = await startCpuTrace()
      if (!result.ok) {
        dialog.showErrorBox(t('cpuTrace.title'), t('cpuTrace.startFailed', { reason: result.message ?? '' }))
      }
    } else {
      const result = await stopCpuTrace(app.getPath('logs'))
      if (result.ok && result.filePath) {
        shell.showItemInFolder(result.filePath)
      } else {
        dialog.showErrorBox(t('cpuTrace.title'), t('cpuTrace.stopFailed', { reason: result.message ?? '' }))
      }
    }
    this.tray?.setContextMenu(createMenu())
  }
  // nativeTheme.addListener('updated', () => {
  //   if (nativeTheme.shouldUseDarkColors) {

  //   } else {

  //   }
  // })
  let checkUpdate: (() => void) | undefined
  const createMenu = () => {
    const app = this.app
    const onBrowseAppClicked = () => {
      if (this.browserRef && !this.browserRef.isDestroyed()) {
        this.browserRef.show()
      } else {
        this.createBrowseWindow()
      }
    }
    const diagnose = () => {
      this.openDevTools()
    }
    const showLogs = () => {
      // shell.openPath(this.app.logManager.getLogRoot())
    }
    const options: MenuItemConstructorOptions[] = [
      {
        type: 'normal',
        label: t('checkUpdate'),
        click: () => {
          checkUpdate?.()
        },
        enabled: !!checkUpdate,
      },
      {
        label: t('multiplayer'),
        type: 'normal',
        click: () => {
          this.openMultiplayer()
        },
      },
      {
        label: t('makeDesktopShortcut'),
        type: 'normal',
        click: () => {
          this.app.registry.get(BaseService).then(service => service.makeDesktopShortcut())
        },
      },
      // {
      //   label: t('browseApps'),
      //   type: 'normal',
      //   click: onBrowseAppClicked,
      // },
      { type: 'separator' },
      // {
      //   label: t('showLogsFolder'),
      //   type: 'normal',
      //   click: showLogs,
      // },
      {
        label: t('showDiagnosis'),
        type: 'normal',
        click: () => {
          diagnose()
        },
        role: 'toggleDevTools',
      },
      {
        label: isCpuTraceRecording() ? t('cpuTrace.stop') : t('cpuTrace.start'),
        type: 'normal',
        click: () => {
          toggleTracing()
        },
      },
      {
        label: t('relaunch'),
        type: 'normal',
        click() {
          app.relaunch()
        },
      },
      {
        label: t('quit'),
        type: 'normal',
        click() {
          app.quit()
        },
      },
    ]
    const show = () => {
      const window = this.mainWin
      if ((!window || window.isDestroyed()) && this.activatedManifest) {
        this.activate(this.activatedManifest)
      } else {
        window?.show()
        if (this.maximized) {
          window?.maximize()
        }
      }
    }
    options.unshift({
      label: t('showLauncher'),
      type: 'normal',
      click: () => {
        show()
      },
    })
    return Menu.buildFromTemplate(options)
  }

  const getTrayImage = (dark: string, light: string) => {
    const path = nativeTheme.shouldUseDarkColors ? dark : light
    if (this.app.platform.os === 'osx') {
      const icon = nativeImage.createFromPath(path)
      return icon.resize({ width: 20, height: 20 })
    }
    return path
  }

  this.app.waitEngineReady().then(async () => {
    const tray = new Tray(getTrayImage(darkTray, lightTray))
    this.tray = tray

    // The battery gauge can take over the tray icon; the tray plugin stays the
    // single owner of the Tray instance, the battery module only emits state.
    const showBatteryIcon = (state: BatteryState | undefined) => {
      if (!isBatteryTrayEnabled() || !state?.present) return false
      try {
        tray.setImage(drawBatteryIcon(state))
      } catch {
        tray.setImage(getTrayImage(trayIcons.dark, trayIcons.light))
      }
      tray.setToolTip(`NovaCraft \u00b7 ${state.percent} %${state.charging ? ' \u26a1' : ''}`)
      return true
    }
    batteryEvents.on('update', (state: BatteryState) => {
      if (showBatteryIcon(state)) return
      tray.setImage(getTrayImage(trayIcons.dark, trayIcons.light))
      tray.setToolTip(t('title'))
    })
    showBatteryIcon(getBatterySnapshot())

    this.app.registry.get(BaseService).then(service => {
      checkUpdate = () => service.checkUpdate()
      tray.setContextMenu(createMenu())
    })
    this.app.registry.get(kSettings).then(state => {
      state.subscribe('config', () => {
        tray.setToolTip(t('title'))
        tray.setContextMenu(createMenu())
      }).subscribe('localeSet', () => {
        tray.setToolTip(t('title'))
        tray.setContextMenu(createMenu())
      })
    })

    if (this.app.platform.os === 'windows') {
      tray.on('double-click', () => {
        const window = this.mainWin
        if (window) {
          if (window.isVisible()) {
            window.focus()
          } else {
            window.show()
            if (this.maximized) {
              window.maximize()
            }
          }
        }
      })
    }

    tray.setToolTip(t('title'))
    tray.setContextMenu(createMenu())

    if (app.dock) {
      app.on('activate', () => {
        if (this.mainWin && !this.mainWin.isDestroyed()) {
          this.mainWin?.show()
        } else if (this.activatedManifest) {
          this.activate(this.activatedManifest, false)
        }
      })
    }
    app.on('before-quit', () => {
      this.tray?.destroy()
    })
  })

  this.app.on('app-booted', (man) => {
    trayIcons = { dark: man.iconSets.darkTrayIcon, light: man.iconSets.trayIcon }
    if (isBatteryTrayEnabled() && getBatterySnapshot()?.present) return
    this.tray?.setImage(getTrayImage(trayIcons.dark, trayIcons.light))
  })
}
