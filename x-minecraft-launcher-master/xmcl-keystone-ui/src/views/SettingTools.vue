<template>
  <div>
    <SettingCard
      class="mb-4"
      icon="desktop_windows"
      :title="t('setting.toolsWidgets')"
      :subtitle="t('setting.toolsWidgetsHint')"
    >
      <SettingItemSwitcher
        :model-value="desktopEnabled"
        :title="t('setting.toolsWidgets')"
        :description="desktopEnabled ? t('setting.toolsWidgetsOn') : t('setting.toolsWidgetsOff')"
        icon="desktop_windows"
        @update:model-value="toggleDesktopWidget"
      />
    </SettingCard>

    <SettingCard
      class="mb-4"
      icon="description"
      :title="t('setting.toolsLibrary')"
      :subtitle="t('setting.toolsLibraryHint')"
    >
      <div class="tools-stats">
        <div class="tools-stat">
          <v-icon size="small" color="primary">sticky_note_2</v-icon>
          <span class="tools-stat__value">{{ notes.length }}</span>
          <span class="tools-stat__label">{{ t('setting.toolsNotes') }}</span>
        </div>
        <div class="tools-stat">
          <v-icon size="small" color="primary">article</v-icon>
          <span class="tools-stat__value">{{ documents.length }}</span>
          <span class="tools-stat__label">{{ t('setting.toolsDocuments') }}</span>
        </div>
        <div class="tools-stat">
          <v-icon size="small" color="primary">save</v-icon>
          <span class="tools-stat__value">{{ formatBytes(localSize) }}</span>
          <span class="tools-stat__label">{{ t('setting.toolsSize') }}</span>
        </div>
      </div>

      <v-divider class="my-3" />

      <div class="flex flex-wrap gap-2">
        <v-btn
          color="primary"
          variant="text"
          border
          size="small"
          prepend-icon="file_download"
          :disabled="!notes.length && !documents.length"
          @click="exportAll"
        >
          {{ t('setting.toolsExport') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="text"
          border
          size="small"
          prepend-icon="file_upload"
          @click="fileInput?.click()"
        >
          {{ t('setting.toolsImport') }}
        </v-btn>
        <v-btn
          color="error"
          variant="text"
          border
          size="small"
          prepend-icon="delete_forever"
          :disabled="!notes.length && !documents.length"
          @click="showClearDialog = true"
        >
          {{ t('setting.toolsClear') }}
        </v-btn>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          class="hidden-input"
          @change="onImportFile"
        >
      </div>
    </SettingCard>

    <SettingCard
      icon="sd_storage"
      :title="t('setting.toolsStorage')"
      :subtitle="t('setting.toolsStorageHint')"
    >
      <SettingItem :title="t('setting.toolsStorage')" :description="storageText">
        <template #title>
          <v-icon start size="small" color="primary">sd_storage</v-icon>
          {{ t('setting.toolsStorage') }}
        </template>
        <template #action>
          <v-progress-linear
            :model-value="storagePercent"
            color="primary"
            height="6"
            rounded
            class="tools-storage-bar"
          />
        </template>
      </SettingItem>

      <v-divider class="my-3" />

      <SettingItem :title="t('setting.toolsOpenData')" :description="root">
        <template #title>
          <v-icon start size="small" color="primary">folder_open</v-icon>
          {{ t('setting.toolsOpenData') }}
        </template>
        <template #action>
          <v-btn color="primary" variant="text" border size="small" prepend-icon="folder_open" @click="showGameDirectory()">
            {{ t('setting.toolsOpenData') }}
          </v-btn>
        </template>
      </SettingItem>
    </SettingCard>

    <SettingCard
      class="mb-4"
      icon="troubleshoot"
      :title="t('setting.toolsDiagnostic')"
      :subtitle="t('setting.toolsDiagnosticHint')"
    >
      <div class="flex flex-wrap items-center gap-2">
        <v-btn color="primary" variant="text" border size="small" prepend-icon="content_copy" @click="copyDiagnostic">
          {{ t('setting.toolsDiagnosticCopy') }}
        </v-btn>
      </div>
    </SettingCard>

    <v-dialog v-model="showClearDialog" max-width="480">
      <v-card>
        <v-card-title class="pt-4 text-error">
          <v-icon start color="error">warning</v-icon>
          {{ t('setting.toolsClearTitle') }}
        </v-card-title>
        <v-card-text>{{ t('setting.toolsClearMessage') }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showClearDialog = false">{{ t('shared.cancel') }}</v-btn>
          <v-btn color="error" @click="clearAll">{{ t('setting.toolsClear') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingCard from '@/components/SettingCard.vue'
import SettingItem from '@/components/SettingItem.vue'
import SettingItemSwitcher from '@/components/SettingItemSwitcher.vue'
import { useNotes } from '@/composables/notes'
import { useDocuments } from '@/composables/documents'
import { useNotifier } from '@/composables/notifier'
import { useGameDirectory } from '@/composables/setting'

const { t } = useI18n()
const { notify } = useNotifier()
const { notes } = useNotes()
const { documents } = useDocuments()
const { root, showGameDirectory } = useGameDirectory()

// --- Desktop widgets ---
const desktopEnabled = ref(false)
let stopDesktopListener: (() => void) | undefined

async function toggleDesktopWidget(value: boolean) {
  try {
    const state = await windowController.setDesktopWidget(value)
    desktopEnabled.value = state.enabled
  } catch {
    desktopEnabled.value = false
    notify({ level: 'error', title: t('setting.toolsWidgetsError') })
  }
}

onMounted(() => {
  void windowController.getDesktopWidgetState()
    .then((state) => { desktopEnabled.value = state.enabled })
    .catch(() => { desktopEnabled.value = false })
  stopDesktopListener = windowController.onDesktopWidgetState((state) => {
    desktopEnabled.value = state.enabled
  })
})

onUnmounted(() => {
  stopDesktopListener?.()
})

// --- Notes & documents ---
const showClearDialog = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const localSize = computed(() => new Blob([
  JSON.stringify(notes.value),
  JSON.stringify(documents.value),
]).size)

async function copyDiagnostic() {
  const [update, stats, battery] = await Promise.all([
    windowController.getUpdateLauncherState().catch(() => undefined),
    windowController.getSystemStats().catch(() => undefined),
    windowController.getBatteryState().catch(() => undefined),
  ])
  const gb = (value: number) => `${(value / (1024 ** 3)).toFixed(1)} Go`
  const lines = [
    'NovaCraft — diagnostic',
    `version: ${update?.currentVersion ?? 'inconnue'}`,
    `os: ${navigator.userAgent}`,
    `cpu: ${stats?.cpu?.model || 'n/a'} (${stats?.cpu?.cores ?? 0} cœurs, ${Math.round(stats?.cpu?.usage ?? 0)} %)`,
    `ram: ${stats?.memory ? `${gb(stats.memory.used)} / ${gb(stats.memory.total)}` : 'n/a'}`,
    `gpu: ${stats?.gpu ?? 'n/a'}`,
    `batterie: ${battery ? `${battery.percent} %${battery.charging ? ' (en charge)' : ''}` : 'n/a'}`,
    `notes: ${notes.value.length} · documents: ${documents.value.length}`,
    `données: ${root.value}`,
    `date: ${new Date().toISOString()}`,
  ]
  await windowController.writeClipboard(lines.join('\n'))
  notify({ level: 'success', title: t('setting.toolsDiagnosticCopied') })
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`
}

function exportAll() {
  const payload = {
    app: 'NovaCraft',
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: notes.value,
    documents: documents.value,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `novacraft-notes-documents-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  notify({
    level: 'success',
    title: t('setting.toolsExported'),
    body: t('setting.toolsExportedBody', { notes: notes.value.length, documents: documents.value.length }),
  })
}

function readNotes(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => item && typeof item.id === 'string')
    .map((item) => ({
      id: item.id as string,
      title: typeof item.title === 'string' ? item.title : '',
      content: typeof item.content === 'string' ? item.content : '',
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
    }))
}

function readDocuments(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => item && typeof item.id === 'string')
    .map((item) => ({
      id: item.id as string,
      title: typeof item.title === 'string' ? item.title : '',
      html: typeof item.html === 'string' ? item.html : '',
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
    }))
}

async function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  let importedNotes: ReturnType<typeof readNotes> = []
  let importedDocuments: ReturnType<typeof readDocuments> = []
  try {
    const parsed = JSON.parse(await file.text())
    importedNotes = readNotes(parsed?.notes)
    importedDocuments = readDocuments(parsed?.documents)
    if (!importedNotes.length && !importedDocuments.length) throw new Error('empty backup')
  } catch {
    notify({ level: 'error', title: t('setting.toolsImportError') })
    return
  }

  const mergedNotes = new Map(notes.value.map((note) => [note.id, note]))
  for (const note of importedNotes) mergedNotes.set(note.id, note)
  notes.value = [...mergedNotes.values()].sort((a, b) => b.updatedAt - a.updatedAt)

  const mergedDocuments = new Map(documents.value.map((document) => [document.id, document]))
  for (const document of importedDocuments) mergedDocuments.set(document.id, document)
  documents.value = [...mergedDocuments.values()].sort((a, b) => b.updatedAt - a.updatedAt)

  notify({
    level: 'success',
    title: t('setting.toolsImported'),
    body: t('setting.toolsImportedBody', {
      notes: importedNotes.length,
      documents: importedDocuments.length,
    }),
  })
}

function clearAll() {
  notes.value = []
  documents.value = []
  showClearDialog.value = false
  notify({ level: 'info', title: t('setting.toolsCleared') })
}

// --- Local storage usage ---
const usage = ref(0)
const quota = ref(0)
const storagePercent = computed(() => quota.value ? Math.min(100, (usage.value / quota.value) * 100) : 0)
const storageText = computed(() => quota.value
  ? t('setting.toolsStorageValue', { used: formatBytes(usage.value), total: formatBytes(quota.value) })
  : formatBytes(usage.value))

onMounted(async () => {
  try {
    const estimate = await navigator.storage?.estimate?.()
    usage.value = estimate?.usage ?? 0
    quota.value = estimate?.quota ?? 0
  } catch {
    usage.value = localSize.value
  }
})
</script>

<style scoped>
.tools-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.tools-stat {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(var(--v-theme-primary), 0.08);
}

.tools-stat__value {
  font-weight: 600;
  font-size: 1.05rem;
}

.tools-stat__label {
  font-size: 0.8rem;
  opacity: 0.75;
}

.tools-storage-bar {
  width: 220px;
}

.hidden-input {
  display: none;
}
</style>
