import type { DesktopWidgetState } from '@xmcl/runtime-api'
import indexTogetherPreload from '@preload/indexTogether'
import widgetWinUrl from '@renderer/widget.html'
import { app, BrowserWindow, screen } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { ElectronController } from '@/ElectronController'
import { ControllerPlugin } from '@/controllers/plugin'

interface StoredWidgetState {
  enabled: boolean
  x?: number
  y?: number
  width?: number
  height?: number
}

export const NOVA_WIDGET_STATE_CHANNEL = 'nova-widgets:state'

/**
 * Desktop widgets live in their own frameless window. Keeping it open also
 * keeps the launcher alive once the main window is closed, which is what makes
 * the widgets stay on screen after the launcher is "closed".
 */
export const desktopWidgetController: ControllerPlugin = function (this: ElectronController) {
  const stateFile = () => join(app.getPath('userData'), 'desktop-widget.json')

  let win: BrowserWindow | undefined
  let stored: StoredWidgetState = { enabled: false }
  let saveTimer: ReturnType<typeof setTimeout> | undefined

  const snapshot = (): DesktopWidgetState => ({
    enabled: !!win && !win.isDestroyed(),
    visible: !!win && !win.isDestroyed() && win.isVisible(),
  })

  const broadcast = () => {
    const value = snapshot()
    for (const browser of BrowserWindow.getAllWindows()) {
      if (browser.isDestroyed()) continue
      try {
        browser.webContents.send(NOVA_WIDGET_STATE_CHANNEL, value)
      } catch {
        // The window may be tearing down at the same time.
      }
    }
  }

  const readStored = async () => {
    try {
      const raw = await fs.readFile(stateFile(), 'utf8')
      const parsed = JSON.parse(raw) as Partial<StoredWidgetState>
      stored = { ...stored, ...parsed, enabled: parsed.enabled === true }
    } catch {
      // First run, or a corrupted file: keep the defaults.
    }
  }

  const writeStored = async () => {
    try {
      await fs.writeFile(stateFile(), JSON.stringify(stored), 'utf8')
    } catch {
      // A read-only profile must not prevent the widgets from working.
    }
  }

  const captureBounds = () => {
    if (!win || win.isDestroyed()) return
    const bounds = win.getBounds()
    stored = { ...stored, ...bounds }
  }

  const scheduleSave = () => {
    captureBounds()
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      void writeStored()
    }, 400)
  }

  const create = () => {
    if (win && !win.isDestroyed()) {
      if (!win.isVisible()) win.show()
      win.focus()
      broadcast()
      return win
    }

    const area = screen.getPrimaryDisplay().workArea
    const width = stored.width ?? 320
    const height = stored.height ?? 316

    win = new BrowserWindow({
      width,
      height,
      x: stored.x ?? area.x + area.width - width - 24,
      y: stored.y ?? area.y + 24,
      minWidth: 260,
      minHeight: 220,
      frame: false,
      transparent: true,
      resizable: true,
      movable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      show: false,
      title: 'NovaCraft Widgets',
      backgroundColor: '#00000000',
      webPreferences: {
        preload: indexTogetherPreload,
        contextIsolation: true,
        sandbox: true,
      },
    })

    win.setAlwaysOnTop(true, 'floating')
    win.on('ready-to-show', () => {
      if (!win || win.isDestroyed()) return
      win.show()
      broadcast()
    })
    win.on('moved', scheduleSave)
    win.on('resized', scheduleSave)
    win.on('close', () => {
      captureBounds()
      stored.enabled = false
      void writeStored()
    })
    win.on('closed', () => {
      win = undefined
      broadcast()
    })

    void win.loadURL(widgetWinUrl)
    return win
  }

  const destroy = () => {
    const current = win
    win = undefined
    if (current && !current.isDestroyed()) current.destroy()
    broadcast()
  }

  this.handle('nova-widgets:state', () => snapshot())

  this.handle('nova-widgets:set', async (_event, enabled: boolean) => {
    await app.whenReady()
    stored.enabled = enabled === true
    await writeStored()
    if (stored.enabled) create()
    else destroy()
    broadcast()
    return snapshot()
  })

  this.handle('nova-widgets:hide', () => {
    stored.enabled = false
    void writeStored()
    destroy()
    return snapshot()
  })

  void app.whenReady().then(async () => {
    await readStored()
    if (stored.enabled) create()
  })
}
