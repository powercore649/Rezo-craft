<template>
  <div>
    <SettingCard
      class="mb-4"
      icon="battery_charging_full"
      :title="t('setting.battery')"
      :subtitle="t('setting.batteryDescription')"
    >
      <div v-if="state && !state.present" class="battery-empty">
        <v-icon size="small">power_off</v-icon>
        <span>{{ t('setting.batteryUnsupported') }}</span>
      </div>

      <template v-else-if="state">
        <div class="battery-head">
          <div class="battery-gauge" :style="{ '--battery-color': gaugeColor }">
            <v-progress-circular
              :model-value="state.percent"
              :color="gaugeColor"
              :size="112"
              :width="10"
              bg-color="rgba(255,255,255,0.08)"
            >
              <div class="battery-gauge__inner">
                <v-icon v-if="state.charging" color="success" size="18">bolt</v-icon>
                <span class="battery-gauge__value">{{ state.percent }}%</span>
              </div>
            </v-progress-circular>
          </div>

          <div class="battery-summary">
            <v-chip :color="chipColor" size="small" variant="flat">{{ statusLabel }}</v-chip>
            <div class="battery-summary__line">
              <v-icon size="16">schedule</v-icon>
              <span>{{ remaining }}</span>
            </div>
            <div class="battery-summary__line">
              <v-icon size="16">power</v-icon>
              <span>{{ state.onAc ? t('setting.batteryPlugged') : t('setting.batteryOnBattery') }}</span>
            </div>
            <div v-if="state.model" class="battery-summary__line">
              <v-icon size="16">memory</v-icon>
              <span>{{ state.model }}</span>
            </div>
          </div>
        </div>

        <div class="battery-grid">
          <div class="battery-stat">
            <span class="battery-stat__label">{{ t('setting.batteryHealth') }}</span>
            <span class="battery-stat__value">{{ state.health !== undefined ? `${state.health}%` : '—' }}</span>
          </div>
          <div class="battery-stat">
            <span class="battery-stat__label">{{ t('setting.batteryCapacity') }}</span>
            <span class="battery-stat__value">{{ capacity(state.fullCapacity) }}</span>
          </div>
          <div class="battery-stat">
            <span class="battery-stat__label">{{ t('setting.batteryDesign') }}</span>
            <span class="battery-stat__value">{{ capacity(state.designCapacity) }}</span>
          </div>
          <div class="battery-stat">
            <span class="battery-stat__label">{{ t('setting.batteryCycles') }}</span>
            <span class="battery-stat__value">{{ state.cycleCount ?? '—' }}</span>
          </div>
        </div>

        <v-divider class="my-4" />

        <SettingItemSwitcher
          :model-value="state.trayIcon"
          :title="t('setting.batteryTray')"
          :description="t('setting.batteryTrayHint')"
          icon="battery_full"
          @update:model-value="setTray"
        />
        <SettingItemSwitcher
          :model-value="state.alerts"
          :title="t('setting.batteryAlerts')"
          :description="t('setting.batteryAlertsHint')"
          icon="notifications_active"
          @update:model-value="setAlerts"
        />

        <div class="mt-3 flex justify-end">
          <v-btn size="small" variant="text" prepend-icon="refresh" @click="refresh">
            {{ t('setting.batteryRefresh') }}
          </v-btn>
        </div>
      </template>

      <v-skeleton-loader v-else type="article" />
    </SettingCard>
  </div>
</template>

<script lang="ts" setup>
import type { BatteryState } from '@xmcl/runtime-api'
import { computed, onMounted, onUnmounted, ref } from 'vue'

const { t } = useI18n()

const state = ref<BatteryState>()
let stopListener: (() => void) | undefined

const gaugeColor = computed(() => {
  const value = state.value
  if (!value) return 'primary'
  if (value.charging) return 'success'
  if (value.percent <= 15) return 'error'
  if (value.percent <= 30) return 'warning'
  return 'primary'
})

const chipColor = computed(() => {
  const value = state.value
  if (!value) return undefined
  if (value.charging) return 'success'
  if (value.percent <= 15) return 'error'
  if (value.percent <= 30) return 'warning'
  return 'default'
})

const statusLabel = computed(() => {
  const value = state.value
  if (!value) return ''
  if (value.charging) return t('setting.batteryCharging')
  if (value.percent >= 99) return t('setting.batteryFull')
  return t('setting.batteryDischarging')
})

const remaining = computed(() => {
  const minutes = state.value?.timeRemaining ?? -1
  if (minutes <= 0) return t('setting.batteryRemainingUnknown')
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours > 0
    ? t('setting.batteryRemaining', { hours, minutes: rest })
    : t('setting.batteryRemainingMinutes', { minutes: rest })
})

function capacity(value?: number) {
  if (!value) return '—'
  return `${(value / 1000).toFixed(1)} Wh`
}

async function refresh() {
  state.value = await windowController.refreshBattery()
}

async function setTray(enabled: boolean) {
  state.value = await windowController.setBatteryTrayIcon(enabled)
}

async function setAlerts(enabled: boolean) {
  state.value = await windowController.setBatteryAlerts(enabled)
}

onMounted(() => {
  void windowController.getBatteryState().then((value) => { state.value = value }).catch(() => {})
  void windowController.refreshBattery().then((value) => { state.value = value }).catch(() => {})
  stopListener = windowController.onBatteryState((value) => {
    state.value = value
  })
})

onUnmounted(() => {
  stopListener?.()
})
</script>

<style scoped>
.battery-head {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
  padding: 8px 0 4px;
}

.battery-gauge__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.battery-gauge__value {
  font-size: 1.45rem;
  font-weight: 700;
}

.battery-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.85rem;
}

.battery-summary__line {
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0.8;
}

.battery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
  margin-top: 18px;
}

.battery-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
}

.battery-stat__label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.55;
}

.battery-stat__value {
  font-size: 1rem;
  font-weight: 600;
}

.battery-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 4px;
  opacity: 0.7;
  font-size: 0.85rem;
}
</style>
