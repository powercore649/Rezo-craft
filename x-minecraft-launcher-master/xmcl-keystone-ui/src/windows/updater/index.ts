import { BaseServiceKey } from '@xmcl/runtime-api'
import { i18n } from '@/i18n'
import { vuetify } from '@/vuetify'
import 'virtual:uno.css'
import { createApp, h } from 'vue'
import UpdaterApp from './UpdaterApp.vue'

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
    // This window boots without the launcher settings providers, so the locale
    // is read from the base service, like the desktop widget window does.
    const baseServiceChannel = serviceChannels.open(BaseServiceKey)
    baseServiceChannel.call('getSettings').then((state) => state).then((state) => {
      void applyLocale(state.locale)
      state.subscribe('localeSet', (locale) => {
        void applyLocale(locale)
      })
    })
    return () => h(UpdaterApp)
  },
})

app.use(i18n)
app.use(vuetify)

app.mount('#app')
