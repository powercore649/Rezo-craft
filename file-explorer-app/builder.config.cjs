const { resolve } = require('path')

/** electron-builder config for the standalone NovaCraft Fichiers app. */
module.exports = {
  appId: 'com.novacraft.files',
  productName: 'NovaCraft Fichiers',
  electronVersion: '45.3.0',
  copyright: 'NovaCraft',
  directories: {
    output: resolve(__dirname, '../build-output/files'),
    app: __dirname,
  },
  files: [
    'main.js',
    'preload.js',
    'icon.ico',
    'index.html',
    'styles.css',
    'renderer.js',
    'icons.js',
  ],
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] },
    ],
    icon: resolve(__dirname, 'icon.ico'),
    artifactName: 'novacraft-files-${version}-${arch}.${ext}',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'NovaCraft Fichiers',
    artifactName: 'NovaCraft-Files-Setup-${version}.${ext}',
  },
  portable: {
    artifactName: 'novacraft-files-${version}.exe',
  },
}
