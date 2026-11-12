const { resolve } = require('path')

/**
 * electron-builder config for NovaCraft Suite: one installer that carries the
 * five productivity apps. Each app keeps its own
 * window through `--app=<id>`.
 */
module.exports = {
  appId: 'com.novacraft.suite',
  productName: 'NovaCraft Suite',
  electronVersion: '43.8.1',
  copyright: 'NovaCraft',
  directories: {
    output: resolve(__dirname, '../build-output/suite'),
    app: __dirname,
  },
  files: [
    'main.js',
    'preload.js',
    'icon.ico',
    'shell.html',
    'styles.css',
    'shell.js',
    'apps/**/*',
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
    shortcutName: 'NovaCraft Suite',
    artifactName: 'NovaCraft-Suite-Setup-${version}.${ext}',
  },
  portable: {
    artifactName: 'novacraft-suite-${version}.exe',
  },
}
