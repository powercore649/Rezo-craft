const { app, BrowserWindow, ipcMain, shell } = require('electron')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

app.setAppUserModelId('com.novacraft.files')

let win
let fileClipboard = { mode: '', paths: [] }

const isWin = process.platform === 'win32'

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#202020',
    frame: false,
    show: false,
    title: 'NovaCraft Fichiers',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
    },
  })
  win.once('ready-to-show', () => win.show())
  win.on('maximize', () => win.webContents.send('window:maximized', true))
  win.on('unmaximize', () => win.webContents.send('window:maximized', false))
  win.on('closed', () => {
    win = undefined
  })
  void win.loadFile(path.join(__dirname, 'index.html'))
}

function assertPath(target) {
  if (typeof target !== 'string' || !target || !path.isAbsolute(target)) {
    throw new Error('Chemin invalide')
  }
  return target
}

function validateName(name) {
  const value = String(name || '').trim()
  if (!value || value === '.' || value === '..') throw new Error('Nom invalide')
  if (/[\\/:*?"<>|]/.test(value)) throw new Error('Le nom contient un caractère interdit')
  return value
}

async function exists(target) {
  return fs.access(target).then(() => true, () => false)
}

async function uniqueName(dir, name) {
  const parsed = path.parse(name)
  let candidate = name
  let index = 1
  while (await exists(path.join(dir, candidate))) {
    candidate = `${parsed.name} - Copie${index > 1 ? ` (${index})` : ''}${parsed.ext}`
    index += 1
  }
  return candidate
}

async function listRoots() {
  const home = os.homedir()
  let user = 'Personnel'
  try {
    user = os.userInfo().username
  } catch {
    user = 'Personnel'
  }
  const nav = [
    { id: 'home', label: 'Accueil', path: home, icon: 'home' },
    { id: 'gallery', label: 'Galerie', path: path.join(home, 'Pictures'), icon: 'gallery' },
    { id: 'personal', label: `${user} : personnel`, path: home, icon: 'person' },
  ]
  const places = [
    { label: 'Bureau', path: app.getPath('desktop'), icon: 'desktop' },
    { label: 'Téléchargements', path: app.getPath('downloads'), icon: 'downloads' },
    { label: 'Documents', path: app.getPath('documents'), icon: 'documents' },
    { label: 'Images', path: app.getPath('pictures'), icon: 'images' },
    { label: 'Vidéos', path: app.getPath('videos'), icon: 'videos' },
    { label: 'Musique', path: app.getPath('music'), icon: 'music' },
  ]
  const pinned = []
  try {
    const entries = await fs.readdir(app.getPath('downloads'), { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      pinned.push({ label: entry.name, path: path.join(app.getPath('downloads'), entry.name), icon: 'folder' })
      if (pinned.length >= 6) break
    }
  } catch {
    // Downloads may be unavailable on a locked-down profile.
  }
  return { nav, places, pinned, home }
}

async function listDrives() {
  if (!isWin) return [{ label: '/', path: '/', icon: 'drive' }]
  const drives = []
  for (let code = 65; code <= 90; code += 1) {
    const letter = String.fromCharCode(code)
    const target = `${letter}:\\`
    if (await exists(target)) drives.push({ label: `${letter}:`, path: target, icon: 'drive' })
  }
  return drives
}

async function readDir(target) {
  const dir = assertPath(target)
  const dirents = await fs.readdir(dir, { withFileTypes: true })
  const entries = []
  for (const dirent of dirents.slice(0, 4000)) {
    const full = path.join(dir, dirent.name)
    const stat = await fs.lstat(full).catch(() => null)
    if (!stat) continue
    const isDir = stat.isDirectory()
    entries.push({
      name: dirent.name,
      path: full,
      isDir,
      size: isDir ? 0 : stat.size,
      mtime: stat.mtimeMs,
      ext: isDir ? '' : path.extname(dirent.name).slice(1).toLowerCase(),
    })
  }
  const parsed = path.parse(dir)
  return {
    path: dir,
    parent: parsed.dir === dir ? '' : parsed.dir,
    root: parsed.root,
    name: path.basename(dir) || parsed.root,
    entries,
  }
}

ipcMain.handle('roots:list', async () => {
  const roots = await listRoots()
  return { ...roots, drives: await listDrives() }
})

ipcMain.handle('fs:list', (_event, target) => readDir(target))

ipcMain.handle('fs:open', async (_event, target) => {
  const value = assertPath(target)
  const error = await shell.openPath(value)
  return error || ''
})

ipcMain.handle('fs:reveal', (_event, target) => {
  shell.showItemInFolder(assertPath(target))
  return true
})

ipcMain.handle('fs:recycle-bin', async () => {
  await shell.openPath(isWin ? 'shell:RecycleBinFolder' : '')
  return true
})

ipcMain.handle('fs:network', async () => {
  await shell.openPath(isWin ? 'shell:NetworkPlacesFolder' : '')
  return true
})

ipcMain.handle('fs:trash', async (_event, targets) => {
  const list = Array.isArray(targets) ? targets : [targets]
  for (const target of list) await shell.trashItem(assertPath(target))
  return list.length
})

ipcMain.handle('fs:rename', async (_event, target, name) => {
  const value = assertPath(target)
  const next = validateName(name)
  const destination = path.join(path.dirname(value), next)
  if (destination === value) return value
  if (await exists(destination)) throw new Error('Ce nom est déjà utilisé')
  await fs.rename(value, destination)
  return destination
})

ipcMain.handle('fs:mkdir', async (_event, dir, name) => {
  const base = assertPath(dir)
  const next = validateName(name || 'Nouveau dossier')
  const destination = path.join(base, next)
  await fs.mkdir(destination)
  return destination
})

ipcMain.handle('fs:new-file', async (_event, dir, name) => {
  const base = assertPath(dir)
  const next = validateName(name || 'Nouveau document texte.txt')
  const destination = path.join(base, next)
  await fs.writeFile(destination, '', { flag: 'wx' })
  return destination
})

ipcMain.handle('fs:clipboard', (_event, mode, targets) => {
  const list = Array.isArray(targets) ? targets.filter((item) => typeof item === 'string') : []
  fileClipboard = { mode: mode === 'cut' ? 'cut' : 'copy', paths: list }
  return fileClipboard.paths.length
})

ipcMain.handle('fs:paste', async (_event, dir) => {
  const base = assertPath(dir)
  let count = 0
  for (const source of fileClipboard.paths) {
    if (!(await exists(source))) continue
    const name = await uniqueName(base, path.basename(source))
    const destination = path.join(base, name)
    if (fileClipboard.mode === 'cut') await fs.rename(source, destination)
    else await fs.cp(source, destination, { recursive: true })
    count += 1
  }
  if (fileClipboard.mode === 'cut') fileClipboard = { mode: '', paths: [] }
  return count
})

ipcMain.handle('fs:info', async (_event, target) => {
  const value = assertPath(target)
  const stat = await fs.stat(value)
  return {
    path: value,
    name: path.basename(value),
    isDir: stat.isDirectory(),
    size: stat.size,
    mtime: stat.mtimeMs,
    created: stat.birthtimeMs,
    ext: stat.isDirectory() ? '' : path.extname(value).slice(1).toLowerCase(),
  }
})

ipcMain.handle('window:minimize', () => {
  win?.minimize()
  return true
})

ipcMain.handle('window:toggle-maximize', () => {
  if (!win) return false
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
  return win.isMaximized()
})

ipcMain.handle('window:close', () => {
  win?.close()
  return true
})

ipcMain.handle('window:is-maximized', () => Boolean(win?.isMaximized()))

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
