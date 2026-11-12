import { basename } from '@/util/basename'
import { useLocalStorage } from '@vueuse/core'
import { reactive, ref } from 'vue'

/**
 * A program of the user's computer launched from the launcher.
 */
export interface ExternalApp {
  id: string
  /** Display name, editable by the user. */
  name: string
  /** Absolute path of the executable or shortcut. */
  path: string
  /** Raw command line arguments, split on launch. */
  args: string
  addedAt: number
}

const STORAGE_KEY = 'externalApps'
/** Native file icons are big data URLs, so they are cached in memory only. */
const iconCache = reactive<Record<string, string>>({})
const pendingIcons = new Map<string, Promise<string>>()

export function createAppId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** `C:\Games\Voyager\voyager.exe` -> `voyager` */
export function defaultAppName(filePath: string) {
  return basename(filePath).replace(/\.(exe|bat|cmd|lnk|com|appref-ms)$/i, '') || basename(filePath)
}

/** Split a raw arguments string the way the Windows shell would. */
export function splitArgs(raw: string) {
  const result: string[] = []
  const regex = /"([^"]*)"|(\S+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(raw)) !== null) {
    const value = match[1] ?? match[2]
    if (value) result.push(value)
  }
  return result
}

export function useExternalApps() {
  const apps = useLocalStorage<ExternalApp[]>(STORAGE_KEY, [], { writeDefaults: false })
  const working = ref('')

  function has(path: string) {
    const normalized = path.toLowerCase()
    return apps.value.some((a) => a.path.toLowerCase() === normalized)
  }

  function add(paths: string[]) {
    const added: ExternalApp[] = []
    for (const path of paths) {
      if (!path || has(path)) continue
      added.push({
        id: createAppId(),
        name: defaultAppName(path),
        path,
        args: '',
        addedAt: Date.now(),
      })
      apps.value = [...apps.value, added[added.length - 1]]
    }
    return added
  }

  function remove(id: string) {
    apps.value = apps.value.filter((a) => a.id !== id)
  }

  function update(id: string, patch: Partial<Pick<ExternalApp, 'name' | 'args'>>) {
    apps.value = apps.value.map((a) => (a.id === id ? { ...a, ...patch } : a))
  }

  async function launch(app: ExternalApp) {
    working.value = app.id
    try {
      return await windowController.launchExternalApp(app.path, splitArgs(app.args))
    } finally {
      working.value = ''
    }
  }

  return {
    apps,
    working,
    add,
    remove,
    update,
    launch,
  }
}

/** Native icon of a program, resolved once per session. */
export function getAppIcon(path: string) {
  const key = path.toLowerCase()
  if (key in iconCache) return Promise.resolve(iconCache[key])
  const pending = pendingIcons.get(key)
  if (pending) return pending
  const promise = windowController
    .getExternalAppIcon(path)
    .then((icon) => {
      iconCache[key] = icon
      return icon
    })
    .catch(() => '')
    .finally(() => pendingIcons.delete(key))
  pendingIcons.set(key, promise)
  return promise
}

export function useAppIcon(path: string) {
  const icon = ref(iconCache[path.toLowerCase()] ?? '')
  if (!icon.value) {
    void getAppIcon(path).then((value) => { icon.value = value })
  }
  return icon
}
