import type { WindowsUpdateItem, WindowsUpdateState } from '@xmcl/runtime-api'
import { execFile, spawn } from 'child_process'
import { shell } from 'electron'
import type { ControllerPlugin } from '@/controllers/plugin'
import type { ElectronController } from '@/ElectronController'

const STATE_CHANNEL = 'nova-windows-update:state'
const SCAN_TIMEOUT = 240_000
const INSTALL_TIMEOUT = 60 * 60_000

/**
 * Reads the pending Windows Update packages through the same COM agent the
 * Settings app uses (`Microsoft.Update.Session`). No extra module, no service
 * to install: PowerShell is already on every Windows machine.
 */
const SCAN_SCRIPT = `$ErrorActionPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$id=[Security.Principal.WindowsIdentity]::GetCurrent()
$elevated=(New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$session=New-Object -ComObject Microsoft.Update.Session
$result=$session.CreateUpdateSearcher().Search('IsInstalled=0 AND IsHidden=0')
$list=@()
foreach ($u in $result.Updates) {
  $list += [pscustomobject]@{ id=[string]$u.Identity.UpdateID; title=[string]$u.Title; kb=@($u.KBArticleIDs); severity=[string]$u.MsrcSeverity; size=[int64]$u.MaxDownloadSize; downloaded=[bool]$u.IsDownloaded; reboot=($u.InstallationBehavior.RebootBehavior -ne 0) }
}
[pscustomobject]@{ elevated=$elevated; updates=@($list) } | ConvertTo-Json -Depth 5 -Compress`

/**
 * Downloads then installs every pending package. The two phase markers on
 * stdout let the UI switch from "downloading" to "installing" in real time.
 */
const INSTALL_SCRIPT = `$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$session=New-Object -ComObject Microsoft.Update.Session
$result=$session.CreateUpdateSearcher().Search('IsInstalled=0 AND IsHidden=0')
if ($result.Updates.Count -eq 0) { [pscustomobject]@{ status='none' } | ConvertTo-Json -Compress; exit 0 }
Write-Output 'NOVA:download'
$downloader=$session.CreateUpdateDownloader()
$downloader.Updates=$result.Updates
$null=$downloader.Download()
Write-Output 'NOVA:install'
$installer=$session.CreateUpdateInstaller()
$installer.Updates=$result.Updates
$result=$installer.Install()
[pscustomobject]@{ status='done'; result=[int]$result.ResultCode; reboot=[bool]$result.RebootRequired } | ConvertTo-Json -Compress`

interface RawItem {
  id?: string
  title?: string
  kb?: string[] | string | null
  severity?: string
  size?: number
  downloaded?: boolean
  reboot?: boolean
}

const empty = (): WindowsUpdateState => ({
  supported: process.platform === 'win32',
  elevated: false,
  phase: 'idle',
  updates: [],
  percent: 0,
  rebootRequired: false,
})

function toItems(raw: RawItem[]): WindowsUpdateItem[] {
  return raw.map((item) => ({
    id: item.id ?? '',
    title: item.title ?? '',
    kb: Array.isArray(item.kb) ? item.kb.map(String) : item.kb ? [String(item.kb)] : [],
    severity: item.severity || undefined,
    size: Number(item.size ?? 0),
    downloaded: item.downloaded === true,
    rebootRequired: item.reboot === true,
  }))
}

function execScript(script: string, timeout: number) {
  return new Promise<string>((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      timeout,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
      encoding: 'utf8',
    }, (error, stdout, stderr) => {
      if (error) {
        const detail = String(stderr ?? '').trim() || error.message
        reject(new Error(detail))
      } else {
        resolve(String(stdout ?? ''))
      }
    })
  })
}

function lastJson(output: string): Record<string, unknown> | undefined {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (!line.startsWith('{')) continue
    try {
      return JSON.parse(line) as Record<string, unknown>
    } catch {
      // Keep looking: PowerShell can interleave warnings.
    }
  }
  return undefined
}

export const windowsUpdateController: ControllerPlugin = function (this: ElectronController) {
  let state: WindowsUpdateState = empty()
  let running = false
  let child: ReturnType<typeof spawn> | undefined

  const snapshot = (): WindowsUpdateState => ({ ...state })

  const publish = (patch: Partial<WindowsUpdateState>) => {
    state = { ...state, ...patch }
    try {
      this.broadcast(STATE_CHANNEL, snapshot())
    } catch {
      // No window is listening yet.
    }
  }

  const scan = async (): Promise<WindowsUpdateState> => {
    if (process.platform !== 'win32') {
      publish({ ...empty(), supported: false })
      return snapshot()
    }
    if (running) return snapshot()
    running = true
    publish({ supported: true, phase: 'scanning', error: undefined, percent: 0 })
    try {
      const output = await execScript(SCAN_SCRIPT, SCAN_TIMEOUT)
      const parsed = lastJson(output)
      const raw = parsed?.updates
      const list = Array.isArray(raw) ? raw as RawItem[] : raw ? [raw as RawItem] : []
      publish({
        supported: true,
        elevated: parsed?.elevated === true,
        phase: 'idle',
        updates: toItems(list),
        percent: 0,
        lastScan: Date.now(),
        error: undefined,
      })
    } catch (e) {
      publish({ phase: 'error', error: e instanceof Error ? e.message : String(e) })
    } finally {
      running = false
    }
    return snapshot()
  }

  const install = async (): Promise<WindowsUpdateState> => {
    if (process.platform !== 'win32') {
      publish({ ...empty(), supported: false })
      return snapshot()
    }
    if (running) return snapshot()
    running = true
    publish({ phase: 'downloading', error: undefined, percent: 0, rebootRequired: false, result: undefined })

    const result = await new Promise<WindowsUpdateState>((resolve) => {
      let buffer = ''
      let timer: ReturnType<typeof setTimeout> | undefined
      const finish = (patch: Partial<WindowsUpdateState>) => {
        if (timer) clearTimeout(timer)
        child = undefined
        running = false
        publish({ percent: 100, ...patch })
        resolve(snapshot())
      }
      try {
        // Elevation is required by the COM installer; the launcher runs elevated.
        child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', INSTALL_SCRIPT], {
          windowsHide: true,
        })
      } catch (e) {
        finish({ phase: 'error', error: e instanceof Error ? e.message : String(e) })
        return
      }
      const proc = child
      const handleLine = (line: string) => {
        const text = line.trim()
        if (text === 'NOVA:download') {
          publish({ phase: 'downloading', percent: 0 })
          return
        }
        if (text === 'NOVA:install') {
          publish({ phase: 'installing', percent: 0 })
          return
        }
        if (!text.startsWith('{')) return
        try {
          const parsed = JSON.parse(text) as { status?: string; result?: number; reboot?: boolean }
          if (parsed.status === 'none') {
            finish({ phase: 'done', result: 'none', updates: [], rebootRequired: false })
            return
          }
          const code = Number(parsed.result ?? 4)
          const mapped = code === 2 ? 'succeeded' : code === 3 ? 'succeededWithErrors' : code === 5 ? 'aborted' : 'failed'
          finish({ phase: 'done', result: mapped, rebootRequired: parsed.reboot === true })
        } catch {
          // Not the final payload yet.
        }
      }
      proc.stdout?.setEncoding('utf8')
      proc.stdout?.on('data', (chunk: string) => {
        buffer += chunk
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() ?? ''
        for (const line of lines) handleLine(line)
      })
      let stderr = ''
      proc.stderr?.setEncoding('utf8')
      proc.stderr?.on('data', (chunk: string) => { stderr += chunk })
      proc.on('error', (e) => finish({ phase: 'error', error: e.message }))
      proc.on('close', (code) => {
        if (buffer) handleLine(buffer)
        if (state.phase === 'done' || state.phase === 'error') return
        finish({
          phase: 'error',
          error: stderr.trim() || `Windows Update a quitté avec le code ${code ?? -1}`,
        })
      })
      timer = setTimeout(() => {
        try {
          proc.kill()
        } catch {
          // Already gone.
        }
        finish({ phase: 'error', error: 'Délai d’installation dépassé' })
      }, INSTALL_TIMEOUT)
    })

    // Refresh the pending list right away so the UI reflects what was installed.
    if (result.phase === 'done' && result.result !== 'none') {
      try {
        const output = await execScript(SCAN_SCRIPT, SCAN_TIMEOUT)
        const parsed = lastJson(output)
        const raw = parsed?.updates
        const list = Array.isArray(raw) ? raw as RawItem[] : raw ? [raw as RawItem] : []
        publish({ updates: toItems(list), elevated: parsed?.elevated === true, lastScan: Date.now() })
      } catch {
        // Keep the install result even if the refresh fails.
      }
    }
    return snapshot()
  }

  this.handle('nova-windows-update:state', () => snapshot())

  this.handle('nova-windows-update:scan', () => scan())

  this.handle('nova-windows-update:install', () => install())

  this.handle('nova-windows-update:cancel', () => {
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

  this.handle('nova-windows-update:open', () => {
    void shell.openExternal('ms-settings:windowsupdate')
  })

  if (process.platform === 'win32') {
    // First paint of the settings page should already have something useful.
    this.app.on('app-booted', () => {
      setTimeout(() => { void scan() }, 4000)
    })
  }
}
