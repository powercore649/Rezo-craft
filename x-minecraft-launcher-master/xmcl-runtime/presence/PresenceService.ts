import { Client, type SetActivity } from '@xmcl/discord-rpc'
import { type PresenceService as IPresenceService, type SharedState, PresenceServiceKey, Settings } from '@xmcl/runtime-api'
import { Inject, LauncherAppKey } from '~/app'
import { AbstractService, ExposeServiceKey } from '~/service'
import { kSettings } from '~/settings'
import { LauncherApp } from '../app/LauncherApp'
import { LaunchService } from '../launch/LaunchService'

/** NovaCraft's Discord application. */
const DISCORD_CLIENT_ID = '1075044884400054363'
/** Retry cadence while Discord is closed or restarting. */
const RECONNECT_INTERVAL = 15_000
const DEFAULT_ACTIVITY = 'Dans NovaCraft'

/**
 * Discord Rich Presence.
 *
 * Reliability points that the previous version missed:
 * - the IPC client is created lazily, so the service initializer never touches
 *   an undefined client;
 * - a connection attempt is retried while the setting stays on, which covers
 *   "Discord was closed when the launcher started" and Discord restarts;
 * - an activity is published as soon as the RPC handshake completes, so the
 *   card shows up without waiting for the user to open a specific page;
 * - no `large_image` key is forced: an unknown asset makes Discord reject the
 *   whole SET_ACTIVITY payload, which left the presence empty.
 */
@ExposeServiceKey(PresenceServiceKey)
export class PresenceService extends AbstractService implements IPresenceService {
  private discord?: Client
  private connecting?: Promise<boolean>
  private retryTimer?: ReturnType<typeof setTimeout>
  private runningGameCount = 0
  private currentDetails = DEFAULT_ACTIVITY
  private startedAt = Date.now()

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kSettings) private settings: SharedState<Settings>,
    @Inject(LaunchService) launchService: LaunchService,
  ) {
    super(app, async () => {
      if (this.settings.discordPresence) {
        await this.ensureConnected()
      }
    })

    settings.subscribe('discordPresenceSet', async (enabled) => {
      if (enabled) {
        await this.ensureConnected(true)
      } else {
        await this.disconnect()
      }
    })

    launchService.on('minecraft-start', () => {
      this.runningGameCount++
      this.log(`Game started, showing in-game presence (running games: ${this.runningGameCount})`)
      void this.publish('En jeu', 'Minecraft')
    })

    launchService.on('minecraft-exit', () => {
      this.runningGameCount = Math.max(0, this.runningGameCount - 1)
      this.log(`Game exited, restoring launcher presence (running games: ${this.runningGameCount})`)
      if (this.runningGameCount === 0) {
        void this.publish(this.currentDetails)
      }
    })
  }

  private getClient(): Client {
    if (!this.discord) {
      const client = new Client({ clientId: DISCORD_CLIENT_ID })
      client.on('disconnected', () => {
        this.log('Discord RPC disconnected')
        this.scheduleReconnect()
      })
      this.discord = client
    }
    return this.discord
  }

  private scheduleReconnect() {
    if (!this.settings.discordPresence || this.retryTimer) return
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined
      void this.ensureConnected()
    }, RECONNECT_INTERVAL)
    this.retryTimer.unref?.()
  }

  private async ensureConnected(force = false): Promise<boolean> {
    if (!this.settings.discordPresence) return false
    const client = this.getClient()
    if (client.isConnected && client.user) return true
    if (this.connecting) return this.connecting

    this.connecting = (async () => {
      try {
        if (force) await client.destroy().catch(() => undefined)
        await client.connect()
        this.startedAt = Date.now()
        this.log('Connected to Discord RPC')
        await this.publish(this.runningGameCount > 0 ? 'En jeu' : this.currentDetails, this.runningGameCount > 0 ? 'Minecraft' : undefined)
        return true
      } catch (e) {
        this.warn('Fail to connect to Discord RPC, will retry. %o', e)
        this.scheduleReconnect()
        return false
      } finally {
        this.connecting = undefined
      }
    })()

    return this.connecting
  }

  private async disconnect() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = undefined
    }
    const client = this.discord
    this.discord = undefined
    if (client) {
      await client.destroy().catch(() => undefined)
    }
  }

  private async publish(details: string, state?: string) {
    const client = this.discord
    if (!client?.isConnected || !client.user) return

    const trim = (value?: string) => {
      const text = (value ?? '').trim()
      if (!text) return undefined
      return text.length > 128 ? `${text.slice(0, 125)}...` : text
    }

    const activity: SetActivity = {
      details: trim(details),
      state: trim(state),
      startTimestamp: this.startedAt,
      instance: false,
    }

    try {
      await client.user.setActivity(activity)
    } catch (e) {
      this.warn('Fail to set Discord presence. %o', e)
    }
  }

  async setActivity(activity: string): Promise<void> {
    const details = (activity ?? '').trim()
    this.currentDetails = details || DEFAULT_ACTIVITY

    if (!this.settings.discordPresence) return

    const connected = await this.ensureConnected()
    if (!connected) return
    // While a game runs, the presence shows "En jeu" instead of the launcher page.
    if (this.runningGameCount > 0) return

    await this.publish(this.currentDetails)
  }
}
