import type { AntivirusState, AntivirusThreat } from '@xmcl/runtime-api'
import { execFile, spawn } from 'child_process'
import { app, shell } from 'electron'
import { existsSync } from 'fs'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { ControllerPlugin } from '@/controllers/plugin'
import type { ElectronController } from '@/ElectronController'

const STATE_CHANNEL = 'nova-antivirus:state'
const STATUS_TIMEOUT = 60_000
const QUICK_TIMEOUT = 45 * 60_000
const FOLDER_TIMEOUT = 20 * 60_000
const MAX_MOD_DIRS = 12

/**
 * NovaCraft does not ship its own malware engine: replacing Microsoft Defender
 * would require a signed kernel driver, ELAM and WHQL validation, and disabling
 * Defender weakens the machine. Instead this page drives the engine Windows
 * already maintains, which keeps signatures and remediation trustworthy.
 */
const STATUS_SCRIPT = `$ErrorActionPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$s=Get-MpComputerStatus
$threats=@()
Get-MpThreat | ForEach-Object {
  $at=0
  if ($_.InitialDetectionTime) { $at=[int64](($_.InitialDetectionTime.ToUniversalTime() - [datetime]'1970-01-01').TotalMilliseconds) }
  $threats += [pscustomobject]@{ id=[string]$_.ThreatID; name=[string]$_.ThreatName; severity=[int]$_.SeverityID; active=[bool]$_.IsActive; path=[string](@($_.Resources) -join '; '); at=$at }
}
[pscustomobject]@{ enabled=[bool]$s.AMServiceEnabled; realtime=[bool]$s.RealTimeProtectionEnabled; tamper=[bool]$s.IsTamperProtected; signature=[string]$s.AntivirusSignatureVersion; signatureAt=$s.AntivirusSignatureLastUpdated; engine=[string]$s.AMEngineVersion; quick=$s.QuickScanStartTime; full=$s.FullScanStartTime; threats=@($threats) } | ConvertTo-Json -Depth 5 -Compress`

interface RawThreat {
  id?: string
  name?: string
  severity?: number
  active?: boolean
  path?: string
  at?: number
}

const empty = (): AntivirusState => ({
  supported: process.platform === 'win32',
  defenderEnabled: false,
  realtimeEnabled: false,
  tamperProtected: false,
  phase: 'idle',
  targets: 0,
  scannedTargets: 0,
  percent: 0,
  found: 0,
  threats: [],
})

/** PowerShell serialises .NET DateTime as `/Date(ms)/` inside JSON. */
function toMs(value: unknown): number | undefined {
  if (typeof value === 'number' && value > 0) return value
  if (typeof value !== 'string' || !value) return undefined
  const match = /\/Date\((-?\d+)\)\//.exec(value)
  if (match) return Number(match[1])
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

function toThreats(raw: RawThreat[]): AntivirusThreat[] {
  return raw.map((item) => ({
    id: item.id ?? '',
    name: item.name ?? 'Menace inconnue',
    severity: Number(item.severity ?? 0),
    active: item.active === true,
    path: item.path || undefined,
    at: Number(item.at ?? 0) || undefined,
  }))
}

function execText(file: string, args: string[], timeout: number) {
  return new Promise<string>((resolve, reject) => {
    execFile(file, args, { timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) reject(new Error(String(stderr ?? '').trim() || error.message))
      else resolve(String(stdout ?? ''))
    })
  })
}

/** Locate MpCmdRun.exe: the stable path first, then the newest platform build. */
function resolveMpCmdRun(): string | undefined {
  const stable = [
    join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Windows Defender', 'MpCmdRun.exe'),
    join(process.env.ProgramData ?? 'C:\\ProgramData', 'Microsoft', 'Windows Defender', 'Platform', 'CurrentVersion', 'MpCmdRun.exe'),
  ]
  for (const candidate of stable) {
    if (existsSync(candidate)) return candidate
  }
  try {
    const base = join(process.env.ProgramData ?? 'C:\\ProgramData', 'Microsoft', 'Windows Defender', 'Platform')
    const versions = require('fs').readdirSync(base) as string[]
    for (const version of versions.filter((name) => /^\d/.test(name)).sort().reverse()) {
      const candidate = join(base, version, 'MpCmdRun.exe')
      if (existsSync(candidate)) return candidate
    }
  } catch {
    // Defender removed or locked down.
  }
  return undefined
}

/** Every `mods` folder under the launcher data, without walking huge caches. */
async function collectModDirs(root: string): Promise<string[]> {
  const out: string[] = []
  const skip = new Set(['cache', 'logs', 'temp', 'runtime', 'jre', 'java', 'assets', 'libraries', 'versions'])
  const walk = async (dir: string, depth: number) => {
    if (depth > 4 || out.length >= MAX_MOD_DIRS) return
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const lower = entry.name.toLowerCase()
      const full = join(dir, entry.name)
      if (lower === 'mods') {
        out.push(full)
        if (out.length >= MAX_MOD_DIRS) return
        continue
      }
      if (skip.has(lower) || lower.startsWith('.')) continue
      await walk(full, depth + 1)
    }
  }
  await walk(root, 0)
  return out
}

export const antivirusController: ControllerPlugin = function (this: ElectronController) {
  let state: AntivirusState = empty()
  let running = false
  let child: ReturnType<typeof spawn> | undefined

  const snapshot = (): AntivirusState => ({ ...state })

  const publish = (patch: Partial<AntivirusState>) => {
    state = { ...state, ...patch }
    try {
      this.broadcast(STATE_CHANNEL, snapshot())
    } catch {
      // No window listening yet.
    }
  }

  const readStatus = async (): Promise<Partial<AntivirusState>> => {
    if (process.platform !== 'win32') return { ...empty(), supported: false }
    try {
      const output = await execText('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', STATUS_SCRIPT], STATUS_TIMEOUT)
      const line = output.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('{')).pop()
      if (!line) throw new Error('Réponse vide de Microsoft Defender')
      const raw = JSON.parse(line) as Record<string, unknown>
      const rawThreats = raw.threats
      const threats = Array.isArray(rawThreats) ? rawThreats as RawThreat[] : rawThreats ? [rawThreats as RawThreat] : []
      return {
        supported: true,
        defenderEnabled: raw.enabled === true,
        realtimeEnabled: raw.realtime === true,
        tamperProtected: raw.tamper === true,
        signatureVersion: typeof raw.signature === 'string' && raw.signature ? raw.signature : undefined,
        signatureAt: toMs(raw.signatureAt),
        engineVersion: typeof raw.engine === 'string' && raw.engine ? raw.engine : undefined,
        lastQuickScanAt: toMs(raw.quick),
        lastFullScanAt: toMs(raw.full),
        threats: toThreats(threats),
        error: undefined,
      }
    } catch (e) {
      return { supported: true, error: e instanceof Error ? e.message : String(e) }
    }
  }

  const refresh = async () => {
    const next = await readStatus()
    publish(next)
    return snapshot()
  }

  const runMpCmdRun = (mp: string, args: string[], timeout: number) => new Promise<number>((resolve) => {
    let settled = false
    const finish = (code: number) => {
      if (settled) return
      settled = true
      child = undefined
      resolve(code)
    }
    try {
      const proc = spawn(mp, args, { windowsHide: true })
      child = proc
      proc.on('error', () => finish(-1))
      proc.on('close', (code) => finish(code ?? -1))
      setTimeout(() => {
        try {
          proc.kill()
        } catch {
          // Already gone.
        }
        finish(-1)
      }, timeout)
    } catch {
      finish(-1)
    }
  })

  const scan = async (scope: 'quick' | 'mods'): Promise<AntivirusState> => {
    if (process.platform !== 'win32') {
      publish({ ...empty(), supported: false })
      return snapshot()
    }
    if (running) return snapshot()
    const mp = resolveMpCmdRun()
    if (!mp) {
      publish({ ...empty(), phase: 'error', error: 'Moteur Microsoft Defender introuvable sur ce système' })
      return snapshot()
    }
    const targets = scope === 'mods' ? await collectModDirs(app.getPath('userData')) : []
    if (scope === 'mods' && !targets.length) {
      publish({ phase: 'done', scope, targets: 0, scannedTargets: 0, percent: 100, found: 0, startedAt: Date.now(), finishedAt: Date.now() })
      return snapshot()
    }
    running = true
    publish({
      phase: 'scanning',
      scope,
      targets: targets.length,
      scannedTargets: 0,
      percent: 0,
      found: 0,
      error: undefined,
      startedAt: Date.now(),
      finishedAt: undefined,
    })
    let found = 0
    let failure: string | undefined
    if (scope === 'quick') {
      const code = await runMpCmdRun(mp, ['-Scan', '-ScanType', '1'], QUICK_TIMEOUT)
      if (code === 2) found = 1
      else if (code !== 0) failure = `MpCmdRun a quitté avec le code ${code}`
    } else {
      for (let i = 0; i < targets.length; i++) {
        const code = await runMpCmdRun(mp, ['-Scan', '-ScanType', '3', '-File', targets[i]], FOLDER_TIMEOUT)
        if (code === 2) found += 1
        else if (code !== 0) failure = `MpCmdRun a quitté avec le code ${code}`
        publish({ scannedTargets: i + 1, percent: Math.round(((i + 1) / targets.length) * 100) })
      }
    }
    running = false
    publish({ phase: failure ? 'error' : 'done', found, finishedAt: Date.now(), percent: 100, error: failure })
    // Pull the authoritative threat list right after the scan.
    const next = await readStatus()
    publish(next)
    return snapshot()
  }

  this.handle('nova-antivirus:state', () => snapshot())

  this.handle('nova-antivirus:refresh', () => refresh())

  this.handle('nova-antivirus:scan', (_event, scope: 'quick' | 'mods') => scan(scope === 'mods' ? 'mods' : 'quick'))

  this.handle('nova-antivirus:cancel', () => {
    if (child) {
      try {
        child.kill()
      } catch {
        // Already finished.
      }
    }
    running = false
    publish({ phase: 'idle', percent: 0 })
    return snapshot()
  })

  this.handle('nova-antivirus:open', () => {
    void shell.openExternal('windowsdefender://threat')
  })

  if (process.platform === 'win32') {
    // Cheap status read so the page opens with real values.
    this.app.on('app-booted', () => {
      setTimeout(() => { void refresh() }, 2500)
    })
  }
}
