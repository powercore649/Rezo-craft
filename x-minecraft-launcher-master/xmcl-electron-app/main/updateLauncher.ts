import type { UpdateLauncherState } from '@xmcl/runtime-api'
import indexTogetherPreload from '@preload/indexTogether'
import updaterWinUrl from '@renderer/updater.html'
import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { ElectronController } from '@/ElectronController'
import type { ControllerPlugin } from '@/controllers/plugin'

export const NOVA_UPDATER_STATE_CHANNEL = 'nova-updater:state'

/**
 * The NovaCraft update experience.
 *
 * Instead of quitting the launcher the moment an update shows up, this window
 * opens by itself, streams the real download numbers (percent, bytes, speed)
 * and then applies the silent NSIS update on its own: the window closes, the
 * installer runs without a wizard and NovaCraft comes back with the boot splash
 * already on screen, so the restart reads as immediate instead of a blank gap.
 */
export const updateLauncherController: ControllerPlugin = function (this: ElectronController) {
  let win: BrowserWindow | undefined
  let autoInstallTimer: ReturnType<typeof setTimeout> | undefined
  let checking = false
  let installing = false
  let hiddenMain: BrowserWindow | undefined
  let state: UpdateLauncherState = {
    open: false,
    phase: 'idle',
    currentVersion: app.getVersion(),
    percent: 0,
    transferred: 0,
    total: 0,
    bytesPerSecond: 0,
  }

  const snapshot = (): UpdateLauncherState => ({
    ...state,
    currentVersion: app.getVersion(),
    open: !!win && !win.isDestroyed() && win.isVisible(),
  })

  const push = (patch: Partial<UpdateLauncherState>) => {
    state = { ...state, ...patch }
    try {
      this.broadcast(NOVA_UPDATER_STATE_CHANNEL, snapshot())
    } catch {
      // The window may be tearing down while an event arrives.
    }
  }

  const cancelAutoInstall = () => {
    if (autoInstallTimer) {
      clearTimeout(autoInstallTimer)
      autoInstallTimer = undefined
    }
  }

  const showMain = () => {
    const main = hiddenMain
    hiddenMain = undefined
    this.restoreMainWindow(main)
  }

  const create = () => {
    if (win && !win.isDestroyed()) {
      if (!win.isVisible()) win.show()
      win.focus()
      return win
    }
    win = new BrowserWindow({
      width: 620,
      height: 520,
      minWidth: 520,
      minHeight: 460,
      frame: false,
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      show: false,
      title: 'NovaCraft Updater',
      backgroundColor: '#0f1117',
      webPreferences: {
        preload: indexTogetherPreload,
        contextIsolation: true,
        sandbox: true,
      },
    })
    // Keep exactly one window on screen: the updater replaces the launcher
    // while it downloads and installs, instead of stacking on top of it.
    if (!hiddenMain) hiddenMain = this.hideMainWindow()
    win.on('ready-to-show', () => {
      win?.show()
      push({})
    })
    win.on('closed', () => {
      win = undefined
      if (!installing) showMain()
      push({})
    })
    void win.loadURL(updaterWinUrl)
    return win
  }

  /** Close the window first, then let the silent installer replace the app. */
  const install = () => {
    if (installing) return
    installing = true
    cancelAutoInstall()
    push({ phase: 'installing', percent: 100 })
    // Keep the last state on screen long enough to read, then hand over to NSIS.
    setTimeout(() => {
      const target = win
      win = undefined
      if (target && !target.isDestroyed()) target.close()
      setTimeout(() => {
        try {
          // Silent install + relaunch. The new process shows the boot splash at once.
          autoUpdater.quitAndInstall(true, true)
        } catch (e) {
          installing = false
          push({ phase: 'error', error: e instanceof Error ? e.message : String(e) })
        }
      }, 150)
    }, 1200)
  }

  const download = async () => {
    cancelAutoInstall()
    push({
      phase: 'downloading',
      error: undefined,
      percent: state.percent === 100 ? 0 : state.percent,
      transferred: 0,
      total: 0,
      bytesPerSecond: 0,
    })
    try {
      await autoUpdater.downloadUpdate()
    } catch (e) {
      push({ phase: 'error', error: e instanceof Error ? e.message : String(e) })
    }
  }

  autoUpdater.on('checking-for-update', () => {
    push({ phase: 'checking', error: undefined, percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 })
  })
  autoUpdater.on('update-available', (info) => {
    push({
      phase: 'available',
      version: info.version,
      notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      error: undefined,
      percent: 0,
      transferred: 0,
      total: 0,
      bytesPerSecond: 0,
    })
    // Show the update window instead of leaving the user with a closing app.
    create()
    // When automatic download is enabled electron-updater already started it.
    if (!autoUpdater.autoDownload && state.phase !== 'downloading') void download()
  })
  autoUpdater.on('update-not-available', () => {
    push({ phase: 'uptodate', error: undefined, percent: 0 })
  })
  autoUpdater.on('download-progress', (progress) => {
    push({
      phase: 'downloading',
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    push({
      phase: 'ready',
      version: info.version,
      percent: 100,
      transferred: info.files?.[0]?.size ?? state.transferred,
      total: info.files?.[0]?.size ?? state.total,
      bytesPerSecond: 0,
    })
    create()
    // The update is complete: apply it without asking, window closes itself.
    cancelAutoInstall()
    autoInstallTimer = setTimeout(install, 2600)
  })
  autoUpdater.on('error', (error) => {
    cancelAutoInstall()
    push({ phase: 'error', error: error.message })
  })

  this.handle('nova-updater:open', () => {
    create()
    return snapshot()
  })

  this.handle('nova-updater:state', () => snapshot())

  this.handle('nova-updater:check', async () => {
    create()
    if (checking) return snapshot()
    checking = true
    push({ phase: 'checking', error: undefined, percent: 0 })
    try {
      await autoUpdater.checkForUpdates()
    } catch (e) {
      push({ phase: 'error', error: e instanceof Error ? e.message : String(e) })
    } finally {
      checking = false
    }
    return snapshot()
  })

  this.handle('nova-updater:download', async () => {
    create()
    await download()
    return snapshot()
  })

  this.handle('nova-updater:install', () => {
    create()
    if (state.phase === 'ready') {
      install()
    } else if (!checking && state.phase !== 'downloading' && state.phase !== 'installing') {
      // Nothing downloaded yet: run the full automatic flow in the window.
      void (async () => {
        checking = true
        push({ phase: 'checking', error: undefined, percent: 0 })
        try {
          await autoUpdater.checkForUpdates()
        } catch (e) {
          push({ phase: 'error', error: e instanceof Error ? e.message : String(e) })
        } finally {
          checking = false
        }
      })()
    }
    return snapshot()
  })

  this.handle('nova-updater:close', () => {
    cancelAutoInstall()
    if (win && !win.isDestroyed()) win.hide()
    showMain()
    push({})
    return snapshot()
  })

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
}
