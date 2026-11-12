<template>
  <div>
    <SettingCard
      class="mb-4"
      icon="code"
      :title="t('setting.developer')"
      :subtitle="t('setting.developerDescription')"
    >
      <div class="dev-actions">
        <v-btn size="small" variant="tonal" prepend-icon="bug_report" @click="openDevTools">
          {{ t('setting.developerDevtools') }}
        </v-btn>
        <v-btn size="small" variant="tonal" prepend-icon="folder_open" @click="openLogs">
          {{ t('setting.developerLogs') }}
        </v-btn>
        <v-btn size="small" variant="tonal" prepend-icon="storage" @click="openData">
          {{ t('setting.developerData') }}
        </v-btn>
        <v-btn size="small" variant="tonal" prepend-icon="refresh" @click="reloadUi">
          {{ t('setting.developerReload') }}
        </v-btn>
        <v-btn size="small" variant="text" prepend-icon="content_copy" @click="copyInfo">
          {{ t('setting.developerCopy') }}
        </v-btn>
        <v-btn size="small" variant="text" prepend-icon="open_in_new" @click="openReleases">
          {{ t('setting.developerReleases') }}
        </v-btn>
      </div>

      <p class="dev-note">{{ t('setting.developerNote') }}</p>

      <div class="dev-info">
        <div class="dev-info__title">{{ t('setting.developerInfo') }}</div>
        <pre class="dev-info__body">{{ infoText }}</pre>
      </div>
    </SettingCard>
  </div>
</template>

<script lang="ts" setup>
import type { DeveloperInfo } from '@xmcl/runtime-api'
import { computed, onMounted, ref } from 'vue'
import { useNotifier } from '@/composables/notifier'

const { t } = useI18n()
const { notify } = useNotifier()

const info = ref<DeveloperInfo>()

const infoText = computed(() => {
  const value = info.value
  if (!value) return '…'
  return [
    `NovaCraft ${value.appVersion}`,
    `Electron ${value.electron} · Chromium ${value.chrome} · Node ${value.node}`,
    value.platform,
    `locale: ${value.locale}`,
    `données: ${value.dataPath}`,
    `logs: ${value.logsPath}`,
  ].join('\n')
})

function openDevTools() {
  windowController.openDeveloperTools()
}

function openLogs() {
  windowController.openLogsFolder()
}

function openData() {
  windowController.openDataFolder()
}

function reloadUi() {
  windowController.reloadLauncherWindow()
}

function openReleases() {
  window.open('https://github.com/powercore649/Rezo-craft/releases', 'browser')
}

async function copyInfo() {
  await windowController.writeClipboard(infoText.value)
  notify({ level: 'success', title: t('setting.developerCopied') })
}

onMounted(() => {
  void windowController.getDeveloperInfo().then((value) => { info.value = value }).catch(() => {})
})
</script>

<style scoped>
.dev-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.dev-note {
  margin: 14px 0 0;
  font-size: 0.76rem;
  line-height: 1.45;
  opacity: 0.55;
}

.dev-info {
  margin-top: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  padding: 12px 14px;
}

.dev-info__title {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.55;
  margin-bottom: 6px;
}

.dev-info__body {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.76rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  opacity: 0.85;
}
</style>
