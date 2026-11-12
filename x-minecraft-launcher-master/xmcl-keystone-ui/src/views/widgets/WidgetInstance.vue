<template>
  <section class="widget-card pa-4" data-testid="widget-instance">
    <div class="d-flex align-center gap-2">
      <v-icon color="primary" size="20">sports_esports</v-icon>
      <h3 class="text-subtitle-2 font-weight-bold flex-grow">{{ t('appWidgets.instance.name') }}</h3>
      <v-btn
        :aria-label="t('appWidgets.instance.settings')"
        icon="settings"
        size="x-small"
        variant="text"
        @click="router.push('/base-setting')"
      />
    </div>

    <div class="mt-3">
      <div class="text-body-1 font-weight-medium truncate">{{ instanceName || t('appWidgets.instance.none') }}</div>
      <div class="text-caption text-medium-emphasis">{{ minecraftVersion || '—' }}</div>
    </div>

    <v-btn
      v-if="instanceName"
      block
      class="mt-3"
      color="primary"
      :loading="launchLoading"
      rounded="lg"
      variant="flat"
      @click="launch.onClick()"
    >
      <v-icon start>play_arrow</v-icon>
      {{ launchText }}
    </v-btn>
    <v-btn v-else block class="mt-3" rounded="lg" variant="tonal" @click="showAddInstance()">
      <v-icon start>add</v-icon>
      {{ t('appWidgets.instance.create') }}
    </v-btn>
  </section>
</template>

<script lang="ts" setup>
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { useDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { kLaunchButton } from '@/composables/launchButton'
import { injection } from '@/util/inject'

const router = useRouter()
const { t } = useI18n()

const { instance } = injection(kInstance)
const launch = injection(kLaunchButton)
const launchText = launch.text
const launchLoading = launch.loading
const { show: showAddInstance } = useDialog(AddInstanceDialogKey)

const instanceName = computed(() => instance.value?.name ?? '')
const minecraftVersion = computed(() => instance.value?.runtime.minecraft ?? '')
</script>
