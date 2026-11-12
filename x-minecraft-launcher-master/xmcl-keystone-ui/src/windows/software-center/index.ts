import { BaseServiceKey } from '@xmcl/runtime-api'
import { i18n } from '@/i18n'
import { vuetify } from '@/vuetify'
import 'virtual:uno.css'
import { createApp, h } from 'vue'
import SoftwareCenterApp from './SoftwareCenterApp.vue'

const locales = import.meta.glob('../../../locales/*.yaml')

async function applyLocale(requested: string) {
  const key = `../../../locales/${requested}.yaml`
  const path = locales[key] ? key : '../../../locales/en.yaml'
  const message = await locales[path]() as { default: Record<string, unknown> }
  const locale = path === key ? requested : 'en'
  i18n.global.setLocaleMessage(locale, message.default)
  ;(i18n.global.locale as any).value = locale
}

const app = createApp({
  setup() {
    // Like the updater window, this one boots without the launcher settings
    // providers, so the locale comes from the base service.
    // The standalone build ships without the launcher service bridge: keep the
    // system locale instead of failing to boot.
    const fallbackLocale = navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en'
    try {
      const baseServiceChannel = serviceChannels.open(BaseServiceKey)
      baseServiceChannel.call('getSettings').then((state) => state).then((state) => {
        void applyLocale(state.locale)
        state.subscribe('localeSet', (locale) => {
          void applyLocale(locale)
        })
      }).catch(() => void applyLocale(fallbackLocale))
    } catch {
      void applyLocale(fallbackLocale)
    }
    return () => h(SoftwareCenterApp)
  },
})

app.use(i18n)
app.use(vuetify)

app.mount('#app')
