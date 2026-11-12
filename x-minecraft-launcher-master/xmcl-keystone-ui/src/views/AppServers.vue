<template>
  <div
    data-testid="servers-page"
    class="h-full w-full select-none overflow-auto"
  >
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-10 pt-3">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex min-w-0 items-start gap-3">
          <v-avatar color="primary" rounded size="44" variant="tonal">
            <v-icon size="24">public</v-icon>
          </v-avatar>
          <div class="min-w-0">
            <h1 class="text-h5 font-weight-bold">{{ t('serverList.name') }}</h1>
            <p class="mt-1 max-w-2xl text-body-2 text-medium-emphasis">
              {{ t('serverList.description') }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="lastUpdated" class="text-caption text-medium-emphasis">
            {{ t('serverList.updated', { time: formattedLastUpdated }) }}
          </span>
          <v-btn
            :aria-label="t('serverList.refreshAll')"
            icon="refresh"
            :loading="refreshing"
            variant="tonal"
            @click="refreshAll()"
          />
        </div>
      </header>

      <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <v-text-field
          v-model="search"
          density="compact"
          hide-details
          prepend-inner-icon="search"
          :placeholder="t('serverList.search')"
          variant="outlined"
        />
        <v-select
          v-model="instancePath"
          class="min-w-56"
          density="compact"
          hide-details
          item-title="title"
          item-value="value"
          :items="instanceItems"
          :label="t('serverList.launchInstance')"
          variant="outlined"
        />
      </div>

      <v-alert v-if="!instanceItems.length" density="compact" type="info" variant="tonal">
        {{ t('serverList.noInstance') }}
      </v-alert>

      <v-alert v-if="launchError" closable density="compact" type="error" variant="tonal" @click:close="launchError = ''">
        {{ launchError }}
      </v-alert>

      <div class="flex flex-wrap items-center gap-2">
        <v-chip
          v-for="item of categories"
          :key="item.value"
          :color="category === item.value ? 'primary' : undefined"
          :variant="category === item.value ? 'flat' : 'tonal'"
          label
          size="small"
          @click="category = item.value"
        >
          {{ item.text }}
        </v-chip>
      </div>

      <div v-if="filtered.length" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <v-card
          v-for="server of filtered"
          :key="server.id"
          class="flex flex-col pa-4"
          variant="outlined"
        >
          <div class="flex items-start gap-3">
            <img
              v-if="statuses[server.id]?.favicon"
              :src="statuses[server.id]?.favicon"
              alt=""
              class="h-10 w-10 flex-shrink-0 rounded"
            >
            <v-avatar v-else color="primary" rounded size="40" variant="tonal">
              <v-icon size="20">dns</v-icon>
            </v-avatar>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <h2 class="truncate font-semibold">{{ server.name }}</h2>
                <v-chip
                  :color="statusColor(server.id)"
                  label
                  size="x-small"
                  :variant="pending[server.id] ? 'tonal' : 'flat'"
                >
                  {{ statusLabel(server.id) }}
                </v-chip>
              </div>
              <button
                class="mt-1 flex max-w-full items-center gap-1 text-caption text-medium-emphasis hover:text-primary"
                type="button"
                :aria-label="copiedId === server.id ? t('serverList.copied') : t('serverList.copyAddress')"
                @click="copyAddress(server)"
              >
                <span class="truncate">{{ formatServerAddress(server) }}</span>
                <v-icon size="12">{{ copiedId === server.id ? 'check' : 'content_copy' }}</v-icon>
              </button>
            </div>

            <v-btn
              v-if="server.website"
              :aria-label="t('serverList.visitWebsite')"
              icon="open_in_new"
              size="x-small"
              :href="server.website"
              target="browser"
              variant="text"
            />
          </div>

          <div class="mt-3 line-clamp-2 min-h-[2.5rem] text-caption text-medium-emphasis">
            <TextComponent
              v-if="motdSource(server.id)"
              :source="motdSource(server.id)!"
              class="leading-relaxed"
            />
            <span v-else-if="!pending[server.id]">{{ t('serverList.offlineHint') }}</span>
          </div>

          <div class="mt-2 flex flex-wrap items-center gap-2">
            <v-chip label size="small" variant="tonal">
              <v-icon start size="14">group</v-icon>
              {{ playersLabel(server.id) }}
            </v-chip>
            <v-chip v-if="pingLabel(server.id)" label size="small" variant="tonal">
              <v-icon start size="14">speed</v-icon>
              {{ pingLabel(server.id) }}
            </v-chip>
            <v-chip v-if="versionLabel(server.id)" class="max-w-full" label size="small" variant="tonal">
              <v-icon start size="14">deployed_code</v-icon>
              <span class="truncate">{{ versionLabel(server.id) }}</span>
            </v-chip>
          </div>

          <div class="mt-auto flex items-center justify-between gap-2 pt-3">
            <v-chip label size="small" variant="text">
              {{ categoryLabel(server.category) }}
            </v-chip>
            <v-btn
              color="primary"
              :disabled="!instancePath"
              :loading="launching === server.id"
              prepend-icon="play_arrow"
              size="small"
              @click="join(server)"
            >
              {{ t('serverList.join') }}
            </v-btn>
          </div>
        </v-card>
      </div>

      <v-alert v-else density="compact" type="info" variant="tonal">
        {{ t('serverList.empty') }}
      </v-alert>
    </div>
  </div>
</template>

<script lang="ts" setup>
import TextComponent from '@/components/TextComponent'
import { useRendererCommandHost } from '@/composables/commandHost'
import { kInstanceLaunchCoordinator } from '@/composables/instanceLaunchCoordinator'
import { kInstances } from '@/composables/instances'
import { usePublicServers } from '@/composables/publicServers'
import { getErrorMessage } from '@/util/error'
import { injection } from '@/util/inject'
import {
  filterPublicServers,
  formatServerAddress,
  formatServerPlayers,
  isServerOnline,
  sortPublicServersByPlayers,
  type PublicServer,
  type PublicServerCategory,
} from '@/util/publicServers'
import { useLocalStorage } from '@vueuse/core'

const { t, locale } = useI18n()
const { servers, statuses, pending, refreshing, lastUpdated, refreshAll } = usePublicServers()

const search = ref('')
const category = ref<PublicServerCategory | 'all'>('all')
const categories: { value: PublicServerCategory | 'all'; text: string }[] = [
  { value: 'all', text: t('serverList.allCategories') },
  { value: 'minigames', text: t('serverList.categories.minigames') },
  { value: 'pvp', text: t('serverList.categories.pvp') },
  { value: 'mmorpg', text: t('serverList.categories.mmorpg') },
  { value: 'survival', text: t('serverList.categories.survival') },
  { value: 'prison', text: t('serverList.categories.prison') },
  { value: 'anarchy', text: t('serverList.categories.anarchy') },
]
const categoryLabel = (value: PublicServerCategory) =>
  categories.find((item) => item.value === value)?.text ?? value

const filtered = computed(() =>
  sortPublicServersByPlayers(filterPublicServers(servers, search.value, category.value), statuses),
)

const { instances } = injection(kInstances)
const { launch } = injection(kInstanceLaunchCoordinator)
const commandHost = useRendererCommandHost()
const instancePath = useLocalStorage('serversLaunchInstancePath', '', { writeDefaults: false })
const instanceItems = computed(() =>
  instances.value.map((instance) => ({ title: instance.name, value: instance.path })),
)
watch(instanceItems, (items) => {
  if (!items.length) return
  if (!instancePath.value || !items.some((item) => item.value === instancePath.value)) {
    instancePath.value = items[0].value
  }
}, { immediate: true })

const launching = ref('')
const launchError = ref('')
const copiedId = ref('')

const formattedLastUpdated = computed(() =>
  new Intl.DateTimeFormat(locale.value, { timeStyle: 'short' }).format(lastUpdated.value),
)

const statusLabel = (id: string) => {
  if (pending[id]) return t('serverList.checking')
  return isServerOnline(statuses[id]) ? t('serverList.online') : t('serverList.offline')
}
const statusColor = (id: string) => {
  if (pending[id]) return undefined
  return isServerOnline(statuses[id]) ? 'success' : 'error'
}
const playersLabel = (id: string) => {
  const status = statuses[id]
  if (!status || status.players.online < 0) return '—'
  return formatServerPlayers(status.players.online, status.players.max, locale.value)
}
const pingLabel = (id: string) => {
  const status = statuses[id]
  return status && isServerOnline(status) ? `${status.ping}ms` : ''
}
const versionLabel = (id: string) => {
  const status = statuses[id]
  if (!status || !isServerOnline(status)) return ''
  const name = status.version.name
  return name.startsWith('serverStatus.') ? '' : name
}
const motdSource = (id: string) => {
  const description = statuses[id]?.description
  if (!description) return undefined
  if (typeof description === 'string') {
    return description.startsWith('serverStatus.') ? undefined : { text: description }
  }
  return description
}

function copyAddress(server: PublicServer) {
  const address = formatServerAddress(server)
  windowController.writeClipboard(address)
  copiedId.value = server.id
  setTimeout(() => {
    if (copiedId.value === server.id) copiedId.value = ''
  }, 2_000)
}

async function join(server: PublicServer) {
  if (!instancePath.value || launching.value) return
  launching.value = server.id
  launchError.value = ''
  try {
    const instance = instancePath.value
    await launch(instance, () =>
      commandHost.dispatch('instance.launch', {
        instance,
        server: { host: server.host, port: server.port },
      }),
    )
  } catch (error) {
    launchError.value = getErrorMessage(error)
  } finally {
    launching.value = ''
  }
}

onMounted(() => {
  void refreshAll()
})
</script>
