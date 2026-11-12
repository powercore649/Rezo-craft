import type { BatteryState } from '@xmcl/runtime-api'
import { execFile } from 'child_process'
import { app, nativeImage, nativeTheme, Notification, powerMonitor, type NativeImage } from 'electron'
import EventEmitter from 'events'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { ControllerPlugin } from '@/controllers/plugin'
import type { ElectronController } from '@/ElectronController'

const SIZE = 32
const POLL_INTERVAL = 60_000
const LOW_THRESHOLD = 20
const STATE_CHANNEL = 'nova-battery:state'

interface Preferences {
  trayIcon: boolean
  alerts: boolean
}

/** Events consumed by the tray plugin so it can own the actual Tray instance. */
export const batteryEvents = new EventEmitter()

const runtime = {
  prefs: { trayIcon: true, alerts: true } as Preferences,
  state: undefined as BatteryState | undefined,
}

export function isBatteryTrayEnabled() {
  return runtime.prefs.trayIcon
}

export function getBatterySnapshot() {
  return runtime.state
}

const EMPTY: BatteryState = {
  supported: false,
  present: false,
  percent: 0,
  charging: false,
  onAc: false,
  timeRemaining: -1,
  trayIcon: true,
  alerts: true,
  at: 0,
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value || 0)))

function execText(file: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    execFile(file, args, { timeout: 8000, windowsHide: true }, (error, stdout) => {
      if (error) reject(error)
      else resolve(String(stdout ?? ''))
    })
  })
}

interface RawBattery {
  present: boolean
  percent: number
  charging: boolean
  onAc: boolean
  timeRemaining: number
  designCapacity?: number
  fullCapacity?: number
  cycleCount?: number
  model?: string
}

const WINDOWS_SCRIPT = [
  "$ErrorActionPreference='SilentlyContinue'",
  '$b = Get-CimInstance -ClassName Win32_Battery | Select-Object -First 1',
  "if ($null -eq $b) { '{\"present\":false}'; exit }",
  '$full = Get-CimInstance -Namespace root/wmi -ClassName BatteryFullChargedCapacity | Select-Object -First 1',
  '$static = Get-CimInstance -Namespace root/wmi -ClassName BatteryStaticData | Select-Object -First 1',
  '$cycle = Get-CimInstance -Namespace root/wmi -ClassName BatteryCycleCount | Select-Object -First 1',
  '[pscustomobject]@{ present = $true; percent = [int]$b.EstimatedChargeRemaining; status = [int]$b.BatteryStatus; runtime = [int]$b.EstimatedRunTime; name = [string]$b.Name; design = [int]$static.DesignedCapacity; full = [int]$full.FullChargedCapacity; cycles = [int]$cycle.CycleCount } | ConvertTo-Json -Compress',
].join('; ')

async function readWindows(): Promise<RawBattery> {
  const output = await execText('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_SCRIPT])
  const raw = JSON.parse(output.trim()) as Record<string, unknown>
  if (raw.present !== true) {
    return { present: false, percent: 0, charging: false, onAc: true, timeRemaining: -1 }
  }
  const status = Number(raw.status ?? 2)
  const percent = clampPercent(Number(raw.percent ?? 0))
  const runtimeMinutes = Number(raw.runtime ?? -1)
  const design = Number(raw.design ?? 0)
  const full = Number(raw.full ?? 0)
  return {
    present: true,
    percent,
    charging: status >= 6 && status <= 9,
    onAc: status !== 1,
    timeRemaining: runtimeMinutes > 0 && runtimeMinutes < 100000 ? runtimeMinutes : -1,
    designCapacity: design > 0 ? design : undefined,
    fullCapacity: full > 0 ? full : undefined,
    cycleCount: Number(raw.cycles ?? 0) > 0 ? Number(raw.cycles) : undefined,
    model: typeof raw.name === 'string' && raw.name ? raw.name : undefined,
  }
}

async function readLinux(): Promise<RawBattery> {
  const base = '/sys/class/power_supply'
  const entries = await fs.readdir(base)
  const battery = entries.find((entry) => entry.startsWith('BAT'))
  if (!battery) return { present: false, percent: 0, charging: false, onAc: true, timeRemaining: -1 }
  const read = async (name: string) => {
    try {
      return (await fs.readFile(join(base, battery, name), 'utf8')).trim()
    } catch {
      return ''
    }
  }
  const percent = clampPercent(Number(await read('capacity')))
  const status = (await read('status')).toLowerCase()
  const energyFull = Number(await read('energy_full'))
  const energyDesign = Number(await read('energy_full_design'))
  const cycles = Number(await read('cycle_count'))
  return {
    present: true,
    percent,
    charging: status === 'charging',
    onAc: status !== 'discharging',
    timeRemaining: -1,
    designCapacity: energyDesign > 0 ? energyDesign : undefined,
    fullCapacity: energyFull > 0 ? energyFull : undefined,
    cycleCount: cycles > 0 ? cycles : undefined,
    model: await read('model_name') || undefined,
  }
}

async function readMac(): Promise<RawBattery> {
  const output = await execText('pmset', ['-g', 'batt'])
  const match = /(\d+)%/.exec(output)
  if (!match) return { present: false, percent: 0, charging: false, onAc: true, timeRemaining: -1 }
  const hours = /(\d+):(\d+) remaining/.exec(output)
  const minutes = hours ? Number(hours[1]) * 60 + Number(hours[2]) : -1
  return {
    present: true,
    percent: clampPercent(Number(match[1])),
    charging: /charging/.test(output) && !/discharging/.test(output),
    onAc: /AC Power/.test(output),
    timeRemaining: minutes,
  }
}

async function readBattery(): Promise<BatteryState> {
  let raw: RawBattery
  try {
    if (process.platform === 'win32') raw = await readWindows()
    else if (process.platform === 'darwin') raw = await readMac()
    else raw = await readLinux()
  } catch {
    return { ...EMPTY, supported: process.platform === 'win32', trayIcon: runtime.prefs.trayIcon, alerts: runtime.prefs.alerts, at: Date.now() }
  }

  const design = raw.designCapacity
  const full = raw.fullCapacity
  return {
    supported: true,
    present: raw.present,
    percent: raw.percent,
    charging: raw.charging,
    onAc: raw.onAc,
    timeRemaining: raw.timeRemaining,
    designCapacity: design,
    fullCapacity: full,
    health: design && full ? Math.round((full / design) * 100) : undefined,
    cycleCount: raw.cycleCount,
    model: raw.model,
    trayIcon: runtime.prefs.trayIcon,
    alerts: runtime.prefs.alerts,
    at: Date.now(),
  }
}

/** Draw a real battery gauge pixel by pixel, so no image assets are required. */
export function drawBatteryIcon(state: BatteryState | undefined, dark = nativeTheme.shouldUseDarkColors): NativeImage {
  const buffer = Buffer.alloc(SIZE * SIZE * 4)
  const ink = dark ? [255, 255, 255] : [26, 30, 40]
  const percent = clampPercent(state?.percent ?? 0)
  const charging = !!state?.charging
  const level = charging ? [34, 197, 94] : percent <= 15 ? [239, 68, 68] : percent <= 30 ? [245, 158, 11] : ink

  const set = (x: number, y: number, color: number[], alpha = 255) => {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
    const index = (y * SIZE + x) * 4
    buffer[index] = color[2]
    buffer[index + 1] = color[1]
    buffer[index + 2] = color[0]
    buffer[index + 3] = alpha
  }

  const inside = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1

  // Body outline (rounded left corners) and the positive terminal cap.
  for (let y = 7; y <= 25; y++) {
    for (let x = 3; x <= 26; x++) {
      const corner = (x < 6 && (y < 10 || y > 22)) || (x > 23 && (y < 10 || y > 22))
      if (corner) continue
      const border = x < 5 || x > 24 || y < 9 || y > 23
      if (border) set(x, y, ink)
    }
  }
  for (let x = 26; x <= 29; x++) {
    for (let y = 13; y <= 19; y++) set(x, y, ink)
  }

  // Charge level inside the body.
  const innerWidth = Math.round((17 * percent) / 100)
  for (let y = 11; y <= 21; y++) {
    for (let x = 6; x < 6 + innerWidth; x++) set(x, y, level)
  }

  if (charging) {
    const bolt = [[19, 9], [12, 17], [16, 17], [14, 24], [21, 15], [17, 15]]
    const inPolygon = (px: number, py: number) => {
      let hit = false
      for (let i = 0, j = bolt.length - 1; i < bolt.length; j = i++) {
        const [xi, yi] = bolt[i]
        const [xj, yj] = bolt[j]
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit
      }
      return hit
    }
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (!inPolygon(x, y)) continue
        const index = (y * SIZE + x) * 4
        buffer[index + 3] = 0
      }
    }
  }

  return nativeImage.createFromBitmap(buffer, { width: SIZE, height: SIZE, scaleFactor: 2 })
}

export const batteryController: ControllerPlugin = function (this: ElectronController) {
  const file = () => join(app.getPath('userData'), 'battery.json')
  let timer: ReturnType<typeof setInterval> | undefined
  let alerted = false

  const loadPrefs = async () => {
    try {
      const parsed = JSON.parse(await fs.readFile(file(), 'utf8')) as Partial<Preferences>
      runtime.prefs = {
        trayIcon: parsed.trayIcon !== false,
        alerts: parsed.alerts !== false,
      }
    } catch {
      // First run: keep the defaults.
    }
  }

  const savePrefs = async () => {
    try {
      await fs.writeFile(file(), JSON.stringify(runtime.prefs), 'utf8')
    } catch {
      // A read-only profile must not break the battery readings.
    }
  }

  const current = (): BatteryState => runtime.state ?? {
    ...EMPTY,
    supported: true,
    trayIcon: runtime.prefs.trayIcon,
    alerts: runtime.prefs.alerts,
  }

  const publish = (state: BatteryState) => {
    runtime.state = state
    batteryEvents.emit('update', state)
    try {
      this.broadcast(STATE_CHANNEL, state)
    } catch {
      // No window is listening yet.
    }
  }

  const notify = (state: BatteryState) => {
    if (!runtime.prefs.alerts || !state.present || state.charging || state.percent > LOW_THRESHOLD) {
      if (state.charging || state.percent > LOW_THRESHOLD + 5) alerted = false
      return
    }
    if (alerted || !Notification.isSupported()) return
    alerted = true
    const french = app.getLocale().toLowerCase().startsWith('fr')
    new Notification({
      title: 'NovaCraft',
      body: french
        ? `Batterie faible : ${state.percent} %. Branche ton chargeur.`
        : `Low battery: ${state.percent}%. Plug in your charger.`,
    }).show()
  }

  const refresh = async () => {
    const state = await readBattery()
    publish(state)
    notify(state)
    return state
  }

  this.handle('nova-battery:state', () => current())
  this.handle('nova-battery:refresh', () => refresh())
  this.handle('nova-battery:set-tray', async (_event, enabled: boolean) => {
    runtime.prefs.trayIcon = enabled === true
    await savePrefs()
    publish({ ...current(), trayIcon: runtime.prefs.trayIcon })
    return current()
  })
  this.handle('nova-battery:set-alerts', async (_event, enabled: boolean) => {
    runtime.prefs.alerts = enabled === true
    await savePrefs()
    publish({ ...current(), alerts: runtime.prefs.alerts })
    return current()
  })

  void app.whenReady().then(async () => {
    await loadPrefs()
    await refresh()
    timer = setInterval(() => { void refresh() }, POLL_INTERVAL)
    powerMonitor.on('on-ac', () => { void refresh() })
    powerMonitor.on('on-battery', () => { void refresh() })
    powerMonitor.on('resume', () => { void refresh() })
    nativeTheme.on('updated', () => {
      batteryEvents.emit('update', current())
    })
    app.on('before-quit', () => {
      if (timer) clearInterval(timer)
    })
  })
}

