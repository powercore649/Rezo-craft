const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

const APPS = {
  word: 'NovaCraft Word',
  sheets: 'NovaCraft Sheets',
  slides: 'NovaCraft Slides',
  pdf: 'NovaCraft PDF',
  notes: 'NovaCraft Notes',
}

const requested = process.argv.find((arg) => arg.startsWith('--app='))
const initialApp = requested ? requested.slice('--app='.length) : ''
const knownApp = Object.prototype.hasOwnProperty.call(APPS, initialApp) ? initialApp : ''

app.setAppUserModelId('com.novacraft.suite')

let win
let pdfWindows = []

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    title: knownApp ? APPS[knownApp] : 'NovaCraft Suite',
    backgroundColor: '#0f1117',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
    },
  })
  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    win = undefined
  })
  void win.loadFile(path.join(__dirname, 'shell.html'), {
    query: knownApp ? { app: knownApp } : {},
  })
}

async function writeTemp(prefix, html) {
  const file = path.join(os.tmpdir(), `novacraft-${prefix}-${Date.now()}.html`)
  await fs.writeFile(file, html, 'utf8')
  return file
}

function openPdfWindow(file) {
  const view = new BrowserWindow({
    width: 1120,
    height: 820,
    title: path.basename(file),
    backgroundColor: '#202124',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.ico'),
  })
  void view.loadURL(`file://${file.split(path.sep).join('/')}`)
  pdfWindows.push(view)
  view.on('closed', () => {
    pdfWindows = pdfWindows.filter((window) => window !== view)
  })
  return file
}

ipcMain.handle('suite:version', () => app.getVersion())

ipcMain.handle('suite:open-text', async (_event, spec) => {
  const result = await dialog.showOpenDialog(win, {
    filters: Array.isArray(spec && spec.filters) ? spec.filters : undefined,
    properties: ['openFile'],
  })
  if (result.canceled || !result.filePaths[0]) return null
  const file = result.filePaths[0]
  const content = await fs.readFile(file, 'utf8')
  return { path: file, name: path.basename(file), content }
})

ipcMain.handle('suite:save-text', async (_event, spec) => {
  const result = await dialog.showSaveDialog(win, {
    defaultPath: (spec && spec.defaultName) || 'sans-titre',
    filters: Array.isArray(spec && spec.filters) ? spec.filters : undefined,
  })
  if (result.canceled || !result.filePath) return null
  await fs.writeFile(result.filePath, String((spec && spec.content) || ''), 'utf8')
  return result.filePath
})

ipcMain.handle('suite:export-pdf', async (_event, spec) => {
  const html = spec && typeof spec.html === 'string' ? spec.html : ''
  if (!html) return null
  const result = await dialog.showSaveDialog(win, {
    defaultPath: (spec && spec.defaultName) || 'document.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (result.canceled || !result.filePath) return null
  const temp = await writeTemp('print', html)
  const printer = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true },
  })
  try {
    await printer.loadFile(temp)
    const pdf = await printer.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { marginType: 'default' },
    })
    await fs.writeFile(result.filePath, pdf)
    return result.filePath
  } finally {
    if (!printer.isDestroyed()) printer.destroy()
    await fs.rm(temp, { force: true })
  }
})

ipcMain.handle('suite:present', async (_event, spec) => {
  const html = spec && typeof spec.html === 'string' ? spec.html : ''
  if (!html) return false
  const temp = await writeTemp('present', html)
  const view = new BrowserWindow({
    fullscreen: true,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: { sandbox: true },
  })
  view.setMenuBarVisibility(false)
  view.on('closed', () => {
    void fs.rm(temp, { force: true })
  })
  await view.loadFile(temp)
  return true
})

ipcMain.handle('suite:open-pdf', async () => {
  const result = await dialog.showOpenDialog(win, {
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    properties: ['openFile'],
  })
  if (result.canceled || !result.filePaths[0]) return null
  return openPdfWindow(result.filePaths[0])
})

ipcMain.handle('suite:open-pdf-file', async (_event, file) => {
  if (typeof file !== 'string' || !file.toLowerCase().endsWith('.pdf')) return null
  const exists = await fs.access(file).then(() => true, () => false)
  if (!exists) return null
  return openPdfWindow(file)
})

ipcMain.handle('suite:open-external', (_event, url) => {
  if (typeof url === 'string' && url.startsWith('https://')) {
    void shell.openExternal(url)
  }
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
