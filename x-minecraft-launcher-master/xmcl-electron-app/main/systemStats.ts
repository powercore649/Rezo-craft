import type { SystemDiskStats, SystemNetworkStats, SystemStats } from '@xmcl/runtime-api'
import { execFile } from 'child_process'
import { statfsSync } from 'fs'
import { cpus, freemem, totalmem, uptime } from 'os'

interface CpuTimes {
  idle: number
  total: number
}

interface NetworkCounters {
  received: number
  sent: number
}

let previousCpu: CpuTimes | undefined
let previousCounters: { at: number; counters: NetworkCounters } | undefined
let previousRate: { at: number; stats: SystemNetworkStats } | undefined

const HARDWARE_TTL = 5 * 60_000
const COUNTER_TTL = 2_000

let hardware: { at: number; gpu?: string; disks: SystemDiskStats[] } | undefined
let counters: { at: number; value: NetworkCounters } | undefined

function ps(script: string, timeout = 15000): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `$ProgressPreference='SilentlyContinue';[Console]::OutputEncoding=[Text.Encoding]::UTF8;${script}`,
      ],
      { windowsHide: true, encoding: 'utf8', timeout, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) => resolve(error ? '' : (stdout ?? '')),
    )
  })
}

function round(value: number) {
  return Math.round(value * 10) / 10
}

function sampleCpu(): CpuTimes {
  let idle = 0
  let total = 0
  for (const cpu of cpus()) {
    for (const value of Object.values(cpu.times)) total += value
    idle += cpu.times.idle
  }
  return { idle, total }
}

function readSystemDisk(): SystemDiskStats[] {
  if (process.platform !== 'win32') return []
  try {
    const root = `${(process.env.SystemDrive ?? 'C:').replace(/\\$/, '')}\\`
    const stats = statfsSync(root)
    return [{ name: root.slice(0, 2), total: stats.blocks * stats.bsize, free: stats.bavail * stats.bsize }]
  } catch {
    return []
  }
}

interface HardwareJson {
  gpu?: string | string[]
  disks?: { name?: string; total?: number; free?: number } | { name?: string; total?: number; free?: number }[]
}

async function getHardware(): Promise<{ gpu?: string; disks: SystemDiskStats[] }> {
  if (hardware && Date.now() - hardware.at < HARDWARE_TTL) return hardware
  const fallback = readSystemDisk()

  if (process.platform === 'win32') {
    const script = [
      '$g=@(Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name);',
      '$d=@(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object { [pscustomobject]@{ name=$_.DeviceID; total=[double]$_.Size; free=[double]$_.FreeSpace } });',
      '[pscustomobject]@{ gpu=$g; disks=$d } | ConvertTo-Json -Compress -Depth 4',
    ].join('')
    const raw = (await ps(script)).trim()
    if (raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw) as HardwareJson
        const gpus = Array.isArray(parsed.gpu) ? parsed.gpu : parsed.gpu ? [parsed.gpu] : []
        const rawDisks = parsed.disks === undefined ? [] : Array.isArray(parsed.disks) ? parsed.disks : [parsed.disks]
        const disks = rawDisks
          .filter((disk): disk is { name: string; total: number; free: number } =>
            typeof disk.name === 'string' && typeof disk.total === 'number' && typeof disk.free === 'number' && disk.total > 0)
          .map((disk) => ({ name: disk.name, total: disk.total, free: disk.free }))
        hardware = { at: Date.now(), gpu: gpus.find(Boolean), disks: disks.length ? disks : fallback }
        return hardware
      } catch {
        // Fall through to the plain Node reading.
      }
    }
  }

  hardware = { at: Date.now(), disks: fallback }
  return hardware
}

async function readCounters(): Promise<NetworkCounters | undefined> {
  if (process.platform !== 'win32') return undefined
  if (counters && Date.now() - counters.at < COUNTER_TTL) return counters.value
  // `-Physical` does not exist on this cmdlet (Windows ARM builds reject it),
  // so the counters of every adapter are summed instead.
  const script = [
    '$a=@(Get-NetAdapterStatistics -ErrorAction SilentlyContinue);',
    '$r=($a | Measure-Object ReceivedBytes -Sum).Sum;',
    '$t=($a | Measure-Object SentBytes -Sum).Sum;',
    'if($null -eq $r){$r=0};if($null -eq $t){$t=0};',
    '[pscustomobject]@{ received=[double]$r; sent=[double]$t } | ConvertTo-Json -Compress',
  ].join('')
  const raw = (await ps(script, 12000)).trim()
  if (!raw.startsWith('{')) return counters?.value
  try {
    const parsed = JSON.parse(raw) as { received?: number; sent?: number }
    if (typeof parsed.received !== 'number' || typeof parsed.sent !== 'number') return counters?.value
    counters = { at: Date.now(), value: { received: parsed.received, sent: parsed.sent } }
    return counters.value
  } catch {
    return counters?.value
  }
}

async function readNetwork(): Promise<SystemNetworkStats> {
  const value = await readCounters()
  const now = Date.now()
  if (!value) return { down: 0, up: 0, received: 0, sent: 0 }

  const previousSample = previousCounters
  previousCounters = { at: now, counters: value }

  // Rates need two samples; keep the last known rate for the first read.
  if (!previousSample || now - previousSample.at < 250) {
    return previousRate?.stats ?? { down: 0, up: 0, received: value.received, sent: value.sent }
  }

  const seconds = (now - previousSample.at) / 1000
  const down = Math.max(0, value.received - previousSample.counters.received) / seconds
  const up = Math.max(0, value.sent - previousSample.counters.sent) / seconds
  const stats: SystemNetworkStats = { down, up, received: value.received, sent: value.sent }
  previousRate = { at: now, stats }
  return stats
}

/**
 * Snapshot of the machine running the launcher. Every metric is best effort: a
 * failing CIM query only drops the affected field instead of the whole widget.
 */
export async function getSystemStats(): Promise<SystemStats> {
  const sample = sampleCpu()
  let usage = 0
  if (previousCpu && sample.total > previousCpu.total) {
    const totalDelta = sample.total - previousCpu.total
    const idleDelta = sample.idle - previousCpu.idle
    usage = Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100))
  }
  previousCpu = sample

  const memoryTotal = totalmem()
  const memoryUsed = memoryTotal - freemem()
  const info = await getHardware()
  const network = await readNetwork()
  const model = cpus()[0]?.model?.replace(/\s+/g, ' ').trim() ?? ''

  return {
    supported: process.platform === 'win32',
    cpu: { model, cores: cpus().length, usage: round(usage) },
    memory: { total: memoryTotal, used: memoryUsed },
    disks: info.disks,
    gpu: info.gpu,
    uptime: uptime(),
    network,
    at: Date.now(),
  }
}
