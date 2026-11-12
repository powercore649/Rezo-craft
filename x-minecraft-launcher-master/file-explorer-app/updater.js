const { app, net } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const { spawn } = require('node:child_process')

const REPO = 'powercore649/Rezo-craft'
const userAgent = () => `NovaCraft-Fichiers/${app.getVersion()} (https://github.com/${REPO})`

const parse = (value) =>
  String(value)
    .replace(/^files-v/i, '')
    .split(/[.+-]/)
    .map((part) => Number.parseInt(part, 10) || 0)
    .slice(0, 3)

const isNewer = (a, b) => {
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) > (b[index] || 0)
  }
  return false
}

async function latestRelease() {
  const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, {
    headers: { 'User-Agent': userAgent(), Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const releases = await res.json()
  const candidates = (Array.isArray(releases) ? releases : [])
    .filter((item) => item && !item.draft && !item.prerelease && /^files-v/i.test(item.tag_name || ''))
    .sort((left, right) => {
      const a = parse(left.tag_name)
      const b = parse(right.tag_name)
      for (let index = 0; index < 3; index += 1) {
        if ((a[index] || 0) !== (b[index] || 0)) return (b[index] || 0) - (a[index] || 0)
      }
      return 0
    })
  return candidates[0]
}

async function check() {
  try {
    const release = await latestRelease()
    if (!release) return { ok: true, available: false, current: app.getVersion() }
    const latest = String(release.tag_name).replace(/^files-v/i, '')
    const asset = (release.assets || []).find(
      (item) => typeof item.name === 'string' && /^NovaCraft-Files-Setup-.*\.exe$/i.test(item.name),
    )
    return {
      ok: true,
      available: Boolean(asset) && isNewer(parse(latest), parse(app.getVersion())),
      current: app.getVersion(),
      latest,
      tag: release.tag_name,
      notes: typeof release.body === 'string' ? release.body.slice(0, 800) : '',
      url: asset ? asset.browser_download_url : '',
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function download(url) {
  if (typeof url !== 'string' || !url.startsWith(`https://github.com/${REPO}`)) {
    return { ok: false, error: 'Adresse de mise à jour invalide' }
  }
  try {
    const res = await net.fetch(url, { headers: { 'User-Agent': userAgent() } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const target = path.join(app.getPath('temp'), `NovaCraft-Files-Setup-${Date.now()}.exe`)
    await fs.writeFile(target, Buffer.from(await res.arrayBuffer()))
    return { ok: true, path: target }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function install(file) {
  if (typeof file !== 'string' || !file.toLowerCase().endsWith('.exe')) {
    return { ok: false, error: 'Installeur introuvable' }
  }
  try {
    spawn(file, ['/S'], { detached: true, stdio: 'ignore' }).unref()
    app.quit()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

module.exports = { check, download, install }
