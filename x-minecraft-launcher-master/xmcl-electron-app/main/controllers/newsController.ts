import { ElectronController } from '@/ElectronController'
import { getNews } from '@/news'
import { app, shell } from 'electron'
import { ControllerPlugin } from './plugin'

export const newsController: ControllerPlugin = function (this: ElectronController) {
  this.handle('nova-news:list', async (_, force?: boolean) => {
    try {
      return await getNews(app.getLocale(), force === true)
    } catch (error) {
      this.logger.warn(error as Error)
      return { country: 'US', language: 'en', items: [], fetchedAt: Date.now(), error: (error as Error).message }
    }
  })

  this.handle('nova-news:open', (_, url: string) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
  })
}
