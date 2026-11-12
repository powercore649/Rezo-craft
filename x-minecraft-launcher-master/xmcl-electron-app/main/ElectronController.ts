import { HAS_DEV_SERVER, HOST, IS_DEV, WindowsBuild } from '@/constant'
import browsePreload from '@preload/browse'
import indexPreload from '@preload/index'
import indexTogetherPreload from '@preload/indexTogether'
import migrationPreload from '@preload/migration'
import monitorPreload from '@preload/monitor'
import browserWinUrl from '@renderer/browser.html'
import loggerWinUrl from '@renderer/logger.html'
import migrateWinUrl from '@renderer/migration.html'
import { parseOAuthRedirect } from '@xmcl/runtime/user/accountSystems/oauthRedirect'
import { InstalledAppManifest, Settings } from '@xmcl/runtime-api'
import { Client, LauncherAppController, MicrosoftAuthTelemetryEvent } from '@xmcl/runtime/app'
import { Logger } from '@xmcl/runtime/infra'
import { kSettings } from '@xmcl/runtime/settings'
import { BrowserWindow, Event, HandlerDetails, Session, Tray, WebContents, app, dialog, ipcMain, nativeTheme, protocol, shell } from 'electron'
import ElectronLauncherApp from './ElectronLauncherApp'
import { plugins } from './controllers'
import defaultApp from './defaultApp'
import { definedLocales } from './definedLocales'
import { createI18n } from './utils/i18n'
import { darkIcon } from './utils/icons'
import { getLoginSuccessHTML } from './utils/login'
import { createWindowTracker } from './utils/windowSizeTracker'
import { MultiplayerNetworkDiagnosticsController } from './MultiplayerNetworkDiagnosticsController'
import { BrowserRtcController } from './BrowserRtcController'

export class ElectronController implements LauncherAppController {
  protected windowsVersion?: { major: number; minor: number; build: number }

  protected mainWin: BrowserWindow | undefined = undefined
  protected splashWin: BrowserWindow | undefined = undefined

  protected loggerWin: BrowserWindow | undefined = undefined

  protected browserRef: BrowserWindow | undefined = undefined

  protected migrationRef: BrowserWindow | undefined = undefined

  protected i18n = createI18n(definedLocales, 'en')

  readonly logger: Logger

  protected tray: Tray | undefined

  /**
   * During the app is parking, even if the all windows are closed, the app will keep open.
   */
  protected parking = false

  protected activatedManifest: InstalledAppManifest | undefined

  protected sharedSession: Session | undefined

  private settings: Settings | undefined

  private migrated: { from: string; to: string } | undefined

  private readonly multiplayerNetworkDiagnostics: MultiplayerNetworkDiagnosticsController

  readonly browserRtc = new BrowserRtcController()

  maximized: boolean | undefined

  private windowOpenHandler: Parameters<WebContents['setWindowOpenHandler']>[0] = (detail: HandlerDetails) => {
    const url = new URL(detail.url)
    const features = detail.features.split(',')
    const width = parseInt(features.find(f => f.startsWith('width'))?.split('=')[1] ?? '1024', 10)
    const height = parseInt(features.find(f => f.startsWith('height'))?.split('=')[1] ?? '768', 10)
    const minWidth = parseInt(features.find(f => f.startsWith('min-width'))?.split('=')[1] ?? '600', 10)
    const minHeight = parseInt(features.find(f => f.startsWith('min-height'))?.split('=')[1] ?? '600', 10)
    const man = this.activatedManifest!
    // Determine if translucency should be enabled (from user settings or app manifest)
    const enableTranslucency = this.settings?.windowTranslucent || man.vibrancy
    if (url.host === 'app' || detail.frameName === 'app' || (url.host.startsWith('localhost') && HAS_DEV_SERVER)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          vibrancy: enableTranslucency && this.app.platform.os === 'osx' ? 'sidebar' : undefined, // macOS vibrancy
          icon: nativeTheme.shouldUseDarkColors ? man.iconSets.darkIcon : man.iconSets.icon,
          titleBarStyle: this.getTitlebarStyle(),
          trafficLightPosition: this.app.platform.os === 'osx' ? { x: 14, y: 10 } : undefined,
          minWidth,
          minHeight,
          width,
          height,
          show: false,
          frame: this.getFrameOption(),

          webPreferences: {
            preload: indexPreload,
            devTools: IS_DEV,
          },
        },
      }
    }

    shell.openExternal(detail.url)
    return { action: 'deny' }
  }

  private onWebContentCreateWindow = (window: BrowserWindow) => {
    window.webContents.setWindowOpenHandler(this.windowOpenHandler)
    window.webContents.on('will-navigate', this.onWebContentWillNavigate)
    window.webContents.on('did-create-window', this.onWebContentCreateWindow)
    window.once('ready-to-show', () => {
      window.show()
    })
  }

  private onWebContentWillNavigate = (event: Event, url: string) => {
    if (!url.startsWith(HAS_DEV_SERVER ? 'http://localhost' : ('http://' + HOST))) {
      event.preventDefault()
      shell.openExternal(url)
    }
  }

  constructor(protected app: ElectronLauncherApp) {
    this.multiplayerNetworkDiagnostics = new MultiplayerNetworkDiagnosticsController(ipcMain)
    plugins.forEach(p => p.call(this))

    if (app.platform.os === 'windows') {
      queueMicrotask(() => {
        this.windowsVersion = app.windowsUtils?.getWindowsVersion()
      })
    }

    this.app.on('window-all-closed', () => {
      if (process.platform !== 'darwin' && !this.parking) {
        this.app.quit()
      }
    })

    // A relaunch (installer, shortcut, protocol link) must never stack a second
    // launcher window: bring the existing window forward instead.
    this.app.on('second-instance', (argv: string[]) => {
      this.restoreMainWindow()
      // Or the launcher was already running: reuse its window and navigate.
      const route = this.storeRouteFromArgv(argv ?? [])
      if (route) this.getMainWindow()?.webContents.send('navigate', route)
    })

    this.logger = this.app.getLogger('Controller')

    protocol.registerSchemesAsPrivileged([{
      scheme: 'image',
      privileges: {
        stream: true,
        corsEnabled: true,
        supportFetchAPI: true,
        bypassCSP: true,
      },
    }])

    protocol.registerSchemesAsPrivileged([{
      scheme: 'video',
      privileges: {
        stream: true,
        corsEnabled: true,
        supportFetchAPI: true,
        bypassCSP: true,
      },
    }])
  }

  handle(channel: string, handler: (event: { sender: Client }, ...args: any[]) => any, once = false) {
    if (!once) {
      return ipcMain.handle(channel, handler)
    }
    return ipcMain.handleOnce(channel, handler)
  }

  broadcast(channel: string, ...payload: any[]): void {
    BrowserWindow.getAllWindows().forEach(w => {
      try {
        w.webContents.send(channel, ...payload)
      } catch (e) {
        this.logger.warn(`Drop message to ${channel} to ${w.getTitle()} as`)
        if (e instanceof Error) {
          this.logger.warn(e)
        }
      }
    })
  }

  /** The launcher's main window, if it is still alive. */
  getMainWindow(): BrowserWindow | undefined {
    return this.mainWin && !this.mainWin.isDestroyed() ? this.mainWin : undefined
  }

  /**
   * Hide the launcher window while another launcher-owned window takes over
   * (the updater), so the two are never on screen at once.
   */
  hideMainWindow(): BrowserWindow | undefined {
    const main = this.getMainWindow()
    if (main && main.isVisible()) {
      main.hide()
      return main
    }
    return undefined
  }

  /** Bring the launcher window back, restoring it from the tray/minimized state. */
  restoreMainWindow(target?: BrowserWindow) {
    const main = target && !target.isDestroyed() ? target : this.getMainWindow()
    if (!main) return
    if (main.isMinimized()) main.restore()
    if (!main.isVisible()) main.show()
    main.focus()
  }

  private setupBrowserLogger(ref: BrowserWindow, name: string) {
    const logger = this.app.getLogger(name, name)
    ref.webContents.on('console-message', (e) => {
      const message = e.message
      if (message.startsWith("Listener added for a synchronous 'DOMNodeRemoved' DOM Mutation Event. This event type is deprecated")) {
        return
      }
      if (e.level === 'info') {
        logger.log(message)
      } else if (e.level === 'warning' || e.level === 'error') {
        logger.warn(message)
      }
    })
    ref.once('close', () => {
      ref.webContents.removeAllListeners('console-message')
    })
  }

  private getBackgroundMaterial(enableTranslucency: boolean): 'none' | 'mica' | 'acrylic' | 'auto' | undefined {
    return undefined
    // const isWin = this.app.platform.os === 'windows'
    // if (!isWin) {
    //   return undefined
    // }
    // const windowsVersion = this.windowsVersion
    // const win11 = windowsVersion && windowsVersion.build >= WindowsBuild.Windows11
    // if (!enableTranslucency) {
    //   return win11 ? 'mica' : 'auto'
    // }
    // const win10 = windowsVersion && windowsVersion.build >= WindowsBuild.Windows10
    // if (!win10 && !win11) {
    //   return 'auto'
    // }
    // return 'acrylic'
  }

  /**
   * A tiny window painted before the renderer bundle is ready. It turns the
   * post-update relaunch into an instant NovaCraft screen instead of a blank
   * desktop, and disappears as soon as the real window can show.
   */
  /** Route requested by the Software Center: `NovaCraft.exe --store modrinth/<slug>`. */
  private storeRouteFromArgv(argv: string[]) {
    const index = argv.indexOf('--store')
    if (index < 0) return undefined
    const value = argv[index + 1]
    return value && /^[a-z-]+\/[\w.-]+$/.test(value) ? `/store/${value}` : undefined
  }

  showBootSplash() {
    if (process.env.XMCL_E2E || process.argv.includes('--no-splash')) return
    if (this.splashWin && !this.splashWin.isDestroyed()) return
    const html = '<!doctype html><html><head><meta charset="utf-8"><style>'
      + 'html,body{margin:0;height:100%;overflow:hidden;font-family:\'Segoe UI\',system-ui,sans-serif;color:#fff}'
      + '.wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;'
      + 'background:radial-gradient(circle at 20% -20%,rgba(91,140,255,.45),transparent 60%),#0f1117}'
      + '.logo{width:56px;height:56px;border-radius:16px;display:grid;place-items:center;font-size:24px;'
      + 'background:linear-gradient(135deg,#5b8cff,#7a5bff);box-shadow:0 10px 30px rgba(91,140,255,.35)}'
      + '.name{font-size:19px;font-weight:700;letter-spacing:.06em}'
      + '.bar{width:170px;height:3px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}'
      + '.bar span{display:block;width:40%;height:100%;border-radius:3px;'
      + 'background:linear-gradient(90deg,#5b8cff,#7a5bff);animation:slide 1.1s ease-in-out infinite}'
      + '@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(320%)}}'
      + '</style></head><body><div class="wrap"><div class="logo">&#9670;</div>'
      + '<div class="name">NovaCraft</div><div class="bar"><span></span></div></div></body></html>'
    try {
      const splash = new BrowserWindow({
        width: 380,
        height: 220,
        frame: false,
        resizable: false,
        maximizable: false,
        fullscreenable: false,
        focusable: false,
        show: false,
        center: true,
        title: 'NovaCraft',
        backgroundColor: '#0f1117',
        webPreferences: { contextIsolation: true, sandbox: true },
      })
      splash.once('ready-to-show', () => {
        if (!splash.isDestroyed()) splash.show()
      })
      splash.webContents.on('did-fail-load', () => this.hideBootSplash())
      void splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
      this.splashWin = splash
      // Never let the splash outlive a failed boot.
      setTimeout(() => this.hideBootSplash(), 20000)
    } catch (e) {
      this.logger.warn('Boot splash unavailable')
      if (e instanceof Error) this.logger.warn(e)
    }
  }

  hideBootSplash() {
    const splash = this.splashWin
    this.splashWin = undefined
    if (splash && !splash.isDestroyed()) splash.close()
  }

  async startMigrate() {
    // The migration runs from `LauncherApp.setup()`, which races with the
    // engine becoming ready. Creating a BrowserWindow before the app is ready
    // throws, so wait for readiness before showing the progress window.
    await app.whenReady()
    const restoredSession = this.app.session.getSession(defaultApp.url)
    const browser = new BrowserWindow({
      title: 'REZO-craft - Migration',
      frame: false,
      resizable: false,
      width: 600,
      height: 400,
      webPreferences: {
        preload: migrationPreload,
        session: restoredSession,
      },
    })
    browser.loadURL(migrateWinUrl)

    this.migrationRef = browser
  }

  async endMigrate(result?: { from: string; to: string }) {
    this.migrated = result
    if (this.migrationRef) {
      this.migrationRef.close()
    }
  }

  async activate(manifest: InstalledAppManifest, isBootstrap = false): Promise<void> {
    this.logger.log(`Activate app ${manifest.name} ${manifest.url}`)
    this.showBootSplash()
    this.parking = true

    // close the old window
    if (this.mainWin && !this.mainWin.isDestroyed()) {
      this.mainWin.close()
    }

    this.activatedManifest = manifest

    try {
      await this.createAppWindow(isBootstrap)
    } finally {
      this.parking = false
    }
  }

  async createBrowseWindow() {
    // Determine if translucency should be enabled
    const enableTranslucency = this.settings?.windowTranslucent ?? false

    const browser = new BrowserWindow({
      title: 'REZO-craft - Browse Launchers',
      frame: false,
      transparent: true,
      resizable: false,
      width: 860,
      height: 450,
      useContentSize: true,
      vibrancy: enableTranslucency && this.app.platform.os === 'osx' ? 'sidebar' : undefined, // macOS vibrancy
      backgroundMaterial: this.getBackgroundMaterial(enableTranslucency), // Windows mica/acrylic
      icon: darkIcon,
      webPreferences: {
        preload: browsePreload,
      },
    })

    browser.loadURL(browserWinUrl)

    this.browserRef = browser
  }

  openMultiplayer() {
    const window = this.mainWin
    if (!window || window.isDestroyed()) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
    window.webContents.send('navigate', '/multiplayer')
  }

  setWindowTranslucent(enable: boolean) {
    if (this.mainWin && !this.mainWin.isDestroyed()) {
      if (this.app.platform.os === 'osx') {
        this.mainWin.setVibrancy(enable ? 'sidebar' : null)
      } else if (this.app.platform.os === 'windows') {
        this.mainWin.setBackgroundMaterial(this.getBackgroundMaterial(enable) ?? 'auto')
      }
    }
  }

  async createAppWindow(isBootstrap: boolean) {
    const man = this.activatedManifest!
    const tracker = createWindowTracker(this.app, 'app-manager', man)
    const config = await tracker.getConfig()

    const restoredSession = this.app.session.getSession(man.url)
    const minWidth = man.minWidth ?? 800
    const minHeight = man.minHeight ?? 600
    const defaultWidth = man.defaultWidth ?? 800
    const defaultHeight = man.defaultHeight ?? 600

    // Ensure the settings is loaded for translucency and Linux titlebar options
    if (!this.settings) {
      this.settings = await this.app.registry.get(kSettings)
    }

    // Determine if translucency should be enabled (from user settings or app manifest)
    const enableTranslucency = this.settings?.windowTranslucent || man.vibrancy

    const browser = new BrowserWindow({
      title: man.name,
      width: config.getWidth(defaultWidth, minWidth),
      height: config.getHeight(defaultHeight, minHeight),
      x: config.x,
      y: config.y,
      minWidth: man.minWidth,
      minHeight: man.minHeight,
      frame: this.getFrameOption(),
      backgroundColor: enableTranslucency ? undefined : man.backgroundColor, // Transparent when translucency is enabled
      vibrancy: enableTranslucency && this.app.platform.os === 'osx' ? 'sidebar' : undefined, // macOS vibrancy
      backgroundMaterial: this.getBackgroundMaterial(enableTranslucency), // Windows mica/acrylic
      icon: nativeTheme.shouldUseDarkColors ? man.iconSets.darkIcon : man.iconSets.icon,
      titleBarStyle: this.getTitlebarStyle(),
      trafficLightPosition: this.app.platform.os === 'osx' ? { x: 14, y: 10 } : undefined,
      webPreferences: {
        preload: indexTogetherPreload,
        session: restoredSession,
        contextIsolation: true,
        sandbox: true,
        webviewTag: true,
      },
      show: false,
    })

    this.multiplayerNetworkDiagnostics.attach(browser.webContents)
    this.browserRtc.attach(browser.webContents)

    if (man.ratio) {
      browser.setAspectRatio(minWidth / minHeight)
    }

    browser.on('ready-to-show', () => {
      this.logger.log('App Window is ready to show!')

      if (config.maximized) {
        browser.maximize()
      }

      if (!this.app.deferredWindowOpen) {
        this.hideBootSplash()
        browser.show()
        browser.focus()
      }
    })
    browser.webContents.on('will-navigate', this.onWebContentWillNavigate)
    browser.webContents.on('did-create-window', this.onWebContentCreateWindow)
    browser.webContents.setWindowOpenHandler(this.windowOpenHandler)
    const webContentsId = browser.webContents.id
    browser.on('closed', () => {
      this.multiplayerNetworkDiagnostics.detach(webContentsId)
      this.browserRtc.detach(webContentsId)
      this.mainWin = undefined
    })

    this.setupBrowserLogger(browser, 'app')
    tracker.track(browser)

    const url = new URL(man.url)
    if (isBootstrap) {
      url.searchParams.append('bootstrap', 'true')
    }
    if (this.migrated) {
      url.searchParams.append('from', this.migrated.from)
      url.searchParams.append('to', this.migrated.to)
    }
    // The Software Center hands us the page to open on the command line.
    const requestedStore = this.storeRouteFromArgv(process.argv)
    if (requestedStore) {
      url.searchParams.append('store', requestedStore.replace('/store/', ''))
    }
    this.logger.log(url.toString())
    browser.loadURL(url.toString())

    this.logger.log(`Load main window url ${url.toString()}`)

    this.mainWin = browser
    browser.on('enter-full-screen', () => {
      this.maximized = true
    })
    browser.on('maximize', () => {
      this.maximized = true
    })
    browser.on('unmaximize', () => {
      this.maximized = false
    })

    this.app.emit('app-booted', man)
  }

  getLoggerWindow() {
    if (this.loggerWin?.isDestroyed()) {
      this.loggerWin = undefined
    }
    return this.loggerWin
  }

  async createMonitorWindow() {
    const tracker = createWindowTracker(this.app, 'monitor', this.activatedManifest!)
    // Determine if translucency should be enabled
    const enableTranslucency = this.settings?.windowTranslucent ?? false

    const config = await tracker.getConfig()
    const browser = new BrowserWindow({
      title: 'KeyStone Monitor',
      width: config.getWidth(600, 600),
      height: config.getHeight(400, 400),
      x: config.x,
      y: config.y,
      minWidth: 600,
      minHeight: 400,
      frame: false,
      transparent: true,
      hasShadow: false,
      maximizable: false,
      icon: darkIcon,
      backgroundMaterial: this.getBackgroundMaterial(enableTranslucency), // Windows mica/acrylic
      webPreferences: {
        preload: monitorPreload,
        session: this.app.session.getSession(this.activatedManifest!.url),
      },
    })

    this.setupBrowserLogger(browser, 'logger')

    browser.loadURL(loggerWinUrl)
    browser.show()

    tracker.track(browser)

    this.loggerWin = browser
  }

  requireFocus(): void {
    if (this.mainWin) {
      if (!this.mainWin.isVisible()) {
        this.mainWin.show()
      } else {
        this.mainWin.focus()
      }
    } else if (this.loggerWin) {
      this.loggerWin.focus()
    }
  }

  async requestOpenExternalUrl(url: string) {
    const { t } = this.i18n
    const result = await dialog.showMessageBox(this.mainWin!, {
      type: 'question',
      title: t('openUrl.title', { url }),
      message: t('openUrl.message', { url }),
      checkboxLabel: t('openUrl.trust'),
      buttons: [t('openUrl.cancel'), t('openUrl.yes')],
    })
    return result.response === 1
  }

  private getFrameOption() {
    if (this.app.platform.os === 'linux') {
      return this.settings?.linuxTitlebar
    } else {
      return true
    }
  }

  private getTitlebarStyle() {
    return this.app.platform.os === 'linux' &&
      this.settings?.linuxTitlebar
      ? 'default'
      : 'hidden'
  }

  get activeWindow() {
    return this.mainWin ?? this.loggerWin
  }

  getNativeWindowHandle() {
    const window = this.activeWindow
    if (!window || window.isDestroyed()) {
      return undefined
    }
    return window.getNativeWindowHandle()
  }

  async openMicrosoftLogin(authorizationUrl: string, redirectUri: string, signal?: AbortSignal, authAttemptId?: string): Promise<string> {
    const redirect = new URL(redirectUri)
    await app.whenReady()
    return new Promise<string>((resolve, reject) => {
      let settled = false
      const startedAt = Date.now()
      let readyToShow = false
      let didFinishLoad = false
      let lastStage = 'created'
      let lastLoadErrorCode: number | undefined
      const parent = this.activeWindow
      const browser = new BrowserWindow({
        title: 'Sign in to Microsoft',
        width: 560,
        height: 720,
        minWidth: 420,
        minHeight: 600,
        parent,
        modal: !!parent,
        autoHideMenuBar: true,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          partition: 'persist:xmcl-microsoft-login',
        },
        show: false,
      })
      const finish = (
        outcome: string,
        error?: Error,
        code?: string,
        extraProperties: Record<string, string | number | boolean> = {},
      ) => {
        if (settled) return
        settled = true
        signal?.removeEventListener('abort', onAbort)
        if (authAttemptId) {
          const properties: MicrosoftAuthTelemetryEvent['properties'] = {
            authAttemptId,
            outcome,
            readyToShow,
            didFinishLoad,
            lastStage,
            ...extraProperties,
          }
          if (error) properties.errorName = error.name
          if (outcome === 'load_failed' && lastLoadErrorCode !== undefined) {
            properties.loadErrorCode = lastLoadErrorCode
          }
          this.app.emit('microsoft-auth-telemetry', {
            name: 'microsoft-auth-webview-result',
            properties,
            measurements: {
              durationMs: Date.now() - startedAt,
            },
          })
        }
        if (!browser.isDestroyed()) {
          browser.close()
        }
        if (error) reject(error)
        else resolve(code!)
      }
      const onAbort = () => {
        lastStage = 'aborted'
        const error = new Error('Microsoft authorization was cancelled.')
        error.name = 'AbortError'
        finish('aborted', error)
      }
      const onNavigate = (event: Event, url: string) => {
        const target = parseOAuthRedirect(url, redirect)
        if (!target) return
        event.preventDefault()
        lastStage = 'oauth_callback'
        const error = target.searchParams.get('error')
        if (error) {
          finish('oauth_error', new Error(target.searchParams.get('error_description') || error), undefined, {
            oauthError: /^[a-z0-9_.-]{1,128}$/i.test(error) ? error : 'other',
          })
          return
        }
        const code = target.searchParams.get('code')
        finish(code ? 'success' : 'no_code', code ? undefined : new Error('Microsoft authorization returned no code.'), code ?? undefined)
      }
      browser.webContents.on('will-navigate', onNavigate)
      browser.webContents.on('will-redirect', onNavigate)
      browser.webContents.on('did-finish-load', () => {
        didFinishLoad = true
        lastStage = 'did_finish_load'
      })
      browser.webContents.on('did-fail-load', (_event, errorCode, _errorDescription, _validatedUrl, isMainFrame) => {
        if (!isMainFrame) return
        lastLoadErrorCode = errorCode
        lastStage = 'did_fail_load'
      })
      browser.webContents.on('render-process-gone', (_event, details) => {
        lastStage = 'render_process_gone'
        finish('renderer_gone', new Error('Microsoft authorization renderer exited.'), undefined, {
          reason: details.reason,
          exitCode: details.exitCode,
        })
      })
      browser.on('unresponsive', () => {
        lastStage = 'unresponsive'
      })
      browser.webContents.setWindowOpenHandler(({ url }) => {
        try {
          const target = new URL(url)
          if (target.protocol === 'https:' || target.origin === redirect.origin) {
            lastStage = 'popup_navigation'
            void browser.loadURL(url).catch(error => {
              lastStage = 'popup_load_failed'
              finish('load_failed', error)
            })
          }
        } catch {
          // Ignore malformed popup targets from third-party identity pages.
        }
        return { action: 'deny' }
      })
      browser.once('ready-to-show', () => {
        readyToShow = true
        lastStage = 'ready_to_show'
        browser.show()
      })
      browser.once('closed', () => {
        const closeFromStage = lastStage
        lastStage = 'closed'
        finish('closed', new Error('Microsoft authorization window was closed.'), undefined, {
          closeFromStage,
        })
      })
      signal?.addEventListener('abort', onAbort, { once: true })
      lastStage = 'loading_authorization_url'
      void browser.loadURL(authorizationUrl).catch(error => {
        lastStage = 'initial_load_failed'
        finish('load_failed', error)
      })
    })
  }

  getLoginSuccessHTML() {
    const title = this.i18n.t('urlSuccess')
    return getLoginSuccessHTML(title)
  }

  openDevTools() {
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        win.webContents.closeDevTools()
        win.webContents.openDevTools({ mode: 'detach' })
      } catch {

      }
    }
  }
}
