<template>
  <div data-testid="network-page" class="h-full w-full select-none overflow-auto">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-10 pt-3">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex min-w-0 items-start gap-3">
          <v-avatar color="primary" rounded size="44" variant="tonal">
            <v-icon size="24">wifi</v-icon>
          </v-avatar>
          <div class="min-w-0">
            <h1 class="text-h5 font-weight-bold">{{ t('network.name') }}</h1>
            <p class="mt-1 max-w-2xl text-body-2 text-medium-emphasis">
              {{ t('network.description') }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="lastScanLabel" class="text-caption text-medium-emphasis">{{ lastScanLabel }}</span>
          <v-btn
            :aria-label="t('network.scanNow')"
            icon="wifi_find"
            :loading="scanning"
            variant="tonal"
            @click="scan()"
          />
          <v-btn
            :aria-label="t('network.refresh')"
            icon="refresh"
            :loading="loading"
            variant="tonal"
            @click="refresh()"
          />
        </div>
      </header>

      <v-alert v-if="error" closable density="compact" type="error" variant="tonal" @click:close="error = ''">
        {{ error }}
      </v-alert>

      <v-alert v-if="!supported" density="compact" type="info" variant="tonal">
        {{ t('network.unsupported') }}
      </v-alert>

      <v-alert
        v-if="supported && elevated === false"
        class="network-elevation"
        density="comfortable"
        type="info"
        variant="tonal"
      >
        <div class="font-weight-medium">{{ t('network.adminRequiredTitle') }}</div>
        <p class="mt-1 text-body-2">{{ t('network.adminRequired') }}</p>
        <v-btn
          class="mt-2"
          prepend-icon="shield_person"
          size="small"
          variant="flat"
          @click="controller.relaunchAsAdmin()"
        >
          {{ t('network.relaunchAdmin') }}
        </v-btn>
      </v-alert>

      <v-alert
        v-if="scanResult?.status === 'blocked'"
        class="network-location"
        density="comfortable"
        type="warning"
        variant="tonal"
      >
        <div class="font-weight-medium">{{ t('network.blockedTitle') }}</div>
        <p class="mt-1 text-body-2">{{ t('network.blockedText') }}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <v-btn prepend-icon="my_location" size="small" variant="flat" @click="controller.openNetworkSettings('location')">
            {{ t('network.enableLocation') }}
          </v-btn>
          <v-btn prepend-icon="settings_ethernet" size="small" variant="tonal" @click="controller.openNetworkSettings('wifi')">
            {{ t('network.openWifiSettings') }}
          </v-btn>
        </div>
      </v-alert>

      <section class="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <v-card class="network-card pa-4">
          <div class="flex flex-wrap items-center gap-2">
            <v-icon color="primary" size="22">router</v-icon>
            <h2 class="flex-grow text-subtitle-1 font-weight-bold">{{ t('network.connectedTitle') }}</h2>
            <v-btn
              v-if="connection"
              :loading="disconnecting"
              prepend-icon="link_off"
              size="small"
              variant="tonal"
              @click="disconnect()"
            >
              {{ t('network.disconnect') }}
            </v-btn>
          </div>

          <div v-if="!loaded" class="mt-3 text-caption text-medium-emphasis">
            {{ t('network.loading') }}
          </div>
          <div v-else-if="connection" class="mt-3 flex flex-wrap items-center gap-3">
            <div class="network-ssid">
              <div class="text-h6 font-weight-bold">{{ connection.ssid || t('network.hiddenNetwork') }}</div>
              <div class="text-caption text-medium-emphasis">{{ connection.adapter }}</div>
            </div>
            <div class="flex items-center gap-2">
              <div class="signal-bars">
                <span
                  v-for="step of 4"
                  :key="step"
                  class="signal-bar"
                  :class="`signal-bar--${signalTone(connection.signal)}`"
                  :style="{ height: `${5 + step * 3}px`, opacity: step <= signalBars(connection.signal) ? 1 : 0.25 }"
                />
              </div>
              <span class="text-body-2 text-medium-emphasis">
                {{ connection.signal !== undefined ? `${connection.signal}%` : '—' }}
              </span>
            </div>
            <v-spacer />
            <v-btn prepend-icon="settings_ethernet" size="small" variant="text" @click="controller.openNetworkSettings('wifi')">
              {{ t('network.openWifiSettings') }}
            </v-btn>
          </div>
          <div v-else class="mt-3">
            <div class="text-body-2 text-medium-emphasis">{{ t('network.notConnected') }}</div>
            <p class="mt-1 text-caption text-medium-emphasis">{{ t('network.disconnectedHint') }}</p>
            <v-btn class="mt-2" prepend-icon="settings_ethernet" size="small" variant="tonal" @click="controller.openNetworkSettings('wifi')">
              {{ t('network.openWifiSettings') }}
            </v-btn>
          </div>
        </v-card>

        <v-card class="network-card pa-4">
          <div class="flex items-center gap-2">
            <v-icon color="primary" size="22">lan</v-icon>
            <h2 class="text-subtitle-1 font-weight-bold">{{ t('network.detailsTitle') }}</h2>
          </div>
          <div class="mt-3 flex flex-col gap-2">
            <div v-if="!loaded" class="text-caption text-medium-emphasis">{{ t('network.loading') }}</div>
            <div v-for="adapter of adapters" :key="adapter.name" class="network-adapter">
              <div class="flex flex-wrap items-center gap-2">
                <v-icon :color="adapter.status === 'Up' ? 'success' : undefined" size="16">
                  {{ adapter.wifi ? 'wifi' : 'cable' }}
                </v-icon>
                <span class="text-body-2 font-weight-medium">{{ adapter.name }}</span>
                <v-chip
                  :color="adapter.status === 'Up' ? 'success' : undefined"
                  label
                  size="x-small"
                  variant="tonal"
                >
                  {{ adapter.status }}
                </v-chip>
                <v-spacer />
                <span class="text-caption text-medium-emphasis">{{ adapter.linkSpeed }}</span>
              </div>
              <dl class="network-facts">
                <div v-if="adapter.ipv4.length">
                  <dt>{{ t('network.ipv4') }}</dt>
                  <dd>
                    <button class="network-copy" type="button" @click="copy(adapter.ipv4[0])">
                      {{ adapter.ipv4[0] }}
                      <v-icon size="13">content_copy</v-icon>
                    </button>
                  </dd>
                </div>
                <div v-if="adapter.gateway.length">
                  <dt>{{ t('network.gateway') }}</dt>
                  <dd>{{ adapter.gateway.join(', ') }}</dd>
                </div>
                <div v-if="adapter.dns.length">
                  <dt>{{ t('network.dns') }}</dt>
                  <dd>{{ adapter.dns.join(', ') }}</dd>
                </div>
                <div v-if="adapter.mac">
                  <dt>{{ t('network.mac') }}</dt>
                  <dd>{{ adapter.mac }}</dd>
                </div>
              </dl>
            </div>
            <div v-if="!adapters.length && loaded" class="text-caption text-medium-emphasis">
              {{ t('network.noAdapter') }}
            </div>
          </div>
        </v-card>
      </section>

      <v-card class="network-card pa-4">
        <div class="flex flex-wrap items-center gap-2">
          <v-icon color="primary" size="22">wifi_find</v-icon>
          <div class="flex-grow">
            <h2 class="text-subtitle-1 font-weight-bold">{{ t('network.networksTitle') }}</h2>
            <p class="text-caption text-medium-emphasis">{{ t('network.networksDescription') }}</p>
          </div>
          <v-btn :loading="scanning" prepend-icon="search" size="small" variant="tonal" @click="scan()">
            {{ t('network.scanNow') }}
          </v-btn>
        </div>

        <div v-if="networks.length" class="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          <button
            v-for="network of networks"
            :key="network.ssid"
            class="network-tile"
            type="button"
            :disabled="connecting === network.ssid"
            @click="selectNetwork(network)"
          >
            <v-avatar :color="connection?.ssid === network.ssid ? 'primary' : undefined" rounded size="34" variant="tonal">
              <v-icon size="18">{{ network.signal >= 60 ? 'wifi' : 'wifi_2_bar' }}</v-icon>
            </v-avatar>
            <div class="min-w-0 flex-1 text-left">
              <div class="truncate text-body-2 font-weight-medium">
                {{ network.ssid || t('network.hiddenNetwork') }}
              </div>
              <div class="flex items-center gap-1 text-caption text-medium-emphasis">
                <v-icon size="12">{{ network.secure ? 'lock' : 'lock_open' }}</v-icon>
                <span>{{ network.secure ? t('network.secured') : t('network.open') }}</span>
                <span v-if="network.channel">· {{ network.channel }}</span>
                <span v-if="savedProfiles.includes(network.ssid)" class="ml-1">
                  · {{ t('network.saved') }}
                </span>
              </div>
            </div>
            <div class="flex flex-col items-end gap-1">
              <div class="signal-bars">
                <span
                  v-for="step of 4"
                  :key="step"
                  class="signal-bar"
                  :class="`signal-bar--${signalTone(network.signal)}`"
                  :style="{ height: `${5 + step * 3}px`, opacity: step <= signalBars(network.signal) ? 1 : 0.25 }"
                />
              </div>
              <v-progress-circular v-if="connecting === network.ssid" indeterminate size="14" width="2" />
              <span v-else class="text-caption text-medium-emphasis">{{ network.signal }}%</span>
            </div>
          </button>
        </div>
        <div v-else-if="scanning" class="mt-3 text-caption text-medium-emphasis">
          {{ t('network.scanning') }}
        </div>
        <div v-else class="mt-3 text-caption text-medium-emphasis">
          {{ t('network.noNetworks') }}
        </div>
      </v-card>

      <section class="grid gap-3 lg:grid-cols-2">
        <v-card class="network-card pa-4">
          <div class="flex items-center gap-2">
            <v-icon color="primary" size="22">bookmark</v-icon>
            <div class="flex-grow">
              <h2 class="text-subtitle-1 font-weight-bold">{{ t('network.profilesTitle') }}</h2>
              <p class="text-caption text-medium-emphasis">{{ t('network.profilesDescription') }}</p>
            </div>
          </div>
          <div v-if="!loaded" class="mt-3 text-caption text-medium-emphasis">{{ t('network.loading') }}</div>
          <div v-else-if="savedProfiles.length" class="mt-3 flex flex-col gap-1">
            <div v-for="profile of savedProfiles" :key="profile" class="network-profile">
              <v-icon size="16">wifi</v-icon>
              <span class="min-w-0 flex-1 truncate text-body-2">{{ profile }}</span>
              <v-btn
                :loading="forgetting === profile"
                size="x-small"
                variant="text"
                @click="forget(profile)"
              >
                {{ t('network.forget') }}
              </v-btn>
            </div>
          </div>
          <div v-else class="mt-3 text-caption text-medium-emphasis">{{ t('network.noProfiles') }}</div>
        </v-card>

        <v-card class="network-card pa-4">
          <div class="flex flex-wrap items-center gap-2">
            <v-icon color="primary" size="22">speed</v-icon>
            <div class="flex-grow">
              <h2 class="text-subtitle-1 font-weight-bold">{{ t('network.diagnosticsTitle') }}</h2>
              <p class="text-caption text-medium-emphasis">{{ t('network.diagnosticsDescription') }}</p>
            </div>
            <v-btn :loading="pinging" prepend-icon="network_ping" size="small" variant="tonal" @click="runDiagnostics()">
              {{ pinging ? t('network.testing') : t('network.runDiagnostics') }}
            </v-btn>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <v-chip
              v-for="result of pings"
              :key="result.host"
              :color="pingColor(result.ms)"
              label
              size="small"
              variant="tonal"
            >
              {{ result.host }}
              <strong class="ml-1">{{ result.ms !== null ? `${result.ms} ms` : t('network.unreachable') }}</strong>
            </v-chip>
            <span v-if="!pings.length" class="text-caption text-medium-emphasis">
              {{ t('network.latency') }}
            </span>
          </div>
        </v-card>
      </section>
    </div>

    <v-dialog v-model="dialog" max-width="440">
      <v-card>
        <v-card-title class="text-subtitle-1 font-weight-bold">{{ t('network.passwordTitle') }}</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis">
            {{ t('network.passwordText', { ssid: pending?.ssid ?? '' }) }}
          </p>
          <v-text-field
            v-model="password"
            autofocus
            class="mt-3"
            density="compact"
            :label="t('network.password')"
            :append-inner-icon="showPassword ? 'visibility_off' : 'visibility'"
            :type="showPassword ? 'text' : 'password'"
            variant="outlined"
            @click:append-inner="showPassword = !showPassword"
            @keyup.enter="confirmConnect()"
          />
          <v-select
            v-model="security"
            class="mt-2"
            density="compact"
            :items="securityItems"
            item-title="title"
            item-value="value"
            :label="t('network.security')"
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">{{ t('network.cancel') }}</v-btn>
          <v-btn :loading="!!connecting" variant="flat" @click="confirmConnect()">{{ t('network.validate') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :timeout="2600" location="bottom">
      {{ snackbarText }}
    </v-snackbar>
  </div>
</template>

<script lang="ts" setup>
import type { NetworkAdapterInfo, NetworkConnection, NetworkPingResult, NetworkSnapshot, WifiNetwork, WifiSecurity } from '@xmcl/runtime-api'

const { t, locale } = useI18n()
const controller = windowController

const loading = ref(false)
const loaded = ref(false)
const scanning = ref(false)
const disconnecting = ref(false)
const pinging = ref(false)
const supported = ref(true)
const elevated = ref<boolean>()
const error = ref('')
const adapters = ref<NetworkAdapterInfo[]>([])
const connection = ref<NetworkConnection>()
const savedProfiles = ref<string[]>([])
const scanResult = ref<NetworkSnapshot['scan']>()
const networks = computed(() => scanResult.value?.networks ?? [])
const pingingResults = ref<NetworkPingResult[]>([])
const pings = computed(() => pingingResults.value)

const dialog = ref(false)
const pending = ref<WifiNetwork>()
const password = ref('')
const showPassword = ref(false)
const security = ref<WifiSecurity>('WPA2')
const connecting = ref('')
const forgetting = ref('')

const snackbar = ref(false)
const snackbarText = ref('')

const securityItems = computed(() => [
  { title: 'WPA2', value: 'WPA2' },
  { title: 'WPA3', value: 'WPA3' },
  { title: t('network.open'), value: 'open' },
])

const lastScanLabel = computed(() => {
  const at = scanResult.value?.at
  if (!at) return ''
  const time = new Date(at).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
  return t('network.lastScan', { time })
})

function notify(text: string) {
  snackbarText.value = text
  snackbar.value = true
}

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    const snapshot = await windowController.getNetworkSnapshot()
    supported.value = snapshot.supported
    elevated.value = snapshot.elevated
    adapters.value = snapshot.adapters
    connection.value = snapshot.connection
    savedProfiles.value = snapshot.savedProfiles
  } catch (e) {
    error.value = (e as Error).message || t('network.openFailed')
  } finally {
    loading.value = false
    loaded.value = true
  }
}

async function scan() {
  scanning.value = true
  try {
    const result = await windowController.scanWifi()
    scanResult.value = result
    if (result.status === 'error') error.value = result.message || t('network.scanError')
    if (result.status !== 'blocked') await refresh()
  } catch (e) {
    error.value = (e as Error).message || t('network.scanError')
  } finally {
    scanning.value = false
  }
}

function selectNetwork(network: WifiNetwork) {
  if (network.secure) {
    pending.value = network
    password.value = ''
    showPassword.value = false
    security.value = 'WPA2'
    dialog.value = true
    return
  }
  void connectTo(network.ssid, undefined, 'open')
}

function confirmConnect() {
  if (!pending.value) return
  if (!password.value) {
    error.value = t('network.passwordRequired')
    return
  }
  void connectTo(pending.value.ssid, password.value, security.value)
}

async function connectTo(ssid: string, key: string | undefined, type: WifiSecurity) {
  connecting.value = ssid
  error.value = ''
  try {
    const result = await windowController.connectWifi(ssid, key, type)
    if (result.ok) {
      notify(t('network.connectSuccess', { ssid }))
      dialog.value = false
      pending.value = undefined
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await refresh()
      await scan()
    } else {
      error.value = result.blocked ? t('network.blockedText') : result.message || t('network.connectError')
    }
  } catch (e) {
    error.value = (e as Error).message || t('network.connectError')
  } finally {
    connecting.value = ''
  }
}

async function disconnect() {
  disconnecting.value = true
  try {
    const result = await windowController.disconnectWifi()
    if (!result.ok) error.value = result.message || t('network.openFailed')
    await refresh()
  } finally {
    disconnecting.value = false
  }
}

async function forget(ssid: string) {
  forgetting.value = ssid
  try {
    const result = await windowController.forgetWifi(ssid)
    if (result.ok) notify(t('network.forgetDone', { ssid }))
    else error.value = result.message || t('network.openFailed')
    await refresh()
  } finally {
    forgetting.value = ''
  }
}

async function runDiagnostics() {
  pinging.value = true
  try {
    pingingResults.value = await windowController.pingNetworkHosts(['1.1.1.1', '8.8.8.8', 'api.minecraftservices.com'])
  } finally {
    pinging.value = false
  }
}

async function copy(text: string) {
  await windowController.writeClipboard(text)
  notify(t('network.copied'))
}

function signalBars(signal?: number) {
  if (signal === undefined) return 0
  if (signal >= 75) return 4
  if (signal >= 50) return 3
  if (signal >= 25) return 2
  return 1
}

function signalTone(signal?: number) {
  if (signal === undefined) return 'muted'
  if (signal >= 65) return 'good'
  if (signal >= 40) return 'fair'
  return 'weak'
}

function pingColor(ms: number | null) {
  if (ms === null) return 'error'
  if (ms < 80) return 'success'
  if (ms < 180) return 'warning'
  return 'error'
}

onMounted(async () => {
  await refresh()
  await scan()
})
</script>

<style scoped>
.network-card {
  background: rgba(var(--v-theme-surface), 0.35);
  border: var(--card-subsection-border);
  border-radius: var(--card-item-radius);
}

.network-location {
  border: 1px solid rgba(var(--v-theme-warning), 0.4);
}

.network-elevation {
  border: 1px solid rgba(var(--v-theme-info), 0.4);
}

.network-ssid {
  min-width: 0;
}

.signal-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 18px;
}

.signal-bar {
  width: 4px;
  border-radius: 2px;
  background: rgb(var(--v-theme-primary));
}

.signal-bar--good {
  background: rgb(var(--v-theme-success));
}

.signal-bar--fair {
  background: rgb(var(--v-theme-warning));
}

.signal-bar--weak {
  background: rgb(var(--v-theme-error));
}

.signal-bar--muted {
  background: rgba(var(--v-border-color), 0.6);
}

.network-adapter {
  padding: 10px;
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 12px;
  background: rgba(var(--v-theme-surface), 0.4);
}

.network-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  margin: 6px 0 0;
  font-size: 12px;
}

.network-facts div {
  display: flex;
  gap: 6px;
}

.network-facts dt {
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.network-facts dd {
  margin: 0;
}

.network-copy {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.network-copy:hover {
  color: rgb(var(--v-theme-primary));
}

.network-tile {
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

.network-tile:hover:not(:disabled) {
  border-color: rgb(var(--v-theme-primary));
}

.network-tile:disabled {
  cursor: progress;
  opacity: 0.7;
}

.network-profile {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 8px;
}

.network-profile:hover {
  background: rgba(var(--v-border-color), 0.12);
}
</style>
