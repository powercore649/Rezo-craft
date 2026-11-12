import { GenericEventEmitter } from './events'

/**
 * Port from electron
 */
export interface FileFilter {
  extensions: string[]
  name: string
}
/**
 * Port from electron
 */
export interface OpenDialogOptions {
  title?: string
  defaultPath?: string
  /**
   * Custom label for the confirmation button, when left empty the default label will
   * be used.
   */
  buttonLabel?: string
  filters?: FileFilter[]
  /**
   * Contains which features the dialog should use. The following values are
   * supported:
   */
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles' | 'createDirectory' | 'promptToCreate' | 'noResolveAliases' | 'treatPackageAsDirectory' | 'dontAddToRecent'>
  /**
   * Message to display above input boxes.
   *
   * @platform darwin
   */
  message?: string
  /**
   * Create security scoped bookmarks when packaged for the Mac App Store.
   *
   * @platform darwin,mas
   */
  securityScopedBookmarks?: boolean
}

export interface SaveDialogOptions {
  /**
   * The dialog title. Cannot be displayed on some _Linux_ desktop environments.
   */
  title?: string
  /**
   * Absolute directory path, absolute file path, or file name to use by default.
   */
  defaultPath?: string
  /**
   * Custom label for the confirmation button, when left empty the default label will
   * be used.
   */
  buttonLabel?: string
  filters?: FileFilter[]
  /**
   * Message to display above text fields.
   *
   * @platform darwin
   */
  message?: string
  /**
   * Custom label for the text displayed in front of the filename text field.
   *
   * @platform darwin
   */
  nameFieldLabel?: string
  /**
   * Show the tags input box, defaults to `true`.
   *
   * @platform darwin
   */
  showsTagField?: boolean
  properties?: Array<'showHiddenFiles' | 'createDirectory' | 'treatPackageAsDirectory' | 'showOverwriteConfirmation' | 'dontAddToRecent'>
  /**
   * Create a security scoped bookmark when packaged for the Mac App Store. If this
   * option is enabled and the file doesn't already exist a blank file will be
   * created at the chosen path.
   *
   * @platform darwin,mas
   */
  securityScopedBookmarks?: boolean
}

interface WindowControllerEventMap {
  maximize: boolean
  minimize: boolean
  navigate: string
}

export interface MonitorInfo {
  id: string
  label: string
  width: number
  height: number
  primary: boolean
}

export interface NetworkAdapterInfo {
  name: string
  description: string
  status: string
  linkSpeed: string
  mac: string
  ipv4: string[]
  gateway: string[]
  dns: string[]
  wifi: boolean
}

export type WifiSecurity = 'WPA2' | 'WPA3' | 'open'

export interface WifiNetwork {
  ssid: string
  signal: number
  authentication: string
  encryption: string
  channel?: number
  radioType?: string
  secure: boolean
}

export interface WifiScanResult {
  status: 'idle' | 'ok' | 'blocked' | 'error' | 'unsupported'
  networks: WifiNetwork[]
  message?: string
  at: number
}

export interface NetworkConnection {
  ssid: string
  adapter: string
  signal?: number
  ipv4: string[]
  gateway: string[]
  dns: string[]
  category?: string
}

export interface NetworkSnapshot {
  supported: boolean
  /** Whether the launcher runs with administrator rights (needed by netsh for Wi-Fi). */
  elevated: boolean
  adapters: NetworkAdapterInfo[]
  connection?: NetworkConnection
  savedProfiles: string[]
  scan: WifiScanResult
}

export interface NewsItem {
  title: string
  link: string
  source: string
  publishedAt: string
  publishedLabel?: string
}

export interface NewsFeed {
  /** ISO country code the feed was localized for, e.g. `FR`. */
  country: string
  language: string
  items: NewsItem[]
  fetchedAt: number
  error?: string
}

export interface SystemCpuStats {
  model: string
  cores: number
  /** Overall CPU load in percent, measured between two samples. */
  usage: number
}

export interface SystemMemoryStats {
  total: number
  used: number
}

export interface SystemDiskStats {
  name: string
  total: number
  free: number
}

export interface SystemNetworkStats {
  /** Bytes per second currently received. */
  down: number
  /** Bytes per second currently sent. */
  up: number
  received: number
  sent: number
}

export interface DesktopWidgetState {
  /** Whether the desktop widget window should be shown. */
  enabled: boolean
  visible: boolean
}

export type UpdateLauncherPhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'uptodate'
  | 'error'

/** State shared with the standalone update window. */
export interface UpdateLauncherState {
  /** Whether the update window is currently visible. */
  open: boolean
  phase: UpdateLauncherPhase
  currentVersion: string
  /** Version available from the update feed, if any. */
  version?: string
  notes?: string
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
  error?: string
}

/** Battery snapshot used by the battery manager and the tray gauge. */
export interface BatteryState {
  /** Whether the platform query worked at all. */
  supported: boolean
  /** Whether a battery is installed. */
  present: boolean
  percent: number
  charging: boolean
  /** Whether the device is currently plugged in. */
  onAc: boolean
  /** Minutes left, -1 when unknown. */
  timeRemaining: number
  /** Full charge capacity in mWh. */
  fullCapacity?: number
  /** Design capacity in mWh. */
  designCapacity?: number
  /** Full capacity as a percentage of the design capacity. */
  health?: number
  cycleCount?: number
  model?: string
  /** Whether the tray icon is the battery gauge. */
  trayIcon: boolean
  /** Whether the low battery notification is enabled. */
  alerts: boolean
  at: number
}

/** Build and path information shown by the Developer settings section. */
export interface DeveloperInfo {
  appVersion: string
  electron: string
  chrome: string
  node: string
  platform: string
  dataPath: string
  logsPath: string
  locale: string
}

/** One threat entry reported by Microsoft Defender. */
export interface AntivirusThreat {
  id: string
  name: string
  /** Defender severity: 1 low … 5 severe, 0 unknown. */
  severity: number
  active: boolean
  /** Files or registry keys involved, joined by '; '. */
  path?: string
  /** Detection time in milliseconds. */
  at?: number
}

export type AntivirusPhase = 'idle' | 'scanning' | 'done' | 'error'

/** Microsoft Defender status plus the current/last scan, for the Protection page. */
export interface AntivirusState {
  /** Windows only: Defender is the engine behind this page. */
  supported: boolean
  defenderEnabled: boolean
  realtimeEnabled: boolean
  tamperProtected: boolean
  signatureVersion?: string
  signatureAt?: number
  engineVersion?: string
  lastQuickScanAt?: number
  lastFullScanAt?: number
  phase: AntivirusPhase
  /** Which scan is running, or ran last. */
  scope?: 'quick' | 'mods'
  /** Folder count for a mods scan; 0 for a quick scan. */
  targets: number
  scannedTargets: number
  percent: number
  startedAt?: number
  finishedAt?: number
  /** Threat hits reported by the last run. */
  found: number
  threats: AntivirusThreat[]
  error?: string
}

/** One pending package reported by the Windows Update agent. */
export interface WindowsUpdateItem {
  /** Windows Update identity of the package. */
  id: string
  title: string
  /** KB article ids linked to the package. */
  kb: string[]
  /** MSRC severity, when the package publishes one. */
  severity?: string
  /** Download size in bytes, 0 when unknown. */
  size: number
  downloaded: boolean
  rebootRequired: boolean
}

export type WindowsUpdatePhase = 'idle' | 'scanning' | 'downloading' | 'installing' | 'done' | 'error'

/** Windows Update integration state, streamed to the settings page. */
export interface WindowsUpdateState {
  /** Windows only: the Windows Update COM agent is available. */
  supported: boolean
  /** Whether NovaCraft runs elevated, which installing requires. */
  elevated: boolean
  phase: WindowsUpdatePhase
  updates: WindowsUpdateItem[]
  percent: number
  rebootRequired: boolean
  /** Outcome of the last installation. */
  result?: 'succeeded' | 'succeededWithErrors' | 'failed' | 'aborted' | 'none'
  error?: string
  /** Timestamp of the last successful scan. */
  lastScan?: number
}

export interface SystemStats {
  supported: boolean
  cpu: SystemCpuStats
  memory: SystemMemoryStats
  disks: SystemDiskStats[]
  gpu?: string
  /** Seconds since the machine booted. */
  uptime: number
  network: SystemNetworkStats
  at: number
}

export interface NetworkActionResult {
  ok: boolean
  message?: string
  blocked?: boolean
}

export interface NetworkPingResult {
  host: string
  ms: number | null
}

export interface WindowController extends GenericEventEmitter<WindowControllerEventMap> {
  /**
   * Show current window
   */
  show(): void
  /**
   * Flash the window's frame and taskbar icon
   */
  flashFrame(): void

  focus(): void
  /**
   * Hide current window
   */
  hide(): void

  close(): void
  /**
   * Minimize current window
   */
  minimize(): void
  /**
   * Maximize current window
   */
  maximize(): void

  queryAudioPermission(): Promise<boolean>

  getMonitors(): Promise<MonitorInfo[]>

  writeClipboard(text: string): void

  writeClipboardImage(imageUrl: string): void

  /**
   * Resolve the absolute path of a file dropped into the renderer.
   */
  getPathForFile(file: File): string

  findInPage(text: string, options?: {
    /**
     * Whether to search forward or backward, defaults to `true`.
     */
    forward?: boolean
    /**
     * Whether to begin a new text finding session with this request. Should be `true`
     * for initial requests, and `false` for follow-up requests. Defaults to `false`.
     */
    findNext?: boolean
    /**
     * Whether search should be case-sensitive, defaults to `false`.
     */
    matchCase?: boolean
  }): void

  startProfiling(): void

  stopProfiling(): void

  stopFindInPage(): void

  /**
   * Read the current network adapters, the active Wi-Fi connection and the saved profiles.
   */
  getNetworkSnapshot(): Promise<NetworkSnapshot>

  /**
   * Scan the available Wi-Fi networks. Windows may require the location permission.
   */
  scanWifi(): Promise<WifiScanResult>

  connectWifi(ssid: string, password?: string, security?: WifiSecurity): Promise<NetworkActionResult>

  disconnectWifi(): Promise<NetworkActionResult>

  forgetWifi(ssid: string): Promise<NetworkActionResult>

  pingNetworkHosts(hosts: string[]): Promise<NetworkPingResult[]>

  /**
   * Open the relevant Windows network settings page.
   */
  openNetworkSettings(target: 'wifi' | 'location' | 'adapters'): void

  /**
   * Restart the launcher through an UAC prompt so netsh can manage Wi-Fi.
   */
  relaunchAsAdmin(): void

  /**
   * Real Minecraft news, localized for the country of the OS locale.
   */
  getNews(force?: boolean): Promise<NewsFeed>

  /**
   * Live statistics of the machine (CPU, memory, disks, network, uptime) for the home widgets.
   */
  getSystemStats(): Promise<SystemStats>

  /**
   * Show or hide the always-on-top desktop widgets, which stay on screen after
   * the main window is closed. The choice is persisted.
   */
  setDesktopWidget(enabled: boolean): Promise<DesktopWidgetState>

  getDesktopWidgetState(): Promise<DesktopWidgetState>

  /** Open (or focus) the standalone update window. */
  openUpdateLauncher(): Promise<UpdateLauncherState>

  getUpdateLauncherState(): Promise<UpdateLauncherState>

  onUpdateLauncherState(callback: (state: UpdateLauncherState) => void): () => void

  checkUpdateInLauncher(): Promise<void>

  downloadUpdateInLauncher(): Promise<void>

  installUpdateFromLauncher(): Promise<void>

  closeUpdateLauncher(): void

  /** Current battery snapshot. */
  getBatteryState(): Promise<BatteryState>

  /** Re-read the battery right away. */
  refreshBattery(): Promise<BatteryState>

  onBatteryState(callback: (state: BatteryState) => void): () => void

  /** Show the battery gauge instead of the launcher icon in the tray. */
  setBatteryTrayIcon(enabled: boolean): Promise<BatteryState>

  setBatteryAlerts(enabled: boolean): Promise<BatteryState>

  /** Pending Windows Update packages and the current scan/install state. */
  getWindowsUpdateState(): Promise<WindowsUpdateState>

  /** Ask the Windows Update agent for the pending packages. */
  scanWindowsUpdates(): Promise<WindowsUpdateState>

  /** Download and install every pending package. */
  installWindowsUpdates(): Promise<WindowsUpdateState>

  onWindowsUpdateState(callback: (state: WindowsUpdateState) => void): () => void

  /** Open the native Windows Update settings page. */
  openWindowsUpdateSettings(): void

  /** Microsoft Defender status and the last scan results. */
  getAntivirusState(): Promise<AntivirusState>

  /** Re-read the Defender status right away. */
  refreshAntivirusStatus(): Promise<AntivirusState>

  /** Run a quick scan, or scan every mods folder of the launcher. */
  scanAntivirus(scope: 'quick' | 'mods'): Promise<AntivirusState>

  cancelAntivirusScan(): Promise<AntivirusState>

  onAntivirusState(callback: (state: AntivirusState) => void): () => void

  /** Open the native Windows Security app. */
  openWindowsSecurity(): void

  /** Versions and paths used by the Developer settings section. */
  getDeveloperInfo(): Promise<DeveloperInfo>

  openDeveloperTools(): void

  openLogsFolder(): void

  openDataFolder(): void

  reloadLauncherWindow(): void

  /**
   * Listen to desktop widget visibility changes (for example when the widget
   * window is closed with its own button).
   */
  onDesktopWidgetState(callback: (state: DesktopWidgetState) => void): () => void

  openExternalLink(url: string): void

  showOpenDialog(options: OpenDialogOptions): Promise<{
    /**
     * whether or not the dialog was canceled.
     */
    canceled: boolean
    /**
     * An array of file paths chosen by the user. If the dialog is cancelled this will
     * be an empty array.
     */
    filePaths: string[]
    /**
     * An array matching the `filePaths` array of base64 encoded strings which contains
     * security scoped bookmark data. `securityScopedBookmarks` must be enabled for
     * this to be populated. (For return values, see table here.)
     *
     * @platform darwin,mas
     */
    bookmarks?: string[]
  }>
  showSaveDialog(options: SaveDialogOptions): Promise<{
    /**
     * whether or not the dialog was canceled.
     */
    canceled: boolean
    /**
     * If the dialog is canceled, this will be `undefined`.
     */
    filePath?: string
    /**
     * Base64 encoded string which contains the security scoped bookmark data for the
     * saved file. `securityScopedBookmarks` must be enabled for this to be present.
     * (For return values, see table here.)
     *
     * @platform darwin,mas
     */
    bookmark?: string
  }>

  setTranslucent(enable: boolean): void

  /**
   * Launch a program of the computer (`.exe`, `.bat`, `.lnk`...) detached from
   * the launcher.
   */
  launchExternalApp(filePath: string, args?: string[]): Promise<{
    ok: boolean
    error?: 'not-found' | 'spawn-failed'
    message?: string
  }>

  /**
   * Get the base64 data url of the native icon of a file. Returns an empty
   * string when the icon cannot be read.
   */
  getExternalAppIcon(filePath: string): Promise<string>

  /**
   * Start recording a CPU trace (`cpu-trace-*.json`), readable by the Chrome
   * DevTools Performance panel or Perfetto.
   */
  startCpuTrace(): Promise<{ ok: boolean; filePath?: string; message?: string }>

  /**
   * Stop the current CPU trace and write it into the launcher log folder.
   */
  stopCpuTrace(): Promise<{ ok: boolean; filePath?: string; message?: string }>

  /**
   * Whether a CPU trace is currently being recorded.
   */
  isCpuTraceRecording(): Promise<boolean>
}
