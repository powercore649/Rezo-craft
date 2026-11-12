<template>
  <div>
    <SettingCard
      class="mb-4"
      icon="system_update"
      :title="t('setting.windowsUpdate')"
      :subtitle="t('setting.windowsUpdateDescription')"
    >
      <div v-if="state && !state.supported" class="wu-empty">
        <v-icon size="small">desktop_windows</v-icon>
        <span>{{ t('setting.windowsUpdateUnsupported') }}</span>
      </div>

      <template v-else-if="state">
        <div class="wu-head">
          <div class="wu-summary">
            <v-chip :color="statusColor" size="small" variant="flat" prepend-icon="security_update_good">
              {{ statusText }}
            </v-chip>
            <span class="wu-meta">{{ lastScanText }}</span>
            <span v-if="totalSize" class="wu-meta">{{ t('setting.windowsUpdateSize', { size: formatSize(totalSize) }) }}</span>
          </div>
          <div class="wu-actions">
            <v-btn size="small" variant="text" prepend-icon="open_in_new" @click="openSettings">
              {{ t('setting.windowsUpdateOpen') }}
            </v-btn>
            <v-btn size="small" variant="tonal" prepend-icon="search" :disabled="busy" :loading="state.phase === 'scanning'" @click="scan">
              {{ t('setting.windowsUpdateScan') }}
            </v-btn>
            <v-btn
              size="small"
              color="primary"
              prepend-icon="download"
              :disabled="busy || !state.updates.length || !state.elevated"
              :loading="state.phase === 'downloading' || state.phase === 'installing'"
              @click="install"
            >
              {{ t('setting.windowsUpdateInstall') }}
            </v-btn>
          </div>
        </div>

        <div v-if="phaseText" class="wu-progress">
          <v-progress-linear :indeterminate="true" color="primary" height="6" rounded />
          <span>{{ phaseText }}</span>
        </div>

        <v-alert v-if="state.error" type="error" variant="tonal" density="compact" class="mt-3">
          {{ t('setting.windowsUpdateError', { error: state.error }) }}
        </v-alert>

        <v-alert v-else-if="state.result === 'succeeded' && state.phase === 'done'" type="success" variant="tonal" density="compact" class="mt-3">
          {{ t('setting.windowsUpdateDone') }}
        </v-alert>

        <v-alert v-if="state.rebootRequired" type="warning" variant="tonal" density="compact" class="mt-3">
          {{ t('setting.windowsUpdateReboot') }}
        </v-alert>

        <v-alert v-if="!state.elevated" type="info" variant="tonal" density="compact" class="mt-3">
          {{ t('setting.windowsUpdateNeedsAdmin') }}
        </v-alert>

        <div v-if="state.updates.length" class="wu-list">
          <div v-for="item in state.updates" :key="item.id" class="wu-item">
            <div class="wu-item__main">
              <span class="wu-item__title">{{ item.title }}</span>
              <div class="wu-item__tags">
                <v-chip v-for="kb in item.kb" :key="kb" size="x-small" variant="tonal">KB{{ kb }}</v-chip>
                <v-chip v-if="item.severity" size="x-small" :color="severityColor(item.severity)" variant="tonal">
                  {{ item.severity }}
                </v-chip>
                <v-chip v-if="item.downloaded" size="x-small" color="success" variant="tonal" prepend-icon="check">
                  {{ t('setting.windowsUpdateDownloaded') }}
                </v-chip>
              </div>
            </div>
            <span class="wu-item__size">{{ item.size ? formatSize(item.size) : '—' }}</span>
          </div>
        </div>
      </template>

      <v-skeleton-loader v-else type="article" />
    </SettingCard>
  </div>
</template>

<script lang="ts" setup>
import type { WindowsUpdateState } from '@xmcl/runtime-api'
import { computed, onMounted, onUnmounted, ref } from 'vue'

const { t } = useI18n()

const state = ref<WindowsUpdateState>()
const busy = ref(false)
let stopListener: (() => void) | undefined

const totalSize = computed(() => (state.value?.updates ?? []).reduce((sum, item) => sum + (item.size || 0), 0))

const statusText = computed(() => {
  const value = state.value
  if (!value) return ''
  if (value.phase === 'scanning') return t('setting.windowsUpdateScanning')
  if (!value.lastScan) return t('setting.windowsUpdateNotScanned')
  if (value.updates.length) return t('setting.windowsUpdateAvailable', { count: value.updates.length })
  return t('setting.windowsUpdateUpToDate')
})

const statusColor = computed(() => {
  const value = state.value
  if (!value) return undefined
  if (value.phase === 'error') return 'error'
  if (value.phase === 'done' && value.result === 'succeeded') return 'success'
  return value.updates.length ? 'primary' : 'success'
})

const phaseText = computed(() => {
  switch (state.value?.phase) {
    case 'scanning': return t('setting.windowsUpdateScanning')
    case 'downloading': return t('setting.windowsUpdateDownloading')
    case 'installing': return t('setting.windowsUpdateInstalling')
    default: return ''
  }
})

const lastScanText = computed(() => {
  const at = state.value?.lastScan
  if (!at) return ''
  return t('setting.windowsUpdateLastScan', { time: new Date(at).toLocaleTimeString() })
})

function formatSize(bytes: number) {
  if (!bytes) return '—'
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} Go`
  return `${Math.round(bytes / 1024 ** 2)} Mo`
}

function severityColor(severity: string) {
  switch (severity.toLowerCase()) {
    case 'critical': return 'error'
    case 'important': return 'warning'
    default: return undefined
  }
}

async function scan() {
  busy.value = true
  try {
    state.value = await windowController.scanWindowsUpdates()
  } finally {
    busy.value = false
  }
}

async function install() {
  busy.value = true
  try {
    state.value = await windowController.installWindowsUpdates()
  } finally {
    busy.value = false
  }
}

function openSettings() {
  windowController.openWindowsUpdateSettings()
}

onMounted(() => {
  void windowController.getWindowsUpdateState().then((value) => { state.value = value }).catch(() => {})
  stopListener = windowController.onWindowsUpdateState((value) => {
    state.value = value
  })
})

onUnmounted(() => {
  stopListener?.()
})
</script>

<style scoped>
.wu-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 4px;
  opacity: 0.7;
  font-size: 0.85rem;
}

.wu-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 4px 0 8px;
}

.wu-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex: 1;
}

.wu-meta {
  font-size: 0.76rem;
  opacity: 0.6;
}

.wu-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.wu-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 6px 0;
  font-size: 0.78rem;
  opacity: 0.85;
}

.wu-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
}

.wu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
}

.wu-item__main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.wu-item__title {
  font-size: 0.86rem;
  font-weight: 600;
  line-height: 1.3;
}

.wu-item__tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.wu-item__size {
  font-size: 0.78rem;
  opacity: 0.6;
  white-space: nowrap;
}
</style>
