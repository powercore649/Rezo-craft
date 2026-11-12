<template>
  <div class="updater">
    <header class="updater__header">
      <div class="updater__brand">
        <div class="updater__logo">
          <v-icon size="24">rocket_launch</v-icon>
        </div>
        <div>
          <div class="updater__name">NovaCraft</div>
          <div class="updater__sub">{{ t('updaterWindow.title') }}</div>
        </div>
      </div>
      <v-btn
        v-if="state.phase !== 'installing'"
        icon="close"
        size="small"
        variant="text"
        :aria-label="t('updaterWindow.close')"
        @click="close"
      />
    </header>

    <main class="updater__body">
      <div class="updater__versions">
        <div class="updater__version">
          <span class="updater__label">{{ t('updaterWindow.current') }}</span>
          <span class="updater__value">v{{ state.currentVersion }}</span>
        </div>
        <v-icon class="updater__arrow" size="small">arrow_forward</v-icon>
        <div class="updater__version">
          <span class="updater__label">{{ t('updaterWindow.latest') }}</span>
          <span class="updater__value" :class="{ 'updater__value--new': hasNewVersion }">{{ state.version || '—' }}</span>
        </div>
        <v-chip size="small" :color="chipColor" variant="flat" class="ml-auto">{{ phaseText }}</v-chip>
      </div>

      <section class="updater__card">
        <div class="updater__headline">
          <span class="updater__percent">{{ state.phase === 'downloading' || state.phase === 'ready' ? `${Math.round(state.percent)} %` : phaseText }}</span>
          <span v-if="state.phase === 'downloading'" class="updater__live">
            <span class="updater__dot" /> {{ speedText }} · {{ t('updaterWindow.eta', { time: etaText }) }}
          </span>
        </div>

        <v-progress-linear
          :model-value="state.percent"
          :indeterminate="state.phase === 'checking' || state.phase === 'installing'"
          color="primary"
          height="10"
          rounded
        />

        <div v-if="state.phase === 'downloading'" class="updater__stats">
          <div class="updater__stat">
            <span class="updater__stat-label">{{ t('updaterWindow.received') }}</span>
            <span class="updater__stat-value">{{ sizeText }}</span>
          </div>
          <div class="updater__stat">
            <span class="updater__stat-label">{{ t('updaterWindow.speed') }}</span>
            <span class="updater__stat-value">{{ speedText }}</span>
          </div>
        </div>

        <div v-else-if="state.phase === 'ready'" class="updater__stats">
          <div class="updater__stat updater__stat--wide">
            <span class="updater__stat-label">{{ t('updaterWindow.ready') }}</span>
            <span class="updater__stat-value">{{ t('updaterWindow.autoInstallIn', { seconds: autoSeconds }) }}</span>
          </div>
        </div>

        <div v-else-if="state.phase === 'installing'" class="updater__stats">
          <div class="updater__stat updater__stat--wide">
            <span class="updater__stat-value">{{ t('updaterWindow.restarting') }}</span>
          </div>
        </div>

        <ol class="updater__steps">
          <li v-for="step in steps" :key="step.key" :class="`updater__step updater__step--${step.status}`">
            <v-icon size="16">{{ step.icon }}</v-icon>
            <span>{{ step.label }}</span>
          </li>
        </ol>
      </section>

      <v-alert v-if="state.error" type="error" variant="tonal" density="compact">
        {{ t('updaterWindow.error', { error: state.error }) }}
      </v-alert>

      <details v-if="state.notes" class="updater__notes">
        <summary>{{ t('updaterWindow.notes') }}</summary>
        <div class="updater__notes-body">{{ state.notes }}</div>
      </details>
    </main>

    <footer class="updater__footer">
      <span class="updater__hint">{{ t('updaterWindow.silentHint') }}</span>
      <div class="updater__actions">
        <v-btn v-if="state.phase !== 'installing'" variant="text" @click="close">{{ t('updaterWindow.later') }}</v-btn>
        <v-btn v-if="state.phase === 'available'" color="primary" :loading="busy" @click="download">
          {{ t('updaterWindow.download') }}
        </v-btn>
        <v-btn v-else-if="state.phase === 'ready'" color="primary" :loading="busy" @click="install">
          {{ t('updaterWindow.install') }}
        </v-btn>
        <v-btn v-else-if="state.phase === 'error' || state.phase === 'uptodate'" color="primary" variant="text" :loading="busy" @click="check">
          {{ t('updaterWindow.retry') }}
        </v-btn>
      </div>
    </footer>
  </div>
</template>

<script lang="ts" setup>
import type { UpdateLauncherState } from '@xmcl/runtime-api'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const { t } = useI18n()

const fallback: UpdateLauncherState = {
  open: true,
  phase: 'checking',
  currentVersion: '0.0.0',
  percent: 0,
  transferred: 0,
  total: 0,
  bytesPerSecond: 0,
}
const state = ref<UpdateLauncherState>(fallback)
const busy = ref(false)
const autoSeconds = ref(3)
let stopListener: (() => void) | undefined
let stopCountdown: (() => void) | undefined

const hasNewVersion = computed(() => !!state.value.version && `v${state.value.currentVersion}` !== state.value.version)

const phaseText = computed(() => {
  switch (state.value.phase) {
    case 'checking': return t('updaterWindow.check')
    case 'available': return t('updaterWindow.available', { version: state.value.version ?? '' })
    case 'downloading': return t('updaterWindow.downloading', { percent: Math.round(state.value.percent) })
    case 'ready': return t('updaterWindow.ready')
    case 'installing': return t('updaterWindow.installing')
    case 'uptodate': return t('updaterWindow.upToDate')
    case 'error': return t('updaterWindow.error', { error: state.value.error ?? '' })
    default: return t('updaterWindow.title')
  }
})

const chipColor = computed(() => {
  if (state.value.phase === 'error') return 'error'
  if (state.value.phase === 'ready') return 'success'
  if (state.value.phase === 'available' || state.value.phase === 'downloading') return 'primary'
  return undefined
})

const sizeText = computed(() => {
  const mb = (value: number) => `${(value / (1024 * 1024)).toFixed(1)} Mo`
  if (!state.value.total) return '—'
  return `${mb(state.value.transferred)} / ${mb(state.value.total)}`
})

const speedText = computed(() => {
  const speed = state.value.bytesPerSecond
  if (!speed) return '—'
  return `${(speed / (1024 * 1024)).toFixed(1)} Mo/s`
})

const etaText = computed(() => {
  const { bytesPerSecond, total, transferred, phase } = state.value
  if (phase !== 'downloading' || !bytesPerSecond || !total) return '—'
  const seconds = Math.max(0, Math.round((total - transferred) / bytesPerSecond))
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} min ${String(seconds % 60).padStart(2, '0')} s`
})

const steps = computed(() => {
  const phase = state.value.phase
  const order = phase === 'installing' ? 2 : phase === 'ready' ? 1 : phase === 'downloading' || phase === 'available' || phase === 'checking' ? 0 : -1
  const entries = [
    { key: 'download', label: t('updaterWindow.stepDownload') },
    { key: 'install', label: t('updaterWindow.stepInstall') },
    { key: 'restart', label: t('updaterWindow.stepRestart') },
  ]
  return entries.map((entry, index) => {
    const done = order > index || (phase === 'ready' && index === 0)
    const status = done ? 'done' : order === index ? 'active' : 'pending'
    return {
      ...entry,
      status,
      icon: done ? 'check_circle' : status === 'active' ? 'sync' : 'radio_button_unchecked',
    }
  })
})

watch(() => state.value.phase, (phase) => {
  stopCountdown?.()
  stopCountdown = undefined
  autoSeconds.value = 3
  if (phase !== 'ready') return
  const timer = setInterval(() => {
    autoSeconds.value = Math.max(0, autoSeconds.value - 1)
  }, 1000)
  stopCountdown = () => clearInterval(timer)
})

async function run(action: () => Promise<unknown>) {
  busy.value = true
  try {
    await action()
  } finally {
    busy.value = false
  }
}

const check = () => run(() => windowController.checkUpdateInLauncher())
const download = () => run(() => windowController.downloadUpdateInLauncher())
const install = () => run(() => windowController.installUpdateFromLauncher())
const close = () => windowController.closeUpdateLauncher()

onMounted(() => {
  void windowController.getUpdateLauncherState().then((value) => { state.value = value }).catch(() => {})
  stopListener = windowController.onUpdateLauncherState((value) => {
    state.value = value
  })
})

onUnmounted(() => {
  stopListener?.()
  stopCountdown?.()
})
</script>

<style scoped>
.updater {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: rgba(255, 255, 255, 0.92);
  background: radial-gradient(circle at 15% -10%, rgba(76, 120, 255, 0.35), transparent 55%), #0f1117;
  font-family: 'Segoe UI', 'Inter', system-ui, sans-serif;
}

.updater__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px 10px;
  -webkit-app-region: drag;
}

.updater__brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.updater__logo {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(135deg, #5b8cff, #7a5bff);
  box-shadow: 0 6px 18px rgba(91, 140, 255, 0.35);
}

.updater__name {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.updater__sub {
  font-size: 0.75rem;
  opacity: 0.65;
}

.updater__header :deep(.v-btn) {
  -webkit-app-region: no-drag;
  margin-left: auto;
}

.updater__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  padding: 6px 20px 14px;
  overflow: auto;
}

.updater__versions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
}

.updater__version {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.updater__label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.55;
}

.updater__value {
  font-size: 1.1rem;
  font-weight: 700;
}

.updater__value--new {
  color: #7ea6ff;
}

.updater__arrow {
  opacity: 0.4;
}

.updater__card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
}

.updater__headline {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.updater__percent {
  font-size: 1.6rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.updater__live {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  opacity: 0.7;
}

.updater__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #5cd07a;
  box-shadow: 0 0 8px rgba(92, 208, 122, 0.8);
}

.updater__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.updater__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
}

.updater__stat--wide {
  grid-column: 1 / -1;
}

.updater__stat-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.55;
}

.updater__stat-value {
  font-size: 0.88rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.updater__steps {
  display: flex;
  gap: 18px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.78rem;
}

.updater__step {
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.45;
}

.updater__step--done {
  opacity: 0.9;
  color: #7ee0a1;
}

.updater__step--active {
  opacity: 1;
}

.updater__step--active :deep(.v-icon) {
  color: #7ea6ff;
  animation: spin 1.4s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.updater__notes {
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);
  font-size: 0.82rem;
}

.updater__notes summary {
  cursor: pointer;
  font-weight: 600;
  opacity: 0.85;
}

.updater__notes-body {
  margin-top: 8px;
  max-height: 130px;
  overflow: auto;
  white-space: pre-wrap;
  opacity: 0.7;
}

.updater__footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.updater__hint {
  flex: 1;
  font-size: 0.72rem;
  line-height: 1.35;
  opacity: 0.5;
}

.updater__actions {
  display: flex;
  gap: 8px;
}
</style>
