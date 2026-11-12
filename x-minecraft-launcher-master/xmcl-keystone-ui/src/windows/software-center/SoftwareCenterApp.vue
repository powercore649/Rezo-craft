<template>
  <div class="sc">
    <header class="sc__header">
      <div class="sc__brand">
        <div class="sc__logo">N</div>
        <div>
          <div class="sc__name">NovaCraft</div>
          <div class="sc__sub">{{ t('softwareCenter.title') }}</div>
        </div>
      </div>
      <v-spacer />
      <v-btn
        icon="close"
        size="small"
        variant="text"
        :aria-label="t('softwareCenter.close')"
        @click="close"
      />
    </header>

    <p class="sc__intro">{{ t('softwareCenter.subtitle') }}</p>

    <div class="sc__toolbar">
      <v-text-field
        v-model="query"
        :placeholder="t('softwareCenter.search')"
        prepend-inner-icon="search"
        density="compact"
        variant="solo-filled"
        hide-details
        clearable
      />
      <v-chip
        :color="installed ? 'success' : undefined"
        :variant="installed ? 'flat' : 'outlined'"
        size="small"
      >
        {{ installed ? t('softwareCenter.installed') : t('softwareCenter.notInstalled') }}
      </v-chip>
      <v-btn
        v-if="!installed"
        color="primary"
        variant="flat"
        :loading="installing"
        @click="installSuite"
      >
        {{ installing ? t('softwareCenter.installing') : t('softwareCenter.install') }}
      </v-btn>
      <v-btn v-else variant="tonal" :loading="checking" @click="refreshState">
        {{ t('softwareCenter.verify') }}
      </v-btn>
    </div>

    <div class="sc__chips">
      <v-chip
        v-for="category in categories"
        :key="category.id"
        :model-value="filter === category.id"
        :color="filter === category.id ? 'primary' : undefined"
        :variant="filter === category.id ? 'flat' : 'outlined'"
        size="small"
        @click="filter = category.id"
      >
        {{ t(category.label) }}
      </v-chip>
    </div>

    <v-progress-linear v-if="installing || checking" indeterminate color="primary" height="2" />

    <p v-if="message" class="sc__message">{{ message }}</p>

    <div class="sc__grid">
      <article v-for="product in products" :key="product.id" class="sc__card">
        <div class="sc__badge" :style="{ background: product.color }">{{ product.letter }}</div>
        <div class="sc__body">
          <div class="sc__title">{{ product.name }}</div>
          <div class="sc__tagline">{{ t(product.taglineKey) }}</div>
          <p class="sc__desc">{{ t(product.descriptionKey) }}</p>
          <div class="sc__included">
            {{ t(product.id === 'files' ? 'softwareCenter.includedFiles' : 'softwareCenter.included') }}
          </div>
        </div>
        <div class="sc__actions">
          <template v-if="product.id === 'files'">
            <v-btn
              v-if="!filesInstalled"
              size="small"
              color="primary"
              variant="flat"
              :loading="busy === 'files-install'"
              @click="installFiles"
            >
              {{ t('softwareCenter.installApp') }}
            </v-btn>
            <v-btn
              v-else
              size="small"
              color="primary"
              variant="flat"
              :loading="busy === product.id"
              @click="launch(product)"
            >
              {{ t('softwareCenter.openApp') }}
            </v-btn>
          </template>
          <v-btn
            v-else
            size="small"
            color="primary"
            variant="flat"
            :disabled="!installed"
            :loading="busy === product.id"
            @click="launch(product)"
          >
            {{ t('softwareCenter.openApp') }}
          </v-btn>
        </div>
      </article>
    </div>

    <p v-if="products.length === 0" class="sc__empty">{{ t('softwareCenter.empty') }}</p>

    <footer class="sc__foot">{{ t('softwareCenter.hint') }}</footer>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import type { SoftwareCenterApi } from './api'

interface Product {
  id: string
  name: string
  letter: string
  color: string
  category: 'office' | 'documents'
  taglineKey: string
  descriptionKey: string
}

const { t } = useI18n()

const api: SoftwareCenterApi | undefined = window.softwareCenter
const query = ref('')
const filter = ref('all')
const installed = ref(false)
const filesInstalled = ref(false)
const installing = ref(false)
const checking = ref(false)
const busy = ref('')
const message = ref('')

const categories = [
  { id: 'all', label: 'softwareCenter.all' },
  { id: 'office', label: 'softwareCenter.office' },
  { id: 'documents', label: 'softwareCenter.documents' },
]

const catalog: Product[] = [
  {
    id: 'word',
    name: 'NovaCraft Word',
    letter: 'W',
    color: '#2f6bff',
    category: 'office',
    taglineKey: 'softwareCenter.product.word',
    descriptionKey: 'softwareCenter.product.wordHint',
  },
  {
    id: 'sheets',
    name: 'NovaCraft Sheets',
    letter: 'S',
    color: '#1f9d55',
    category: 'office',
    taglineKey: 'softwareCenter.product.sheets',
    descriptionKey: 'softwareCenter.product.sheetsHint',
  },
  {
    id: 'slides',
    name: 'NovaCraft Slides',
    letter: 'P',
    color: '#e2571f',
    category: 'office',
    taglineKey: 'softwareCenter.product.slides',
    descriptionKey: 'softwareCenter.product.slidesHint',
  },
  {
    id: 'pdf',
    name: 'NovaCraft PDF',
    letter: 'P',
    color: '#c0392b',
    category: 'documents',
    taglineKey: 'softwareCenter.product.pdf',
    descriptionKey: 'softwareCenter.product.pdfHint',
  },
  {
    id: 'notes',
    name: 'NovaCraft Notes',
    letter: 'N',
    color: '#8e5cff',
    category: 'office',
    taglineKey: 'softwareCenter.product.notes',
    descriptionKey: 'softwareCenter.product.notesHint',
  },
  {
    id: 'files',
    name: 'NovaCraft Fichiers',
    letter: 'F',
    color: '#f2c94c',
    category: 'documents',
    taglineKey: 'softwareCenter.product.files',
    descriptionKey: 'softwareCenter.product.filesHint',
  },
]

const products = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return catalog.filter((product) => {
    if (filter.value !== 'all' && product.category !== filter.value) return false
    if (!needle) return true
    return product.name.toLowerCase().includes(needle)
      || t(product.descriptionKey).toLowerCase().includes(needle)
  })
})

async function refreshState() {
  if (!api) {
    message.value = t('softwareCenter.installFailed')
    return
  }
  checking.value = true
  try {
    const state = await api.state()
    installed.value = state.installed
    filesInstalled.value = Boolean(state.files?.installed)
    if (state.installed) message.value = ''
  } catch (error) {
    message.value = error instanceof Error ? error.message : String(error)
  } finally {
    checking.value = false
  }
}

async function installSuite() {
  if (!api) return
  installing.value = true
  message.value = ''
  try {
    const result = await api.install()
    if (!result.ok) {
      message.value = `${t('softwareCenter.installFailed')} — ${result.error ?? ''}`.trim()
      return
    }
    installed.value = result.action === 'installed'
    message.value = result.action === 'installing' ? t('softwareCenter.installedHint') : ''
  } catch (error) {
    message.value = `${t('softwareCenter.installFailed')} — ${error instanceof Error ? error.message : String(error)}`
  } finally {
    installing.value = false
  }
}

async function installFiles() {
  if (!api) return
  busy.value = 'files-install'
  message.value = ''
  try {
    const result = await api.install('files')
    if (!result.ok) {
      message.value = `${t('softwareCenter.installAppFailed')} — ${result.error ?? ''}`.trim()
      return
    }
    filesInstalled.value = result.action === 'installed'
    message.value = result.action === 'installing' ? t('softwareCenter.filesInstalledHint') : ''
  } catch (error) {
    message.value = error instanceof Error ? error.message : String(error)
  } finally {
    busy.value = ''
  }
}

async function launch(product: Product) {
  if (!api) return
  busy.value = product.id
  message.value = ''
  try {
    const started = await api.launch(product.id)
    if (!started) message.value = t('softwareCenter.launchFailed')
  } catch (error) {
    message.value = error instanceof Error ? error.message : String(error)
  } finally {
    busy.value = ''
  }
}

function close() {
  void api?.close()
}

onMounted(() => {
  void refreshState()
})
</script>

<style scoped>
.sc {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px 20px 12px;
  gap: 12px;
  color: rgba(255, 255, 255, 0.92);
  background: radial-gradient(circle at 15% -10%, rgba(91, 140, 255, 0.22), transparent 55%), #0f1117;
  overflow: hidden auto;
}

.sc__header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sc__brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sc__logo {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-weight: 800;
  background: linear-gradient(135deg, #5b8cff, #7a5bff);
  box-shadow: 0 8px 22px rgba(91, 140, 255, 0.35);
}

.sc__name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.sc__sub {
  font-size: 12px;
  opacity: 0.6;
}

.sc__intro {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  opacity: 0.65;
}

.sc__toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sc__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sc__message {
  margin: 0;
  font-size: 12px;
  color: #ffcf8b;
}

.sc__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 10px;
}

.sc__card {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.sc__badge {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 17px;
}

.sc__body {
  min-width: 0;
  flex: 1;
}

.sc__title {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sc__tagline {
  font-size: 11px;
  opacity: 0.55;
}

.sc__desc {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.35;
  opacity: 0.72;
}

.sc__included {
  margin-top: 6px;
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.4;
}

.sc__actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.sc__empty {
  font-size: 13px;
  opacity: 0.6;
}

.sc__foot {
  margin-top: auto;
  font-size: 11px;
  opacity: 0.45;
}
</style>
