import { spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { dirname } from 'path'

export interface LaunchExternalAppResult {
  ok: boolean
  error?: 'not-found' | 'spawn-failed'
  message?: string
}

/**
 * Launch an external program (exe, bat, lnk...) detached from the launcher so
 * that closing REZO-craft does not stop the started application.
 */
export function launchExternalApp(filePath: string, args: string[] = []): Promise<LaunchExternalAppResult> {
  return new Promise((resolve) => {
    if (!filePath || !existsSync(filePath)) {
      resolve({ ok: false, error: 'not-found', message: filePath })
      return
    }

    let settled = false
    let child: ChildProcess
    try {
      child = spawn(filePath, args.filter((a) => typeof a === 'string' && a.length > 0), {
        cwd: dirname(filePath),
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      })
    } catch (e) {
      // Some failures (e.g. spawning a non executable file on Windows) throw
      // synchronously instead of emitting an 'error' event.
      resolve({ ok: false, error: 'spawn-failed', message: (e as Error).message })
      return
    }

    child.once('error', (e) => {
      if (settled) return
      settled = true
      resolve({ ok: false, error: 'spawn-failed', message: e.message })
    })
    child.once('spawn', () => {
      if (settled) return
      settled = true
      child.unref()
      resolve({ ok: true })
    })
  })
}
