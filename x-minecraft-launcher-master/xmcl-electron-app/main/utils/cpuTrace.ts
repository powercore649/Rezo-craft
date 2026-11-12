import { contentTracing } from 'electron'
import { mkdirSync } from 'fs'
import { join } from 'path'

export interface CpuTraceResult {
  ok: boolean
  filePath?: string
  message?: string
}

/**
 * Categories required to open a trace in Chrome DevTools (Performance panel) or
 * Perfetto with the CPU profile included.
 *
 * Recording `'*'` (what the tray used to do) pulls every category, produces
 * hundreds of megabytes and often yields a trace some viewers refuse to open,
 * so we ask for the CPU relevant ones explicitly.
 */
const INCLUDED_CATEGORIES = [
  'toplevel',
  'v8',
  'v8.execute',
  'blink',
  'blink.user_timing',
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'disabled-by-default-v8.cpu_profiler',
  'disabled-by-default-v8.cpu_profiler.hires',
  'viz',
  'cc',
  'gpu',
]

let recording = false

export function isCpuTraceRecording(): boolean {
  return recording
}

export async function startCpuTrace(): Promise<CpuTraceResult> {
  if (recording) {
    return { ok: true }
  }
  try {
    await contentTracing.startRecording({
      included_categories: INCLUDED_CATEGORIES,
      excluded_categories: ['*'],
    })
    recording = true
    return { ok: true }
  } catch (e) {
    recording = false
    return { ok: false, message: (e as Error).message }
  }
}

export async function stopCpuTrace(logRoot: string): Promise<CpuTraceResult> {
  if (!recording) {
    return { ok: false, message: 'No CPU trace is currently recorded' }
  }
  try {
    mkdirSync(logRoot, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const target = join(logRoot, `cpu-trace-${stamp}.json`)
    const written = await contentTracing.stopRecording(target)
    recording = false
    return { ok: true, filePath: written || target }
  } catch (e) {
    recording = false
    return { ok: false, message: (e as Error).message }
  }
}
