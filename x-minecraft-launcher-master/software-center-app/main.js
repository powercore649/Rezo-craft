const { app, BrowserWindow, ipcMain, net, shell } = require('electron')
const { spawn } = require('child_process')
const { existsSync, writeFileSync } = require('fs')
const path = require('path')

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

app.setAppUserModelId('com.novacraft.softwarecenter')

let win

const userAgent = () =>
  `NovaCraft-SoftwareCenter/${app.getVersion()} (https://github.com/${REPO})`

/**
 * NovaCraft apps install per user by default; a machine-wide install or the
 * portable executable next to the Center are also accepted.
 */
function findApp(directory, exeName) {
  const roots = [
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs') : undefined,
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
  ].filter(Boolean)
  const candidates = roots.map((root) => path.join(root, directory, exeName))
  candidates.push(path.join(path.dirname(app.getPath('exe')), exeName))
  return candidates.find((candidate) => existsSync(candidate))
}

function appState(directory, exeName) {
  const exe = findApp(directory, exeName)
  return exe ? { installed: true, exePath: exe } : { installed: false }
}

function centerState() {
  return {
    ...appState(SUITE_APP_DIR, SUITE_EXE_NAME),
    files: appState(FILES_APP_DIR, FILES_EXE_NAME),
  }
}

async function installerUrl(tag, prefix) {
  const endpoint = tag === 'latest'
    ? `https://api.github.com/repos/${REPO}/releases/latest`
    : `https://api.github.com/repos/${REPO}/releases/tags/${tag}`
  const res = await net.fetch(endpoint, {
    headers: { 'User-Agent': userAgent(), Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = await res.json()
  const asset = (body.assets || []).find(
    (item) => typeof item.name === 'string' && item.name.startsWith(prefix),
  )
  if (!asset || typeof asset.browser_download_url !== 'string') throw new Error('asset')
  return asset.browser_download_url
}

async function downloadInstaller(tag, prefix, name) {
  const url = await installerUrl(tag, prefix)
  const res = await net.fetch(url, { headers: { 'User-Agent': userAgent() } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const target = path.join(app.getPath('temp'), `${name}-${Date.now()}.exe`)
  writeFileSync(target, buffer)
  return target
}

async function installProduct(id) {
  const files = id === 'files'
  const state = files
    ? appState(FILES_APP_DIR, FILES_EXE_NAME)
    : appState(SUITE_APP_DIR, SUITE_EXE_NAME)
  if (state.installed) return { ok: true, action: 'installed' }
  try {
    const installer = files
      ? await downloadInstaller(FILES_RELEASE_TAG, FILES_INSTALLER_PREFIX, 'NovaCraft-Files-Setup')
      : await downloadInstaller('latest', SUITE_INSTALLER_PREFIX, 'NovaCraft-Suite-Setup')
    spawn(installer, ['/S'], { detached: true, stdio: 'ignore' }).unref()
    return { ok: true, action: 'installing' }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function launchProduct(id) {
  if (id === 'files') {
    const exe = findApp(FILES_APP_DIR, FILES_EXE_NAME)
    if (!exe) return false
    spawn(exe, [], { detached: true, stdio: 'ignore' }).unref()
    return true
  }
  if (!PRODUCT_IDS.includes(id)) return false
  const exe = findApp(SUITE_APP_DIR, SUITE_EXE_NAME)
  if (!exe) return false
  spawn(exe, [`--app=${id}`], { detached: true, stdio: 'ignore' }).unref()
  return true
}

function createWindow() {
  win = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    title: 'NovaCraft Software Center',
    backgroundColor: '#0f1117',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  })
  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    win = undefined
  })
  void win.loadFile(path.join(__dirname, 'renderer', 'software-center.html'))
}

ipcMain.handle('sc:state', () => centerState())

ipcMain.handle('sc:install', (_event, id) => installProduct(id === 'files' ? 'files' : 'suite'))

ipcMain.handle('sc:launch', (_event, id) => launchProduct(typeof id === 'string' ? id : ''))

ipcMain.handle('sc:open-external', (_event, url) => {
  if (typeof url === 'string' && url.startsWith(`https://github.com/${REPO}`)) {
    void shell.openExternal(url)
  }
})

ipcMain.handle('sc:close', () => {
  if (win) win.close()
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
