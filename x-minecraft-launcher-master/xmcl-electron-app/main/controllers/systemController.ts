import { ElectronController } from '@/ElectronController'
import { getSystemStats } from '@/systemStats'
import { ControllerPlugin } from './plugin'

export const systemController: ControllerPlugin = function (this: ElectronController) {
  this.handle('nova-system:stats', async () => {
    try {
      return await getSystemStats()
    } catch (error) {
      this.logger.warn(error as Error)
      return {
        supported: false,
        cpu: { model: '', cores: 0, usage: 0 },
        memory: { total: 0, used: 0 },
        disks: [],
        uptime: 0,
        network: { down: 0, up: 0, received: 0, sent: 0 },
        at: Date.now(),
      }
    }
  })
}
