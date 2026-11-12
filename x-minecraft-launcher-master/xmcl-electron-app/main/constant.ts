export const IS_DEV = process.env.NODE_ENV === 'development'
export const HAS_DEV_SERVER = !!process.env.HAS_DEV_SERVER
export const HOST = HAS_DEV_SERVER ? 'localhost' : 'xmcl.runtime'

/**
 * Base url of the update API used by this launcher build.
 *
 * Empty means this build has no update channel: REZO-craft preview builds are
 * distributed manually, so we must never query the upstream XMCL service nor
 * let electron-updater install an official build over it.
 */
export const UPDATE_API_BASE = ''

/**
 * GitHub release that hosts the NovaCraft builds.
 *
 * electron-updater reads the `latest.yml` asset of this release, so every
 * published build must upload `latest.yml` and `NovaCraft-Setup-<version>.exe`
 * to the `preview` pre-release (see the release script/README).
 */
export const NOVACRAFT_UPDATE_FEED = {
  provider: 'github',
  owner: 'powercore649',
  repo: 'Rezo-craft',
} as const

/** This build self-updates from the NovaCraft GitHub release. */
export const HAS_UPDATE_FEED = true

export enum AccentState {
  ACCENT_DISABLED = 0,
  ACCENT_ENABLE_GRADIENT = 1,
  ACCENT_ENABLE_TRANSPARENTGRADIENT = 2,
  ACCENT_ENABLE_BLURBEHIND = 3,
  ACCENT_ENABLE_ACRYLICBLURBEHIND = 4,
  ACCENT_ENABLE_HOSTBACKDROP = 5,
  ACCENT_INVALID_STATE = 6,
}

export enum WindowsBuild {
  Windows10Build1903 = 18362,
  Windows10Build1809 = 17763,
  Windows11 = 22000,
  Windows10 = 10240,
}
