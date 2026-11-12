const { resolve } = require('path')

/**
 * electron-builder config for the standalone NovaCraft Software Center.
 * It packages only this folder (main + preload + the renderer files copied
 * from the keystone build), so the installer is independent from the launcher.
 */
module.exports = {
  appId: 'com.novacraft.softwarecenter',
  productName: 'NovaCraft Software Center',
  electronVersion: '43.8.1',
  copyright: 'NovaCraft',
  directories: {
    output: resolve(__dirname, '../build-output/software-center'),
    app: __dirname,
  },
  files: [
    'main.js',
    'preload.js',
    'icon.ico',
    'renderer/**/*',
    '!**/*.map',
  ],
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] },
    ],
    icon: resolve(__dirname, '../xmcl-electron-app/build/icon.ico'),
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'NovaCraft Software Center',
    artifactName: 'NovaCraft-Software-Center-Setup-${version}.${ext}',
  },
  portable: {
    artifactName: 'novacraft-software-center-${version}.exe',
  },
}
