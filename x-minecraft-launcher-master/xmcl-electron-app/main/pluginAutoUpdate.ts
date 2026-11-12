import { LauncherAppPlugin } from '@xmcl/runtime/app'
import { autoUpdater } from 'electron-updater'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { kSettings } from '~/settings'
import { HAS_UPDATE_FEED, NOVACRAFT_UPDATE_FEED, UPDATE_API_BASE } from './constant'
import { applyAutoUpdateSettings } from './utils/appImageUpdatePolicy'

/**
 * electron-updater reads `publisherName` from the shipped `app-update.yml` and
 * refuses any update whose installer is not signed by that publisher. NovaCraft
 * builds are not code signed, so pinning a publisher makes every download fail
 * with `ERR_UPDATER_INVALID_SIGNATURE`. Drop the key when it is present.
 */
async function dropPinnedPublisher() {
  const file = join(process.resourcesPath ?? '', 'app-update.yml')
  try {
    const content = await readFile(file, 'utf8')
    if (!content.includes('publisherName')) return
    const cleaned = content.replace(/^publisherName:[^\n]*\n(?:[ \t]*-[^\n]*\n)*/m, '')
    if (cleaned !== content) await writeFile(file, cleaned, 'utf8')
  } catch {
    // Read-only installation or development run: nothing to do.
  }
}

export const pluginAutoUpdate: LauncherAppPlugin = async (app) => {
  // E2E hook: skip the auto-updater entirely when running under Playwright.
  // The updater hits real network endpoints and would otherwise add nondeterminism.
  if (process.env.XMCL_E2E) {
    return
  }
  // Without any update channel, leave the electron-updater feed untouched so it
  // can never reach the upstream release server (which would install an official
  // XMCL build over NovaCraft).
  if (!UPDATE_API_BASE && !HAS_UPDATE_FEED) {
    return
  }
  // electron-updater defaults to automatic download/install. Disable both before
  // awaiting settings so a persisted opt-out (or AppImage policy) is effective.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  if (HAS_UPDATE_FEED) {
    // NovaCraft builds are published as GitHub pre-releases of this repo; the
    // provider reads `latest.yml` from the newest pre-release.
    // NovaCraft 1.0 is published as a stable GitHub release, so the updater
    // only offers stable releases from now on.
    autoUpdater.setFeedURL(NOVACRAFT_UPDATE_FEED)
    autoUpdater.allowPrerelease = false
    await dropPinnedPublisher()
  }
  const state = await app.registry.get(kSettings)
  const apply = () => applyAutoUpdateSettings(autoUpdater, state, app.env)
  apply()
  state.subscribe('autoInstallOnAppQuitSet', (value) => {
    applyAutoUpdateSettings(autoUpdater, { ...state, autoInstallOnAppQuit: value }, app.env)
  }).subscribe('allowPrereleaseSet', (value) => {
    // The NovaCraft channel is a pre-release: never drop it silently.
    autoUpdater.allowPrerelease = HAS_UPDATE_FEED ? false : value
  }).subscribe('autoDownloadSet', (value) => {
    applyAutoUpdateSettings(autoUpdater, { ...state, autoDownload: value }, app.env)
  }).subscribe('appImageUpdateModeSet', (mode) => {
    applyAutoUpdateSettings(autoUpdater, { ...state, appImageUpdateMode: mode }, app.env)
    // Force fresh discovery rather than offering an action from the old mode.
    if (app.env === 'appimage') state.updateStatusSet('none')
  }).subscribe('config', (config) => {
    applyAutoUpdateSettings(autoUpdater, config, app.env)
  })
}
