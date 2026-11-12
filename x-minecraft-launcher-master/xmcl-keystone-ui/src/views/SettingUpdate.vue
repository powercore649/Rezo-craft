<template>
  <SettingCard
    v-if="!disableUpdate"
    icon="system_update_alt"
    :title="t('launcherUpdate.managerTitle')"
    :subtitle="t('launcherUpdate.silentHint')"
  >
    <AppImageUpdateSettings />
    <v-progress-linear v-if="!updateStateReady" indeterminate />
    <template v-else-if="updateUnavailable">
      <v-alert type="info" variant="tonal" class="ma-4" role="status">
        <strong>{{ t('launcherUpdate.automaticUnavailable') }}</strong>
        <div>{{ t(updateCapabilityReason === 'not-configured' ? 'launcherUpdate.automaticNotConfigured' : 'launcherUpdate.automaticNotImplemented') }}</div>
        <div>{{ t('launcherUpdate.manualCheckHint') }}</div>
        <div v-if="manualCheckRequested">{{ t('launcherUpdate.manualCheckRequired') }}</div>
      </v-alert>
      <div class="flex gap-2 px-4 pb-4">
        <v-btn variant="text" :loading="checkingUpdate" @click="checkUpdate">
          {{ t('setting.checkUpdate') }}
        </v-btn>
        <v-btn variant="text" prepend-icon="system_update" @click="openUpdater">
          {{ t('launcherUpdate.openUpdater') }}
        </v-btn>
        <v-btn variant="text" @click="openReleases">
          {{ t('setting.githubRelease') }}
        </v-btn>
      </div>
    </template>
    <div v-else class="update-manager">
      <div class="update-manager__versions">
        <div class="update-manager__item">
          <span class="update-manager__label">{{ t('launcherUpdate.currentVersion') }}</span>
          <span class="update-manager__value">v{{ version }}</span>
        </div>
        <v-icon size="small" class="update-manager__arrow">arrow_forward</v-icon>
        <div class="update-manager__item">
          <span class="update-manager__label">{{ t('launcherUpdate.latestVersion') }}</span>
          <span class="update-manager__value" :class="{ 'text-primary': hasNewUpdate }">{{ latestVersion }}</span>
        </div>
        <v-chip size="small" :color="statusColor" variant="flat" class="ml-auto">
          <v-icon start size="x-small">{{ statusIcon }}</v-icon>
          {{ statusText }}
        </v-chip>
      </div>

      <v-alert v-if="hasNewUpdate && updateInfo" type="info" variant="tonal" density="compact" class="mt-3">
        {{ t('launcherUpdate.newAvailable', { version: updateInfo.name }) }}
      </v-alert>

      <div v-if="downloadingUpdate" class="update-manager__progress">
        <v-progress-linear indeterminate color="primary" height="6" rounded />
        <span class="text-caption">{{ t('launcherUpdate.downloading') }}</span>
      </div>

      <v-alert v-if="errorText" type="error" variant="tonal" density="compact" class="mt-3">
        {{ errorText }}
      </v-alert>

      <div class="flex flex-wrap gap-2 mt-3">
        <v-btn
          data-testid="settings-check-update"
          variant="text"
          border
          prepend-icon="refresh"
          :loading="checkingUpdate"
          @click="checkUpdate"
        >
          {{ t('setting.checkUpdate') }}
        </v-btn>
        <v-btn
          v-if="hasNewUpdate && updateStatus === 'pending'"
          color="primary"
          prepend-icon="cloud_download"
          :loading="downloadingUpdate"
          @click="downloadUpdate?.()"
        >
          {{ t('launcherUpdate.download') }}
        </v-btn>
        <v-btn
          v-if="updateStatus === 'ready'"
          color="primary"
          prepend-icon="restart_alt"
          :loading="installing"
          @click="quitAndInstall?.()"
        >
          {{ t('launcherUpdate.installNow') }}
        </v-btn>
        <v-btn v-if="updateInfo" variant="text" prepend-icon="article" @click="showUpdateInfo()">
          {{ t('launcherUpdate.releaseNotes') }}
        </v-btn>
      </div>

      <v-divider class="my-4" />

      <SettingItemSwitcher
        :model-value="autoDownload === true"
        icon="cloud_download"
        :title="t('launcherUpdate.autoDownload')"
        :description="t('launcherUpdate.autoDownloadHint')"
        @update:model-value="setAutoDownload"
      />
      <SettingItemSwitcher
        :model-value="autoInstallOnAppQuit === true"
        icon="power_settings_new"
        :title="t('launcherUpdate.autoInstall')"
        :description="t('launcherUpdate.autoInstallHint')"
        @update:model-value="setAutoInstall"
      />
    </div>
  </SettingCard>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { injection } from '@/util/inject'
import { useDialog } from '../composables/dialog'
import { kUpdateSettings } from '../composables/setting'
import SettingCard from '@/components/SettingCard.vue'
import SettingItemSwitcher from '@/components/SettingItemSwitcher.vue'
import AppImageUpdateSettings from './AppImageUpdateSettings.vue'

const { show: showUpdateInfo } = useDialog('update-info')
const disableUpdate = false // state.env !== 'raw'
function openUpdater() {
  void windowController.openUpdateLauncher()
}

function openReleases() {
  window.open('https://github.com/powercore649/Rezo-craft/releases', 'browser')
}
const {
  updateInfo, installing, updateStatus, checkUpdate, checkingUpdate, version,
  updateStateReady, updateUnavailable, updateCapabilityReason, manualCheckRequested,
  downloadingUpdate, downloadUpdate, quitAndInstall, actionError, capabilityError,
  autoDownload, autoInstallOnAppQuit, setAutoDownload, setAutoInstall,
} = injection(kUpdateSettings)
const { t } = useI18n()

const hasNewUpdate = computed(() => updateStatus.value !== 'none' && !!updateInfo.value?.newUpdate)
const latestVersion = computed(() => updateInfo.value?.name ?? `v${version.value}`)
const statusText = computed(() => {
  if (updateStatus.value === 'ready') return t('launcherUpdate.readyToInstall')
  if (hasNewUpdate.value) return t('launcherUpdate.available')
  return t('launcherUpdate.alreadyLatest')
})
const statusColor = computed(() => updateStatus.value === 'ready' ? 'success' : hasNewUpdate.value ? 'primary' : undefined)
const statusIcon = computed(() => updateStatus.value === 'ready' ? 'check_circle' : hasNewUpdate.value ? 'new_releases' : 'verified')
const errorText = computed(() => {
  const action = actionError?.value
  if (action) return t('launcherUpdate.actionError', { error: action })
  const check = capabilityError?.value
  if (check) return t('launcherUpdate.checkError', { error: check })
  return ''
})
</script>

<style scoped>
.update-manager__versions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.update-manager__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.update-manager__label {
  font-size: 0.75rem;
  opacity: 0.7;
}

.update-manager__value {
  font-size: 1.15rem;
  font-weight: 600;
}

.update-manager__arrow {
  opacity: 0.5;
}

.update-manager__progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 12px;
}
</style>
