import { useService } from '@/composables'
import { injection } from '@/util/inject'
import { BaseServiceKey, Environment, Settings } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { kEnvironment } from './environment'
import { useState } from './syncableState'
import { useUpdateCapability } from './updateCapability'

export const kUpdateSettings: InjectionKey<ReturnType<typeof useUpdateSettings>> = Symbol('UpdateSettings')

export function useUpdateSettings() {
  const { checkUpdate } = useService(BaseServiceKey)
  const env: Ref<Environment | undefined> = injection(kEnvironment)
  const { state } = injection(kSettingsState)
  const updateStatus = computed(() => state.value?.updateStatus)
  const updateInfo = computed(() => state.value?.updateInfo)
  const version = computed(() => env.value?.version ?? '0.0.0')
  const installing = ref(false)
  /** Last download/install failure, surfaced by the update manager. */
  const actionError = ref<string | null>(null)
  /** Automatic update behaviour, backed by the persisted launcher settings. */
  const autoDownload = computed({
    get: () => state.value?.autoDownload ?? false,
    set: (v) => state.value?.autoDownloadSet(v),
  })
  const autoInstallOnAppQuit = computed({
    get: () => state.value?.autoInstallOnAppQuit ?? false,
    set: (v) => state.value?.autoInstallOnAppQuitSet(v),
  })
  function errorMessage(e: unknown) {
    if (e instanceof Error) return e.message
    if (typeof e === 'string') return e
    return 'Unknown error'
  }
  async function install() {
    installing.value = true
    actionError.value = null
    try {
      // NovaCraft owns the update UX: its window streams the progress and
      // restarts the launcher itself, instead of closing the app silently.
      await windowController.installUpdateFromLauncher()
    } catch (e) {
      actionError.value = errorMessage(e)
    } finally {
      installing.value = false
    }
  }

  const downloadingUpdate = ref(false)
  async function download() {
    downloadingUpdate.value = true
    actionError.value = null
    try {
      await windowController.downloadUpdateInLauncher()
    } catch (e) {
      actionError.value = errorMessage(e)
    } finally {
      downloadingUpdate.value = false
    }
  }

  const capability = useUpdateCapability(state, checkUpdate)

  return {
    version,
    quitAndInstall: install,
    downloadUpdate: download,
    ...capability,
    installing,
    updateStatus,
    downloadingUpdate,
    updateInfo,
    actionError,
    autoDownload,
    autoInstallOnAppQuit,
    setAutoDownload: (value: boolean) => { autoDownload.value = value },
    setAutoInstall: (value: boolean) => { autoInstallOnAppQuit.value = value },
  }
}
export const kSettingsState: InjectionKey<ReturnType<typeof useSettingsState>> = Symbol('Settings')

export function useSettingsState() {
  const { getSettings } = useService(BaseServiceKey)
  return useState(getSettings, Settings)
}

export function useGlobalSettings({ state } = injection(kSettingsState)) {
  const globalAssignMemory = computed(() => state.value?.globalAssignMemory ?? false)
  const globalMinMemory = computed(() => state.value?.globalMinMemory ?? 0)
  const globalMaxMemory = computed(() => state.value?.globalMaxMemory ?? 0)
  const globalJava = computed(() => state.value?.globalJava ?? '')
  const globalVmOptions = computed(() => state.value?.globalVmOptions ?? [])
  const globalMcOptions = computed(() => state.value?.globalMcOptions ?? [])
  const globalFastLaunch = computed(() => state.value?.globalFastLaunch ?? false)
  const globalHideLauncher = computed(() => state.value?.globalHideLauncher ?? false)
  const globalShowLog = computed(() => state.value?.globalShowLog ?? false)
  const globalDisableAuthlibInjector = computed(() => state.value?.globalDisableAuthlibInjector ?? true)
  const globalDisableElyByAuthlib = computed(() => state.value?.globalDisableElyByAuthlib ?? false)
  const globalSyncGameLanguage = computed(() => state.value?.globalSyncGameLanguage ?? false)
  const globalPrependCommand = computed(() => state.value?.globalPrependCommand ?? '')
  const globalPreExecuteCommand = computed(() => state.value?.globalPreExecuteCommand ?? '')
  const globalEnv = computed(() => state.value?.globalEnv ?? {})
  const globalResolution = computed(() => state.value?.globalResolution)
  const setGlobalSettings = (setting: {
    globalMinMemory: number
    globalMaxMemory: number
    globalAssignMemory: boolean | 'auto'
    globalJava: string
    globalVmOptions: string[]
    globalMcOptions: string[]
    globalFastLaunch: boolean
    globalHideLauncher: boolean
    globalShowLog: boolean
    globalDisableAuthlibInjector: boolean
    globalDisableElyByAuthlib: boolean
    globalSyncGameLanguage?: boolean
    globalPrependCommand: string
    globalPreExecuteCommand: string
    globalEnv: Record<string, string>
    globalResolution: { width?: number; height?: number; fullscreen?: boolean; monitor?: string }
  }) => {
    state.value?.globalInstanceSetting(setting)
  }

  return {
    globalAssignMemory,
    globalMinMemory,
    globalMaxMemory,
    globalJava,
    globalVmOptions,
    globalMcOptions,
    globalFastLaunch,
    globalHideLauncher,
    globalShowLog,
    globalDisableAuthlibInjector,
    globalDisableElyByAuthlib,
    globalSyncGameLanguage,
    globalPrependCommand,
    globalPreExecuteCommand,
    globalEnv,
    globalResolution,
    setGlobalSettings,
  }
}
export function useGameDirectory() {
  const { getGameDataDirectory, migrate, openDirectory } = useService(BaseServiceKey)
  const root = ref('')
  onMounted(() => {
    getGameDataDirectory().then((r) => {
      root.value = r
    })
  })
  const setGameDirectory = async (value: string) => {
    root.value = value
    await migrate({ destination: value })
  }

  function showGameDirectory() {
    if (root.value) {
      openDirectory(root.value)
    }
  }
  return {
    root,
    setGameDirectory,
    showGameDirectory,
  }
}

export function parseProxy(proxy: string) {
  try {
    const url = new URL(proxy)
    return {
      host: url.hostname,
      port: url.port,
    }
  } catch (e) {
    return {
      host: '',
      port: '',
    }
  }
}

export function formatProxy(host: string, port: string) {
  const value = host.trim()
  const configuredPort = port.trim()
  if (!value && !configuredPort) return ''

  let protocol = 'http:'
  let hostname = value
  let embeddedPort = ''
  try {
    const url = new URL(value.includes('://') ? value : `http://${value}`)
    protocol = url.protocol
    hostname = url.hostname
    embeddedPort = url.port
  } catch (e) {}

  const effectivePort = configuredPort || embeddedPort
  return `${protocol}//${hostname}${effectivePort ? `:${effectivePort}` : ''}`
}

export function useSettings() {
  const streamerMode = inject('streamerMode', useLocalStorage('streamerMode', false, { writeDefaults: false }))
  const { state, error, isValidating } = injection(kSettingsState)

  const getProxy = () => {
    return parseProxy(state.value?.httpProxy || '')
  }

  const locales = computed(() => state.value?.locales || [])
  const selectedLocale = computed({
    get: () => locales.value.find(l => l.locale === state.value?.locale)?.locale || 'en',
    set: v => state.value?.localeSet(v),
  })
  const enableDedicatedGPUOptimization = computed({
    get: () => state.value?.enableDedicatedGPUOptimization ?? false,
    set: v => state.value?.enableDedicatedGPUOptimizationSet(v),
  })
  const apiSetsPreference = computed({
    get: () => state.value?.apiSetsPreference ?? '',
    set: v => state.value?.apiSetsPreferenceSet(v),
  })
  const replaceNative = computed({
    get: () => state.value?.replaceNatives ?? 'legacy-only' as string | false,
    set: v => state.value?.replaceNativesSet(v as any),
  })
  const maxSockets = ref(state.value?.maxSockets)
  const maxAPISockets = ref(state.value?.maxAPISockets)
  const proxy = ref(getProxy())
  const httpProxyEnabled = computed({
    get: () => state.value?.httpProxyEnabled ?? false,
    set: v => state.value?.httpProxyEnabledSet(v),
  })
  const developerMode = computed({
    get: () => state.value?.developerMode ?? false,
    set: v => state.value?.developerModeSet(v),
  })
  const disableTelemetry = computed({
    get: () => state.value?.disableTelemetry ?? false,
    set: v => state.value?.disableTelemetrySet(v),
  })
  const multiplayerTransport = computed({
    get: () => state.value?.multiplayerTransport ?? 'webrtc',
    set: v => state.value?.multiplayerTransportSet(v),
  })
  const enableDiscord = computed({
    get: () => state.value?.discordPresence ?? false,
    set: (v) => state.value?.discordPresenceSet(v),
  })
  const apiSets = computed(() => state.value?.apiSets || [])

  onMounted(() => {
    const p = getProxy()
    proxy.value.host = p.host
    proxy.value.port = p.port
  })

  watch(computed(() => state.value?.httpProxy), () => {
    const p = getProxy()
    proxy.value.host = p.host
    proxy.value.port = p.port
  })

  onUnmounted(() => {
    const p = proxy.value
    const newValue = formatProxy(p.host, p.port)
    if (newValue !== state.value?.httpProxy) {
      state.value?.httpProxySet(newValue)
    }
    if (state.value?.maxSockets !== maxSockets.value) {
      state.value?.maxSocketsSet(Number(maxSockets.value))
    }
    if (state.value?.maxAPISockets !== maxAPISockets.value) {
      state.value?.maxAPISocketsSet(Number(maxAPISockets.value))
    }
  })

  const quickActionShortcut = computed({
    get: () => state.value?.quickActionShortcut ?? '',
    set: (v) => state.value?.quickActionShortcutSet(v),
  })

  return {
    enableDedicatedGPUOptimization,
    streamerMode,
    developerMode,
    httpProxyEnabled,
    enableDiscord,
    quickActionShortcut,
    maxSockets,
    maxAPISockets,
    locales,
    proxy,
    replaceNative,
    selectedLocale,
    apiSetsPreference,
    apiSets,
    disableTelemetry,
    multiplayerTransport,
    error,
    isValidating,
  }
}
