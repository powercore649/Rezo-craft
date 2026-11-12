import { ElectronController } from '@/ElectronController'
import { connectWifi, disconnectWifi, forgetWifi, getNetworkSnapshot, pingHosts, scanWifi } from '@/network'
import { spawn } from 'child_process'
import { app, shell } from 'electron'
import { ControllerPlugin } from './plugin'

const settingsPages: Record<string, string> = {
  wifi: 'ms-settings:network-wifi',
  location: 'ms-settings:privacy-location',
  adapters: 'ms-settings:network-status',
}

export const networkController: ControllerPlugin = function (this: ElectronController) {
  this.handle('nova-network:snapshot', async () => {
    try {
      return await getNetworkSnapshot()
    } catch (error) {
      this.logger.warn(error as Error)
      return { supported: true, elevated: true, adapters: [], savedProfiles: [], scan: { status: 'error', networks: [], at: Date.now() } }
    }
  })

  this.handle('nova-network:scan', async () => {
    try {
      return await scanWifi()
    } catch (error) {
      this.logger.warn(error as Error)
      return { status: 'error', networks: [], message: (error as Error).message, at: Date.now() }
    }
  })

  this.handle('nova-network:connect', async (_, ssid: string, password?: string, security?: 'WPA2' | 'WPA3' | 'open') => {
    try {
      return await connectWifi(ssid, password, security)
    } catch (error) {
      this.logger.warn(error as Error)
      return { ok: false, message: (error as Error).message }
    }
  })

  this.handle('nova-network:disconnect', async () => {
    try {
      return await disconnectWifi()
    } catch (error) {
      this.logger.warn(error as Error)
      return { ok: false, message: (error as Error).message }
    }
  })

  this.handle('nova-network:forget', async (_, ssid: string) => {
    try {
      return await forgetWifi(ssid)
    } catch (error) {
      this.logger.warn(error as Error)
      return { ok: false, message: (error as Error).message }
    }
  })

  this.handle('nova-network:ping', async (_, hosts: string[]) => {
    try {
      return await pingHosts(Array.isArray(hosts) ? hosts : [])
    } catch (error) {
      this.logger.warn(error as Error)
      return []
    }
  })

  this.handle('nova-network:open-settings', (_, target: string) => {
    void shell.openExternal(settingsPages[target] ?? settingsPages.wifi)
  })

  this.handle('nova-network:relaunch-admin', () => {
    const exe = process.env.PORTABLE_EXECUTABLE_FILE ?? app.getPath('exe')
    try {
      spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Start-Process -FilePath $env:NOVACRAFT_EXE -Verb RunAs',
      ], {
        env: { ...process.env, NOVACRAFT_EXE: exe },
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      }).unref()
    } catch (error) {
      this.logger.warn(error as Error)
    }
    setTimeout(() => app.quit(), 1200)
  })
}
