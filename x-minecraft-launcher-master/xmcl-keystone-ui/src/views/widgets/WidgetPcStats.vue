<template>
  <section class="widget-card pa-4" data-testid="widget-pc-stats">
    <div class="d-flex align-center gap-2">
      <v-icon color="primary" size="20">monitor_heart</v-icon>
      <h3 class="text-subtitle-2 font-weight-bold flex-grow">{{ t('appWidgets.pcStats.name') }}</h3>
      <v-btn
        :aria-label="t('appWidgets.refresh')"
        icon="refresh"
        size="x-small"
        variant="text"
        :loading="loading"
        @click="load"
      />
    </div>

    <template v-if="stats">
      <div class="mt-3 widget-metric">
        <div class="widget-metric__head">
          <span>{{ t('appWidgets.pcStats.cpu') }}</span>
          <span class="font-weight-medium">{{ Math.round(stats.cpu.usage) }}%</span>
        </div>
        <v-progress-linear :model-value="stats.cpu.usage" color="primary" height="6" rounded />
        <div class="widget-metric__hint">{{ stats.cpu.model }} · {{ stats.cpu.cores }} threads</div>
      </div>

      <div class="widget-metric">
        <div class="widget-metric__head">
          <span>{{ t('appWidgets.pcStats.memory') }}</span>
          <span class="font-weight-medium">{{ formatBytes(stats.memory.used) }} / {{ formatBytes(stats.memory.total) }}</span>
        </div>
        <v-progress-linear
          :model-value="percent(stats.memory.used, stats.memory.total)"
          color="secondary"
          height="6"
          rounded
        />
      </div>

      <div v-if="disk" class="widget-metric">
        <div class="widget-metric__head">
          <span>{{ t('appWidgets.pcStats.disk') }} {{ disk.name }}</span>
          <span class="font-weight-medium">{{ formatBytes(disk.free) }}</span>
        </div>
        <v-progress-linear
          :model-value="percent(disk.total - disk.free, disk.total)"
          color="warning"
          height="6"
          rounded
        />
        <div class="widget-metric__hint">
          {{ t('appWidgets.pcStats.free', { free: formatBytes(disk.free), total: formatBytes(disk.total) }) }}
        </div>
      </div>

      <div class="widget-metric d-flex align-center gap-3">
        <v-icon size="16">swap_vert</v-icon>
        <div class="text-caption flex-grow">
          <span class="text-medium-emphasis">{{ t('appWidgets.pcStats.down') }}</span>
          {{ formatRate(stats.network.down) }}
        </div>
        <div class="text-caption">
          <span class="text-medium-emphasis">{{ t('appWidgets.pcStats.up') }}</span>
          {{ formatRate(stats.network.up) }}
        </div>
      </div>

      <div class="widget-metric__hint">{{ t('appWidgets.pcStats.uptime') }} {{ uptime }}</div>
    </template>

    <div v-else class="mt-3 text-caption text-medium-emphasis">
      {{ failed ? t('appWidgets.pcStats.error') : t('appWidgets.pcStats.loading') }}
    </div>
  </section>
</template>

<script lang="ts" setup>
import type { SystemStats } from '@xmcl/runtime-api'
import { formatBytes, formatRate, formatUptime, percent } from '@/util/widgets'

const { t, locale } = useI18n()

const stats = ref<SystemStats>()
const loading = ref(false)
const failed = ref(false)

const disk = computed(() => stats.value?.disks[0])
const uptime = computed(() => stats.value ? formatUptime(stats.value.uptime, locale.value) : '')

let timer: ReturnType<typeof setInterval> | undefined

async function load() {
  if (loading.value) return
  loading.value = true
  try {
    stats.value = await windowController.getSystemStats()
    failed.value = false
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
  timer = setInterval(() => {
    if (!document.hidden) void load()
  }, 3000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>
