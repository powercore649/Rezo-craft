/* eslint-disable no-template-curly-in-string */
import { config as dotenv } from 'dotenv'
import type { Configuration } from 'electron-builder'
import { resolve } from 'path'

dotenv()

const linuxPackageScripts = {
  afterInstall: 'build/linux/after-install.tpl',
  afterRemove: 'build/linux/after-remove.tpl',
  appArmorProfile: 'build/linux/apparmor-profile.tpl',
  fpm: [`--after-upgrade=${resolve(__dirname, 'linux', 'after-install.tpl')}`],
}

export const config = {
  productName: 'NovaCraft',
  appId: 'com.novacraft.launcher',
  directories: {
    output: 'build/output',
    buildResources: 'build',
    app: '.',
  },
  protocols: {
    name: 'NovaCraft',
    schemes: ['xmcl'],
  },
  // Auto-update feed. electron-builder writes these values into the shipped
  // `app-update.yml`, so installed builds look for `latest.yml` on this release.
  publish: [{
    provider: 'github',
    owner: 'powercore649',
    repo: 'Rezo-craft',
    releaseType: 'release',
  }],
  files: [{
    from: 'dist',
    to: '.',
    filter: ['**/*.js', '**/*.ico', '**/*.png', '**/*.webp', '**/*.svg', '*.node', '*.dll', '**/*.html', '**/*.css', '**/*.woff2', '**/*.wasm'],
  }, {
    from: '.',
    to: '.',
    filter: 'package.json',
  }],
  extraResources: [{
    from: 'main/agent-documents',
    to: 'agent-documents',
    filter: ['**/*.md'],
  }],
  artifactName: 'novacraft-${version}-${platform}-${arch}.${ext}',
  appx: {
    displayName: 'NovaCraft',
    applicationId: 'novacraft',
    identityName: 'com.novacraft.launcher',
    backgroundColor: 'transparent',
    publisher: process.env.PUBLISHER,
    publisherDisplayName: 'NovaCraft',
    setBuildNumber: true,
  },
  dmg: {
    artifactName: 'xmcl-${version}-${arch}.${ext}',
    contents: [
      {
        x: 410,
        y: 150,
        type: 'link',
        path: '/Applications',
      },
      {
        x: 130,
        y: 150,
        type: 'file',
      },
    ],
  },
  mac: {
    icon: 'icons/dark.icns',
    darkModeSupport: true,
    target: [
      {
        target: 'dmg',
        arch: ['arm64', 'x64'],
      },
    ],
    extendInfo: {
      NSLocalNetworkUsageDescription: 'XMCL and Minecraft need access to your local network to discover and connect to LAN games and servers.',
      NSMicrophoneUsageDescription: 'A Minecraft mod wants to access your microphone.',
      NSCameraUsageDescription: 'Please give us access to your camera',
      'com.apple.security.device.audio-input': true,
      'com.apple.security.device.camera': true,
    },
  },
  win: {
    // The NovaCraft builds are not code signed, so no publisher name is pinned:
    // electron-updater refuses to install an update whose signature does not
    // match the configured publisher (see the 0.76.0 update failure).
    signtoolOptions: {
      certificateFile: undefined as string | undefined,
    },
    icon: 'icons/dark.ico',
    executableName: 'novacraft',
    // netsh refuses to list or connect Wi-Fi without an elevated process.
    requestedExecutionLevel: 'requireAdministrator',
    electronLanguages: ['en-US'],
    target: [
      {
        target: 'zip',
        arch: [
          'x64',
        ],
      },
      'nsis',
      'appx',
    ],
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'NovaCraft',
    uninstallDisplayName: 'NovaCraft ${version}',
    artifactName: 'NovaCraft-Setup-${version}.${ext}',
    installerIcon: 'icons/dark.ico',
    uninstallerIcon: 'icons/dark.ico',
    installerHeaderIcon: 'icons/dark.ico',
    installerHeader: resolve(__dirname, 'nsis', 'installerHeader.bmp'),
    installerSidebar: resolve(__dirname, 'nsis', 'installerSidebar.bmp'),
    uninstallerSidebar: resolve(__dirname, 'nsis', 'uninstallerSidebar.bmp'),
    deleteAppDataOnUninstall: false,
    runAfterFinish: true,
  },
  linux: {
    executableName: 'xmcl',
    electronLanguages: ['en-US'],
    desktop: {
      entry: {
        MimeType: 'x-scheme-handler/xmcl',
        StartupWMClass: 'xmcl',
      },
    },
    category: 'Game',
    icon: 'icons/dark.icns',
    artifactName: 'xmcl-${version}-${arch}.${ext}',
    target: [
      { target: 'deb', arch: ['x64', 'arm64'] },
      { target: 'rpm', arch: ['x64', 'arm64'] },
      { target: 'AppImage', arch: ['x64', 'arm64'] },
      { target: 'tar.xz', arch: ['x64', 'arm64'] },
      { target: 'pacman', arch: ['x64', 'arm64'] },
    ],
  },
  deb: linuxPackageScripts,
  rpm: linuxPackageScripts,
  pacman: linuxPackageScripts,
  snap: {
    publish: [
      'github',
    ],
  },
} satisfies Configuration
