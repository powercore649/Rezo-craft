<template>
  <SettingCard
    data-testid="setting-cpu-trace-card"
    :title="t('cpuTrace.name')"
    :subtitle="t('cpuTrace.description')"
    icon="monitor_heart"
  >
    <template #header-action>
      <v-btn
        :color="recording ? 'error' : 'primary'"
        :prepend-icon="recording ? 'stop_circle' : 'radio_button_checked'"
        variant="flat"
        size="small"
        :loading="working"
        data-testid="cpu-trace-toggle"
        @click="toggle"
      >
        {{ recording ? t('cpuTrace.stop') : t('cpuTrace.start') }}
      </v-btn>
    </template>

    <div class="text-body-2 text-medium-emphasis">
      {{ recording ? t('cpuTrace.recordingHint') : t('cpuTrace.idleHint') }}
    </div>
    <div v-if="lastFile" class="text-caption mt-2 text-truncate" :title="lastFile">
      {{ t('cpuTrace.savedAt', { file: lastFile }) }}
    </div>
  </SettingCard>
</template>

<script lang="ts" setup>
import SettingCard from '@/components/SettingCard.vue'
import { useNotifier } from '@/composables/notifier'
import { onMounted, ref } from 'vue'

const { t } = useI18n()
const { notify } = useNotifier()

const recording = ref(false)
const working = ref(false)
const lastFile = ref('')

onMounted(async () => {
  recording.value = await windowController.isCpuTraceRecording()
})

async function toggle() {
  if (working.value) return
  working.value = true
  try {
    if (recording.value) {
      const result = await windowController.stopCpuTrace()
      if (!result.ok) {
        notify({ level: 'error', title: t('cpuTrace.name'), body: result.message })
        return
      }
      recording.value = false
      lastFile.value = result.filePath ?? ''
      notify({ level: 'success', title: t('cpuTrace.name'), body: t('cpuTrace.savedAt', { file: lastFile.value }) })
    } else {
      const result = await windowController.startCpuTrace()
      if (!result.ok) {
        notify({ level: 'error', title: t('cpuTrace.name'), body: result.message })
        return
      }
      recording.value = true
      notify({ level: 'success', title: t('cpuTrace.name'), body: t('cpuTrace.recordingHint') })
    }
  } finally {
    working.value = false
  }
}
</script>
