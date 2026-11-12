import softwareCenterPreload from '@preload/softwareCenter'
import softwareCenterWinUrl from '@renderer/software-center.html'
import { spawn } from 'child_process'
import { BrowserWindow, app, net, shell } from 'electron'
import { existsSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { ControllerPlugin } from '@/controllers/plugin'
import type { ElectronController } from '@/ElectronController'

const REPO = 'powercore649/Rezo-craft'
const PRODUCT_IDS = ['word', 'sheets', 'slides', 'pdf', 'notes']
const SUITE_INSTALLER_PREFIX = 'NovaCraft-Suite-Setup-'
const SUITE_APP_DIR = 'NovaCraft Suite'
const SUITE_EXE_NAME = 'NovaCraft Suite.exe'
/**
 * NovaCraft Fichiers is a standalone app: it ships in its own release so the
 * launcher release (and its `latest.yml`) stays the update channel.
 */
const FILES_INSTALLER_PREFIX = 'NovaCraft-Files-Setup-'
const FILES_RELEASE_TAG = 'files-v1.0.0'
const FILES_APP_DIR = 'NovaCraft Fichiers'
const FILES_EXE_NAME = 'NovaCraft Fichiers.exe'

interface AppState {
  installed: boolean
  exePath?: string
}

interface CenterState extends AppState {
  files: AppState
}

interface InstallResult {
  ok: boolean
  action?: 'installed' | 'installing'
  error?: string
}

type ProductId = 'suite' | 'files'

/**
 * Locate the standalone Software Center: the per-user NSIS install, a
 * machine-wide install, or the portable executable shipped next to the launcher.
 */
function findStandaloneApp(launcherDir: string): string | undefined {
  const roots = [
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Programs') : undefined,
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
  ].filter((root): root is string => !!root)
  const candidates = roots
    .map((root) => join(root, 'NovaCraft Software Center', 'NovaCraft Software Center.exe'))
    .concat(join(launcherDir, 'NovaCraft Software Center.exe'))
  return candidates.find((candidate) => existsSync(candidate))
}

/** Same lookup for a NovaCraft desktop app installed per user or machine-wide. */
function findApp(launcherDir: string, directory: string, exeName: string): string | undefined {
  const roots = [
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Programs') : undefined,
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
  ].filter((root): root is string => !!root)
  const candidates = roots
    .map((root) => join(root, directory, exeName))
    .concat(join(launcherDir, exeName))
  return candidates.find((candidate) => existsSync(candidate))
}

const userAgent = () =>
  `NovaCraft/${app.getVersion()} (https://github.com/${REPO})`

/**
 * The NovaCraft Software Center: a store for the NovaCraft Suite products plus
 * the standalone NovaCraft Fichiers app.
 *
 * The standalone app is preferred once installed (own window and lifetime);
 * the built-in window is the fallback. Both list the same products, can
 * download an installer from GitHub and start an installed application.
 */
export const softwareCenterController: ControllerPlugin = function (this: ElectronController) {
  let win: BrowserWindow | undefined

  const create = () => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
      return win
    }
    win = new BrowserWindow({
      width: 1080,
      height: 760,
      minWidth: 900,
      minHeight: 620,
      title: 'NovaCraft Software Center',
      backgroundColor: '#0f1117',
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: softwareCenterPreload,
        contextIsolation: true,
        sandbox: true,
      },
    })
    win.on('ready-to-show', () => win?.show())
    win.on('closed', () => {
      win = undefined
    })
    void win.loadURL(softwareCenterWinUrl)
    return win
  }

  const launcherDir = () => dirname(process.execPath)

  const appState = (directory: string, exeName: string): AppState => {
    const exe = findApp(launcherDir(), directory, exeName)
    return exe ? { installed: true, exePath: exe } : { installed: false }
  }

  const state = (): CenterState => ({
    ...appState(SUITE_APP_DIR, SUITE_EXE_NAME),
    files: appState(FILES_APP_DIR, FILES_EXE_NAME),
  })

  const installerUrl = async (tag: string, prefix: string) => {
    const endpoint = tag === 'latest'
      ? `https://api.github.com/repos/${REPO}/releases/latest`
      : `https://api.github.com/repos/${REPO}/releases/tags/${tag}`
    const res = await net.fetch(endpoint, {
      headers: { 'User-Agent': userAgent(), Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json() as { assets?: { name?: string; browser_download_url?: string }[] }
    const asset = (body.assets ?? []).find(
      (item) => typeof item.name === 'string' && item.name.startsWith(prefix),
    )
    if (!asset?.browser_download_url) throw new Error('asset')
    return asset.browser_download_url
  }

  const installProduct = async (id: ProductId): Promise<InstallResult> => {
    const installed = id === 'files'
      ? appState(FILES_APP_DIR, FILES_EXE_NAME).installed
      : appState(SUITE_APP_DIR, SUITE_EXE_NAME).installed
    if (installed) return { ok: true, action: 'installed' }
    const tag = id === 'files' ? FILES_RELEASE_TAG : 'latest'
    const prefix = id === 'files' ? FILES_INSTALLER_PREFIX : SUITE_INSTALLER_PREFIX
    const name = id === 'files' ? 'NovaCraft-Files-Setup' : 'NovaCraft-Suite-Setup'
    try {
      const url = await installerUrl(tag, prefix)
      const res = await net.fetch(url, { headers: { 'User-Agent': userAgent() } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const file = join(app.getPath('temp'), `${name}-${Date.now()}.exe`)
      writeFileSync(file, Buffer.from(await res.arrayBuffer()))
      spawn(file, ['/S'], { detached: true, stdio: 'ignore' }).unref()
      return { ok: true, action: 'installing' }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  this.handle('nova-software-center:open', () => {
    const exe = findStandaloneApp(launcherDir())
    if (exe) {
      spawn(exe, [], { detached: true, stdio: 'ignore' }).unref()
    } else {
      create()
    }
    return true
  })

  this.handle('nova-software-center:close', () => {
    if (win && !win.isDestroyed()) win.close()
  })

  this.handle('nova-software-center:state', () => state())

  this.handle('nova-software-center:install', (_event, id?: string) =>
    installProduct(id === 'files' ? 'files' : 'suite'))

  this.handle('nova-software-center:launch', (_event, id: string) => {
    if (id === 'files') {
      const exe = findApp(launcherDir(), FILES_APP_DIR, FILES_EXE_NAME)
      if (!exe) return false
      spawn(exe, [], { detached: true, stdio: 'ignore' }).unref()
      return true
    }
    if (!PRODUCT_IDS.includes(id)) return false
    const exe = findApp(launcherDir(), SUITE_APP_DIR, SUITE_EXE_NAME)
    if (!exe) return false
    spawn(exe, [`--app=${id}`], { detached: true, stdio: 'ignore' }).unref()
    return true
  })

  this.handle('nova-software-center:open-external', (_event, url: string) => {
    if (typeof url === 'string' && url.startsWith(`https://github.com/${REPO}`)) {
      void shell.openExternal(url)
    }
  })
}
