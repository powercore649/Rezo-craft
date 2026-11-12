<template>
  <div data-testid="home-overview" class="app-home h-full w-full select-none overflow-auto">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-10 pt-3">
      <section class="home-hero">
        <div class="relative z-1 flex flex-col gap-5 md:flex-row md:items-center">
          <img :src="logo" alt="" class="h-16 w-16 rounded-2xl shadow-lg md:h-20 md:w-20">

          <div class="min-w-0 flex-1">
            <div class="home-hero__brand">NOVACRAFT</div>
            <h1 class="text-h5 font-weight-bold text-white md:text-h4">
              {{ greeting }}
            </h1>
            <p class="mt-1 max-w-xl text-body-2 text-white/85">
              {{ t('appHome.subtitle') }}
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <v-chip v-if="instanceName" class="home-hero__chip" size="small" variant="flat">
                <v-icon start size="14">deployed_code</v-icon>
                {{ instanceName }}
              </v-chip>
              <v-chip v-if="minecraftVersion" class="home-hero__chip" size="small" variant="flat">
                <v-icon start size="14">sports_esports</v-icon>
                {{ minecraftVersion }}
              </v-chip>
            </div>
          </div>

          <div class="flex flex-col items-stretch gap-1 md:items-end">
            <v-btn
              v-if="instanceName"
              class="home-hero__cta"
              :loading="launchLoading"
              rounded="lg"
              size="large"
              @click="launch.onClick()"
            >
              <v-icon start>play_arrow</v-icon>
              {{ launchText }}
            </v-btn>
            <v-btn
              v-else
              class="home-hero__cta"
              rounded="lg"
              size="large"
              @click="showAddInstance()"
            >
              <v-icon start>add</v-icon>
              {{ t('appHome.createInstance') }}
            </v-btn>
            <v-btn
              v-if="instanceName"
              class="home-hero__link"
              size="small"
              variant="text"
              @click="router.push('/base-setting')"
            >
              {{ t('appHome.instanceSettings') }}
            </v-btn>
          </div>
        </div>
      </section>

      <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <button
          v-for="action of actions"
          :key="action.to"
          :data-testid="`home-action-${action.to.slice(1)}`"
          class="home-card home-action"
          type="button"
          @click="router.push(action.to)"
        >
          <v-avatar :color="action.color" rounded size="42" variant="tonal">
            <v-icon size="22">{{ action.icon }}</v-icon>
          </v-avatar>
          <div class="min-w-0 flex-1 text-left">
            <div class="font-weight-medium">{{ action.title }}</div>
            <div class="mt-1 text-caption text-medium-emphasis">{{ action.description }}</div>
          </div>
          <v-icon class="home-action__chevron" size="18">chevron_right</v-icon>
        </button>
      </section>

      <section class="home-card pa-4">
        <div class="d-flex flex-wrap align-center gap-2">
          <v-icon color="primary" size="22">public</v-icon>
          <div class="flex-grow">
            <h2 class="text-subtitle-1 font-weight-bold">{{ t('appHome.serversTitle') }}</h2>
            <p class="text-caption text-medium-emphasis">{{ t('appHome.serversDescription') }}</p>
          </div>
          <v-btn
            append-icon="arrow_forward"
            size="small"
            variant="text"
            @click="router.push('/servers')"
          >
            {{ t('appHome.seeAllServers') }}
          </v-btn>
        </div>

        <div v-if="topServers.length" class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <button
            v-for="server of topServers"
            :key="server.id"
            class="home-server"
            type="button"
            @click="router.push('/servers')"
          >
            <img
              v-if="statuses[server.id]?.favicon"
              :src="statuses[server.id]?.favicon"
              alt=""
              class="h-8 w-8 flex-shrink-0 rounded"
            >
            <v-avatar v-else color="primary" rounded size="32" variant="tonal">
              <v-icon size="16">dns</v-icon>
            </v-avatar>
            <div class="min-w-0 flex-1 text-left">
              <div class="truncate text-body-2 font-weight-medium">{{ server.name }}</div>
              <div class="truncate text-caption text-medium-emphasis">
                {{ playersLabel(server.id) }}
              </div>
            </div>
            <v-chip color="success" label size="x-small" variant="flat">
              {{ statuses[server.id]?.ping }}ms
            </v-chip>
          </button>
        </div>
        <div v-else class="mt-3 text-caption text-medium-emphasis">
          {{ t('appHome.emptyServers') }}
        </div>
      </section>

      <section>
        <div class="mb-2 flex flex-wrap items-center gap-2 px-1">
          <v-icon color="primary" size="20">widgets</v-icon>
          <div class="flex-grow">
            <h2 class="text-subtitle-1 font-weight-bold">{{ t('appWidgets.title') }}</h2>
            <p class="text-caption text-medium-emphasis">{{ t('appWidgets.description') }}</p>
          </div>
          <v-btn
            :prepend-icon="desktopEnabled ? 'desktop_windows' : 'desktop_access_disabled'"
            :color="desktopEnabled ? 'primary' : undefined"
            :variant="desktopEnabled ? 'flat' : 'tonal'"
            size="small"
            @click="toggleDesktopWidget(!desktopEnabled)"
          >
            {{ t('appWidgets.desktop') }}
          </v-btn>
          <v-btn prepend-icon="tune" size="small" variant="text" @click="customizing = true">
            {{ t('appWidgets.customize') }}
          </v-btn>
        </div>

        <div v-if="visibleWidgets.length" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <component
            :is="widgetComponents[widget.id]"
            v-for="widget of visibleWidgets"
            :key="widget.id"
          />
        </div>
        <div v-else class="home-card pa-4 text-caption text-medium-emphasis">
          {{ t('appWidgets.empty') }}
        </div>
      </section>

      <v-dialog v-model="customizing" max-width="540">
        <v-card rounded="lg">
          <v-card-title class="text-subtitle-1 font-weight-bold">
            {{ t('appWidgets.customizeTitle') }}
          </v-card-title>
          <v-card-subtitle>{{ t('appWidgets.customizeHint') }}</v-card-subtitle>
          <v-list density="compact">
            <v-list-item v-for="widget of widgetDefinitions" :key="widget.id">
              <template #prepend>
                <v-icon>{{ widget.icon }}</v-icon>
              </template>
              <v-list-item-title>{{ t(widget.nameKey) }}</v-list-item-title>
              <v-list-item-subtitle>{{ t(widget.descriptionKey) }}</v-list-item-subtitle>
              <template #append>
                <v-switch
                  :model-value="isWidgetEnabled(widget.id)"
                  color="primary"
                  density="compact"
                  hide-details
                  inset
                  :aria-label="t(widget.nameKey)"
                  @update:model-value="(value) => toggleWidget(widget.id, value === true)"
                />
              </template>
            </v-list-item>
          </v-list>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="text" @click="customizing = false">{{ t('appWidgets.done') }}</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <section class="home-card pa-4">
        <div class="d-flex flex-wrap align-center gap-2">
          <v-icon color="primary" size="22">grid_view</v-icon>
          <div class="flex-grow">
            <h2 class="text-subtitle-1 font-weight-bold">{{ t('appHome.instancesTitle') }}</h2>
            <p class="text-caption text-medium-emphasis">{{ t('appHome.instancesDescription') }}</p>
          </div>
          <v-btn
            prepend-icon="add"
            size="small"
            variant="tonal"
            @click="showAddInstance()"
          >
            {{ t('appHome.createInstance') }}
          </v-btn>
        </div>

        <div v-if="instances.length" class="mt-3 flex flex-wrap gap-2">
          <v-chip
            v-for="instance of instances"
            :key="instance.path"
            :class="{ 'home-instance--active': instance.path === selectedInstance }"
            :variant="instance.path === selectedInstance ? 'flat' : 'tonal'"
            @click="openInstance(instance.path)"
          >
            {{ instance.name }}
          </v-chip>
        </div>
        <div v-else class="mt-3 text-caption text-medium-emphasis">
          {{ t('appHome.noInstance') }}
        </div>
      </section>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { Component } from 'vue'
import logo from '@/assets/logo.png'
import WidgetClock from './widgets/WidgetClock.vue'
import WidgetInstance from './widgets/WidgetInstance.vue'
import WidgetNews from './widgets/WidgetNews.vue'
import WidgetPcStats from './widgets/WidgetPcStats.vue'
import { useWidgets, widgetDefinitions } from '@/composables/widgets'
import '@/views/widgets/widgets.css'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { useDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { kInstances } from '@/composables/instances'
import { kLaunchButton } from '@/composables/launchButton'
import { usePublicServers } from '@/composables/publicServers'
import { kUserContext } from '@/composables/user'
import { injection } from '@/util/inject'
import {
  formatServerPlayers,
  isServerOnline,
  sortPublicServersByPlayers,
} from '@/util/publicServers'

const router = useRouter()
const { t, locale } = useI18n()

const { instances, selectedInstance } = injection(kInstances)
const { instance } = injection(kInstance)
const { gameProfile } = injection(kUserContext)
const launch = injection(kLaunchButton)
const launchText = launch.text
const launchLoading = launch.loading
const { show: showAddInstance } = useDialog(AddInstanceDialogKey)

const { servers, statuses, refreshAll } = usePublicServers()

const { visible: visibleWidgets, isEnabled: isWidgetEnabled, toggle: toggleWidget } = useWidgets()
const customizing = ref(false)
const desktopEnabled = ref(false)
let stopDesktopListener: (() => void) | undefined

async function toggleDesktopWidget(value: boolean) {
  try {
    const state = await windowController.setDesktopWidget(value)
    desktopEnabled.value = state.enabled
  } catch {
    desktopEnabled.value = false
  }
}
const widgetComponents: Record<string, Component> = {
  'pc-stats': WidgetPcStats,
  clock: WidgetClock,
  instance: WidgetInstance,
  news: WidgetNews,
}

const instanceName = computed(() => instance.value?.name ?? '')
const minecraftVersion = computed(() => instance.value?.runtime.minecraft ?? '')
const greeting = computed(() => {
  const name = gameProfile.value?.name
  return name ? t('appHome.greeting', { name }) : t('appHome.welcome')
})

const actions = computed(() => [
  {
    to: '/servers',
    icon: 'public',
    color: 'primary',
    title: t('appHome.actions.servers'),
    description: t('appHome.actions.serversDescription'),
  },
  {
    to: '/accounts',
    icon: 'manage_accounts',
    color: 'secondary',
    title: t('appHome.actions.accounts'),
    description: t('appHome.actions.accountsDescription'),
  },
  {
    to: '/network',
    icon: 'wifi',
    color: 'primary',
    title: t('appHome.actions.network'),
    description: t('appHome.actions.networkDescription'),
  },
  {
    to: '/store',
    icon: 'store',
    color: 'primary',
    title: t('appHome.actions.store'),
    description: t('appHome.actions.storeDescription'),
  },
  {
    to: '/notes',
    icon: 'sticky_note_2',
    color: 'primary',
    title: t('appHome.actions.notes'),
    description: t('appHome.actions.notesDescription'),
  },
  {
    to: '/writer',
    icon: 'description',
    color: 'secondary',
    title: t('appHome.actions.writer'),
    description: t('appHome.actions.writerDescription'),
  },
  {
    to: '/setting',
    icon: 'settings',
    color: 'secondary',
    title: t('appHome.actions.settings'),
    description: t('appHome.actions.settingsDescription'),
  },
])

const topServers = computed(() =>
  sortPublicServersByPlayers(
    servers.filter((server) => isServerOnline(statuses[server.id])),
    statuses,
  ).slice(0, 4),
)

function playersLabel(id: string) {
  const status = statuses[id]
  if (!status || status.players.online < 0) return '—'
  return formatServerPlayers(status.players.online, status.players.max, locale.value)
}

function openInstance(path: string) {
  selectedInstance.value = path
  void router.push('/')
}

onMounted(() => {
  void refreshAll()
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
</script>

<style scoped>
.app-home {
  background: transparent;
}

.home-hero {
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  padding: 22px;
  background: linear-gradient(118deg, #ff4d9e 0%, #b545ff 52%, #6847ff 100%);
  box-shadow: 0 20px 45px -28px rgba(104, 71, 255, 0.95);
}

.home-hero::after {
  content: '';
  position: absolute;
  top: -160px;
  right: -80px;
  width: 380px;
  height: 380px;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.34), transparent 65%);
  pointer-events: none;
}

.home-hero__brand {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: rgba(255, 255, 255, 0.72);
}

.home-hero__chip {
  background: rgba(255, 255, 255, 0.18) !important;
  color: #fff !important;
}

.home-hero__cta {
  background: #fff !important;
  color: #6d2bd9 !important;
  font-weight: 600;
}

.home-hero__link {
  color: rgba(255, 255, 255, 0.9) !important;
}

.home-card {
  background: rgba(var(--v-theme-surface), 0.35);
  border: var(--card-subsection-border);
  border-radius: var(--card-item-radius);
}

.home-action {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  cursor: pointer;
  transition: transform 0.16s ease, border-color 0.16s ease;
}

.home-action:hover {
  transform: translateY(-1px);
  border-color: rgb(var(--v-theme-primary));
}

.home-action__chevron {
  opacity: 0.45;
}

.home-server {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 12px;
  background: rgba(var(--v-theme-surface), 0.4);
  cursor: pointer;
  transition: border-color 0.16s ease;
}

.home-server:hover {
  border-color: rgb(var(--v-theme-primary));
}

.home-instance--active {
  color: #fff;
}
</style>
