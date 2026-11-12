<template>
  <div>
    <SettingCard
      class="mb-4"
      icon="shield"
      :title="t('antivirus.title')"
      :subtitle="t('antivirus.description')"
    >
      <div v-if="state && !state.supported" class="av-empty">
        <v-icon size="small">desktop_windows</v-icon>
        <span>{{ t('antivirus.unsupported') }}</span>
      </div>

      <template v-else-if="state">
        <v-alert v-if="!state.defenderEnabled" type="warning" variant="tonal" density="compact" class="mb-3">
          {{ t('antivirus.defenderOff') }}
        </v-alert>

        <div class="av-grid">
          <div class="av-stat">
            <span class="av-stat__label">{{ t('antivirus.realtime') }}</span>
            <span class="av-stat__value" :class="{ 'av-stat__value--on': state.realtimeEnabled, 'av-stat__value--off': !state.realtimeEnabled }">
              {{ state.realtimeEnabled ? t('antivirus.enabled') : t('antivirus.disabled') }}
            </span>
          </div>
          <div class="av-stat">
            <span class="av-stat__label">{{ t('antivirus.signatures') }}</span>
            <span class="av-stat__value">{{ state.signatureVersion || '—' }}</span>
          </div>
          <div class="av-stat">
            <span class="av-stat__label">{{ t('antivirus.engine') }}</span>
            <span class="av-stat__value">{{ state.engineVersion || '—' }}</span>
          </div>
          <div class="av-stat">
            <span class="av-stat__label">{{ t('antivirus.tamper') }}</span>
            <span class="av-stat__value">{{ state.tamperProtected ? t('antivirus.enabled') : t('antivirus.disabled') }}</span>
          </div>
          <div class="av-stat">
            <span class="av-stat__label">{{ t('antivirus.lastQuick') }}</span>
            <span class="av-stat__value">{{ formatDate(state.lastQuickScanAt) }}</span>
          </div>
          <div class="av-stat">
            <span class="av-stat__label">{{ t('antivirus.lastFull') }}</span>
            <span class="av-stat__value">{{ formatDate(state.lastFullScanAt) }}</span>
          </div>
        </div>

        <div class="av-actions">
          <v-btn size="small" color="primary" prepend-icon="bolt" :disabled="busy" :loading="state.phase === 'scanning' && state.scope === 'quick'" @click="scan('quick')">
            {{ t('antivirus.quickScan') }}
          </v-btn>
          <v-btn size="small" variant="tonal" prepend-icon="folder_open" :disabled="busy" :loading="state.phase === 'scanning' && state.scope === 'mods'" @click="scan('mods')">
            {{ t('antivirus.modsScan') }}
          </v-btn>
          <v-btn size="small" variant="text" prepend-icon="refresh" :disabled="busy" @click="refresh">
            {{ t('antivirus.refresh') }}
          </v-btn>
          <v-btn size="small" variant="text" prepend-icon="open_in_new" @click="openSecurity">
            {{ t('antivirus.open') }}
          </v-btn>
        </div>

        <div v-if="state.phase === 'scanning'" class="av-progress">
          <v-progress-linear
            :model-value="state.percent"
            :indeterminate="state.scope === 'quick'"
            color="primary"
            height="6"
            rounded
          />
          <div class="av-progress__row">
            <span>{{ progressText }}</span>
            <span class="av-progress__time">{{ t('antivirus.time', { time: elapsed }) }}</span>
          </div>
        </div>

        <v-alert v-if="state.error" type="error" variant="tonal" density="compact" class="mt-3">
          {{ t('antivirus.error', { error: state.error }) }}
        </v-alert>
        <v-alert v-else-if="state.phase === 'done'" :type="state.found ? 'warning' : 'success'" variant="tonal" density="compact" class="mt-3">
          {{ state.found ? t('antivirus.threats', { count: state.found }) : t('antivirus.done') }}
        </v-alert>

        <div v-if="state.threats.length" class="av-threats">
          <div v-for="threat in state.threats" :key="threat.id + threat.name" class="av-threat">
            <div class="av-threat__main">
              <span class="av-threat__name">{{ threat.name }}</span>
              <span v-if="threat.path" class="av-threat__path">{{ threat.path }}</span>
            </div>
            <v-chip size="x-small" :color="severityColor(threat.severity)" variant="tonal">
              {{ threat.active ? t('antivirus.active') : formatDate(threat.at) }}
            </v-chip>
          </div>
        </div>

        <p class="av-note">{{ t('antivirus.disclaimer') }}</p>
      </template>

      <v-skeleton-loader v-else type="article" />
    </SettingCard>
  </div>
</template>

<script lang="ts" setup>
import type { AntivirusState } from '@xmcl/runtime-api'
import { computed, onMounted, onUnmounted, ref } from 'vue'

const { t } = useI18n()

const state = ref<AntivirusState>()
const busy = ref(false)
const now = ref(Date.now())
let stopListener: (() => void) | undefined
let ticker: ReturnType<typeof setInterval> | undefined

const progressText = computed(() => {
  const value = state.value
  if (!value) return ''
  if (value.scope === 'mods' && value.targets) {
    return t('antivirus.scanningMods', { done: value.scannedTargets, total: value.targets })
  }
  return t('antivirus.scanning')
})

const elapsed = computed(() => {
  const started = state.value?.startedAt
  if (!started) return '0 s'
  const finished = state.value?.finishedAt ?? now.value
  const seconds = Math.max(0, Math.round((finished - started) / 1000))
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} min ${String(seconds % 60).padStart(2, '0')} s`
})

function formatDate(at?: number) {
  if (!at) return t('antivirus.never')
  return new Date(at).toLocaleString()
}

function severityColor(severity: number) {
  if (severity >= 4) return 'error'
  if (severity >= 3) return 'warning'
  return undefined
}

async function scan(scope: 'quick' | 'mods') {
  busy.value = true
  try {
    state.value = await windowController.scanAntivirus(scope)
  } finally {
    busy.value = false
  }
}

async function refresh() {
  busy.value = true
  try {
    state.value = await windowController.refreshAntivirusStatus()
  } finally {
    busy.value = false
  }
}

function openSecurity() {
  windowController.openWindowsSecurity()
}

onMounted(() => {
  void windowController.getAntivirusState().then((value) => { state.value = value }).catch(() => {})
  void windowController.refreshAntivirusStatus().then((value) => { state.value = value }).catch(() => {})
  stopListener = windowController.onAntivirusState((value) => {
    state.value = value
  })
  ticker = setInterval(() => { now.value = Date.now() }, 1000)
})

onUnmounted(() => {
  stopListener?.()
  if (ticker) clearInterval(ticker)
})
</script>

<style scoped>
.av-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 4px;
  opacity: 0.7;
  font-size: 0.85rem;
}

.av-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.av-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
}

.av-stat__label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.55;
}

.av-stat__value {
  font-size: 0.95rem;
  font-weight: 600;
}

.av-stat__value--on {
  color: #7ee0a1;
}

.av-stat__value--off {
  color: #f0a35e;
}

.av-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.av-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
  font-size: 0.78rem;
}

.av-progress__row {
  display: flex;
  justify-content: space-between;
  opacity: 0.8;
}

.av-progress__time {
  opacity: 0.6;
}

.av-threats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
}

.av-threat {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 120, 120, 0.25);
  border-radius: 10px;
  background: rgba(255, 90, 90, 0.06);
}

.av-threat__main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.av-threat__name {
  font-size: 0.86rem;
  font-weight: 600;
}

.av-threat__path {
  font-size: 0.72rem;
  opacity: 0.6;
  word-break: break-all;
}

.av-note {
  margin: 16px 0 0;
  font-size: 0.74rem;
  line-height: 1.45;
  opacity: 0.5;
}
</style>
