<template>
  <div data-testid="accounts-page" class="accounts-page flex flex-col gap-4 p-3">
    <header class="d-flex flex-wrap align-center gap-3">
      <v-avatar color="primary" rounded size="44" variant="tonal">
        <v-icon size="24">manage_accounts</v-icon>
      </v-avatar>
      <div class="flex-grow min-w-0">
        <h1 class="text-h6 font-weight-bold">{{ t('accounts.name') }}</h1>
        <p class="text-caption opacity-70">{{ t('accounts.description') }}</p>
      </div>
      <div class="d-flex flex-wrap align-center gap-2">
        <v-btn
          variant="text"
          prepend-icon="sync"
          :loading="bulk.running"
          :disabled="!!busy || refreshTargets.length === 0"
          @click="refreshAll"
        >
          {{ bulk.running ? `${bulk.done}/${bulk.total}` : t('accounts.refreshAll') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="person_add"
          :loading="busy === 'add'"
          :disabled="!!busy || bulk.running"
          data-testid="accounts-add-microsoft"
          @click="addMicrosoft"
        >
          {{ t('accounts.addMicrosoft') }}
        </v-btn>
        <v-btn
          variant="tonal"
          prepend-icon="wifi_off"
          :disabled="!!busy || bulk.running"
          data-testid="accounts-add-offline"
          @click="offlineDialog = true"
        >
          {{ t('accounts.addOffline') }}
        </v-btn>
      </div>
    </header>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      closable
      @click:close="error = ''"
    >
      {{ error }}
    </v-alert>

    <v-alert
      v-if="notice"
      type="success"
      variant="tonal"
      density="compact"
      closable
      @click:close="notice = ''"
    >
      {{ notice }}
    </v-alert>

    <div class="accounts-stats">
      <div class="accounts-stat">
        <span class="accounts-stat__value">{{ users.length }}</span>
        <span class="accounts-stat__label">{{ t('accounts.statsAccounts') }}</span>
      </div>
      <div class="accounts-stat">
        <span class="accounts-stat__value">{{ profileTotal }}</span>
        <span class="accounts-stat__label">{{ t('accounts.statsProfiles') }}</span>
      </div>
      <div class="accounts-stat" :class="{ 'accounts-stat--alert': expiredTotal > 0 }">
        <span class="accounts-stat__value">{{ expiredTotal }}</span>
        <span class="accounts-stat__label">{{ t('accounts.statsExpired') }}</span>
      </div>
    </div>

    <div class="accounts-toolbar">
      <v-text-field
        v-model="search"
        density="compact"
        hide-details
        clearable
        prepend-inner-icon="search"
        :placeholder="t('accounts.search')"
        variant="outlined"
      />
      <v-select
        v-model="sortKey"
        density="compact"
        hide-details
        item-title="title"
        item-value="value"
        :items="sortOptions"
        :label="t('accounts.sortBy')"
        variant="outlined"
      />
    </div>

    <div class="d-flex flex-wrap align-center gap-2">
      <v-chip
        v-for="item of filters"
        :key="item.value"
        :color="filter === item.value ? 'primary' : undefined"
        :variant="filter === item.value ? 'flat' : 'tonal'"
        label
        size="small"
        @click="filter = item.value"
      >
        {{ item.text }}
        <span class="ml-2 opacity-70">{{ item.count }}</span>
      </v-chip>
    </div>

    <div class="accounts-layout">
      <v-card variant="flat" class="accounts-card accounts-list">
        <div class="px-4 pt-3 pb-1 text-subtitle-2 font-weight-bold opacity-80">
          {{ t('accounts.list') }}
        </div>
        <div v-if="users.length === 0" class="pa-6 text-center">
          <v-icon size="36" class="opacity-40 mb-2">person_off</v-icon>
          <div class="text-body-2 opacity-80">{{ t('accounts.noAccounts') }}</div>
          <div class="text-caption opacity-60 mt-1">{{ t('accounts.noAccountsHint') }}</div>
        </div>
        <div v-else-if="filteredUsers.length === 0" class="pa-6 text-center text-body-2 opacity-70">
          {{ t('accounts.emptyResult') }}
        </div>
        <v-list v-else density="comfortable" class="py-1" bg-color="transparent">
          <v-list-item
            v-for="user in filteredUsers"
            :key="user.id"
            :data-testid="`account-${user.id}`"
            :class="{ 'accounts-item--active': user.id === selectedId }"
            @click="selectedId = user.id"
          >
            <template #prepend>
              <PlayerAvatar
                class="overflow-hidden rounded-full mr-3 flex-shrink-0"
                :src="skinOf(user)"
                :dimension="40"
              />
            </template>

            <v-list-item-title class="d-flex align-center flex-wrap gap-2">
              <span class="font-weight-medium text-truncate">{{ displayName(user) }}</span>
              <v-chip v-if="user.id === activeUserId" size="x-small" color="primary" variant="flat">
                {{ t('accounts.active') }}
              </v-chip>
              <v-chip v-else-if="isExpired(user)" size="x-small" color="error" variant="tonal">
                {{ t('accounts.expired') }}
              </v-chip>
            </v-list-item-title>

            <v-list-item-subtitle class="text-caption">
              {{ authorityName(user.authority) }} · {{ t('accounts.profileCount', { count: profilesOf(user).length }) }}
            </v-list-item-subtitle>

            <template #append>
              <v-icon size="18" class="opacity-50">chevron_right</v-icon>
            </template>
          </v-list-item>
        </v-list>
      </v-card>

      <v-card variant="flat" class="accounts-card accounts-detail">
        <template v-if="selectedUser">
          <div class="accounts-detail__head">
            <PlayerAvatar
              class="overflow-hidden rounded-full flex-shrink-0"
              :src="skinOf(selectedUser)"
              :dimension="64"
            />
            <div class="min-w-0 flex-grow">
              <div class="d-flex align-center flex-wrap gap-2">
                <h2 class="text-subtitle-1 font-weight-bold text-truncate">
                  {{ displayName(selectedUser) }}
                </h2>
                <v-chip v-if="selectedUser.id === activeUserId" size="x-small" color="primary" variant="flat">
                  {{ t('accounts.active') }}
                </v-chip>
                <v-chip v-else-if="isExpired(selectedUser)" size="x-small" color="error" variant="tonal">
                  {{ t('accounts.expired') }}
                </v-chip>
              </div>
              <div class="text-caption opacity-70 text-truncate">{{ selectedUser.username || '—' }}</div>
              <div class="text-caption opacity-60">{{ authorityName(selectedUser.authority) }}</div>
            </div>
          </div>

          <div class="accounts-actions">
            <v-btn
              v-if="selectedUser.id !== activeUserId"
              color="primary"
              variant="flat"
              size="small"
              prepend-icon="login"
              :disabled="actionBlocked"
              @click="activate(selectedUser.id)"
            >
              {{ t('accounts.useAccount') }}
            </v-btn>
            <v-btn v-else variant="tonal" size="small" prepend-icon="check" disabled>
              {{ t('accounts.activeAccount') }}
            </v-btn>
            <v-btn
              v-if="selectedUser.authority !== AUTHORITY_DEV"
              size="small"
              variant="tonal"
              prepend-icon="sync"
              :loading="busy === `refresh:${selectedUser.id}`"
              :disabled="actionBlocked"
              @click="refresh(selectedUser)"
            >
              {{ t('accounts.refresh') }}
            </v-btn>
            <v-btn
              v-if="selectedUser.authority !== AUTHORITY_DEV && isExpired(selectedUser)"
              size="small"
              variant="tonal"
              prepend-icon="key"
              :loading="busy === `relogin:${selectedUser.id}`"
              :disabled="actionBlocked"
              @click="reconnect(selectedUser)"
            >
              {{ t('accounts.reconnect') }}
            </v-btn>
            <v-spacer />
            <v-btn
              size="small"
              variant="text"
              color="error"
              prepend-icon="delete"
              :disabled="actionBlocked"
              @click="confirmRemove(selectedUser)"
            >
              {{ t('accounts.removeAccount') }}
            </v-btn>
          </div>

          <div class="accounts-info">
            <div class="accounts-info__row">
              <span class="accounts-info__label">{{ t('accounts.accountId') }}</span>
              <div class="accounts-info__value">
                <code class="text-caption">{{ shortId(selectedUser.id) }}</code>
                <v-btn
                  icon
                  size="x-small"
                  variant="text"
                  :aria-label="t('accounts.copyId')"
                  :title="copiedId === selectedUser.id ? t('accounts.copied') : t('accounts.copyId')"
                  @click="copyId(selectedUser.id)"
                >
                  <v-icon size="16">{{ copiedId === selectedUser.id ? 'check' : 'content_copy' }}</v-icon>
                </v-btn>
              </div>
            </div>
            <div class="accounts-info__row">
              <span class="accounts-info__label">{{ t('accounts.session') }}</span>
              <span class="accounts-info__value" :class="{ 'text-error': isExpired(selectedUser) }">
                {{ sessionLabel(selectedUser) }}
              </span>
            </div>
            <div class="accounts-info__row">
              <span class="accounts-info__label">{{ t('accounts.gameProfiles') }}</span>
              <span class="accounts-info__value">
                {{ t('accounts.profileCount', { count: profilesOf(selectedUser).length }) }}
              </span>
            </div>
          </div>

          <div class="accounts-profiles">
            <div class="text-subtitle-2 font-weight-bold opacity-80 mb-2">
              {{ t('accounts.gameProfiles') }}
            </div>
            <div v-if="profilesOf(selectedUser).length === 0" class="text-body-2 opacity-60">
              {{ t('accounts.noProfiles') }}
            </div>
            <div
              v-for="profile of profilesOf(selectedUser)"
              :key="profile.id"
              class="accounts-profile"
            >
              <PlayerAvatar
                class="overflow-hidden rounded-full flex-shrink-0"
                :src="profile.textures?.SKIN?.url ?? ''"
                :dimension="28"
              />
              <div class="min-w-0 flex-grow">
                <div class="d-flex align-center gap-2">
                  <span class="text-body-2 font-weight-medium text-truncate">{{ profile.name }}</span>
                  <v-chip
                    v-if="profile.id === selectedUser.selectedProfile"
                    size="x-small"
                    color="primary"
                    variant="tonal"
                  >
                    {{ t('accounts.currentProfile') }}
                  </v-chip>
                </div>
                <code class="text-caption opacity-50">{{ shortId(profile.id) }}</code>
              </div>
              <v-btn
                v-if="profile.id !== selectedUser.selectedProfile"
                size="x-small"
                variant="text"
                :disabled="actionBlocked"
                @click="switchProfile(selectedUser, profile.id)"
              >
                {{ t('accounts.switchTo') }}
              </v-btn>
              <v-btn
                v-if="selectedUser.authority === AUTHORITY_DEV && profilesOf(selectedUser).length > 1"
                icon="delete"
                size="x-small"
                variant="text"
                color="error"
                :aria-label="t('accounts.removeProfile')"
                :title="t('accounts.removeProfile')"
                :disabled="actionBlocked"
                @click="confirmRemoveProfile(selectedUser, profile)"
              />
            </div>
          </div>
        </template>

        <div v-else class="accounts-detail__empty">
          <v-icon size="40" class="opacity-30">manage_accounts</v-icon>
          <p class="text-body-2 opacity-70 mt-2 mb-0">{{ t('accounts.noSelection') }}</p>
          <p class="text-caption opacity-50 mb-0">{{ t('accounts.noAccountsHint') }}</p>
        </div>
      </v-card>
    </div>

    <v-card variant="flat" class="accounts-card">
      <div class="px-4 pt-3 pb-1 text-subtitle-2 font-weight-bold opacity-80">
        {{ t('accounts.linkedServices') }}
      </div>
      <div class="px-4 pb-3 d-flex flex-wrap align-center gap-3">
        <v-icon size="24" color="primary">storefront</v-icon>
        <div class="flex-grow">
          <div class="text-body-2 font-weight-medium">Modrinth</div>
          <div class="text-caption opacity-70">
            {{ modrinthLinked ? t('accounts.linked') : t('accounts.notLinked') }}
          </div>
        </div>
        <v-btn
          size="small"
          :variant="modrinthLinked ? 'tonal' : 'flat'"
          :color="modrinthLinked ? undefined : 'primary'"
          :loading="busy === 'modrinth'"
          :disabled="!!busy || bulk.running"
          @click="linkModrinth"
        >
          {{ modrinthLinked ? t('accounts.relink') : t('accounts.connect') }}
        </v-btn>
      </div>
      <v-divider class="opacity-20" />
      <XmclAccountPanel />
    </v-card>

    <v-dialog v-model="offlineDialog" max-width="440">
      <v-card>
        <v-card-title class="text-subtitle-1">{{ t('accounts.addOffline') }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="offlineName"
            :label="t('accounts.offlineUsername')"
            :hint="t('accounts.offlineHint')"
            persistent-hint
            autofocus
            data-testid="accounts-offline-username"
            @keydown.enter="createOffline"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="offlineDialog = false">{{ t('accounts.cancel') }}</v-btn>
          <v-btn
            color="primary"
            :disabled="!isValidOfflineName || !!busy"
            :loading="busy === 'offline'"
            @click="createOffline"
          >
            {{ t('accounts.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="removeDialog" max-width="440">
      <v-card>
        <v-card-title class="text-subtitle-1">{{ t('accounts.removeTitle') }}</v-card-title>
        <v-card-text>
          {{ t('accounts.removeText', { name: removeTarget ? displayName(removeTarget) : '' }) }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="removeDialog = false">{{ t('accounts.cancel') }}</v-btn>
          <v-btn color="error" :loading="busy === 'remove'" @click="doRemove">
            {{ t('accounts.remove') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="removeProfileDialog" max-width="440">
      <v-card>
        <v-card-title class="text-subtitle-1">{{ t('accounts.removeProfileTitle') }}</v-card-title>
        <v-card-text>
          {{ t('accounts.removeProfileText', { name: profileTarget?.profile.name ?? '' }) }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="removeProfileDialog = false">
            {{ t('accounts.cancel') }}
          </v-btn>
          <v-btn color="error" :loading="busy === 'remove-profile'" @click="doRemoveProfile">
            {{ t('accounts.removeProfile') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  AUTHORITY_DEV,
  AUTHORITY_MICROSOFT,
  AUTHORITY_MOJANG,
  type GameProfileAndTexture,
  type UserProfile,
  UserServiceKey,
} from '@xmcl/runtime-api'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import XmclAccountPanel from '@/components/XmclAccountPanel.vue'
import { useService } from '@/composables'
import { kUserContext } from '@/composables/user'
import { injection } from '@/util/inject'

type FilterKey = 'all' | 'microsoft' | 'offline' | 'third' | 'expired'
type SortKey = 'name' | 'authority' | 'profiles'

const { t, locale } = useI18n()
const { users, userProfile, select } = injection(kUserContext)
const {
  login,
  refreshUser,
  removeUser,
  selectUserGameProfile,
  removeUserGameProfile,
  hasModrinthToken,
  loginModrinth,
} = useService(UserServiceKey)

const busy = ref('')
const error = ref('')
const notice = ref('')
const offlineDialog = ref(false)
const offlineName = ref('')
const removeDialog = ref(false)
const removeTarget = ref<UserProfile>()
const removeProfileDialog = ref(false)
const profileTarget = ref<{ user: UserProfile; profile: GameProfileAndTexture }>()
const modrinthLinked = ref(false)
const copiedId = ref('')
let copiedTimer: ReturnType<typeof setTimeout> | undefined

const search = ref('')
const filter = ref<FilterKey>('all')
const sortKey = ref<SortKey>('name')
const selectedId = ref('')
const bulk = ref({ running: false, done: 0, total: 0 })

const activeUserId = computed(() => userProfile.value?.id ?? '')
const actionBlocked = computed(() => !!busy.value || bulk.value.running)

const profilesOf = (user?: UserProfile) => Object.values(user?.profiles ?? {})
const displayName = (user?: UserProfile) =>
  user?.profiles?.[user.selectedProfile]?.name || user?.username || user?.id || ''

function isExpired(user?: UserProfile) {
  if (!user) return false
  return user.invalidated || (user.expiredAt > 0 && user.expiredAt < Date.now())
}

function authorityName(authority?: string) {
  if (authority === AUTHORITY_MICROSOFT) return t('accounts.microsoft')
  if (authority === AUTHORITY_MOJANG) return t('accounts.mojang')
  if (authority === AUTHORITY_DEV) return t('accounts.offline')
  return t('accounts.thirdParty')
}

function skinOf(user?: UserProfile) {
  if (!user) return ''
  const profile = user.profiles[user.selectedProfile] ?? profilesOf(user)[0]
  return profile?.textures?.SKIN?.url ?? ''
}

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
}

function sessionLabel(user?: UserProfile) {
  if (!user) return '—'
  if (user.authority === AUTHORITY_DEV) return t('accounts.sessionOffline')
  if (!user.expiredAt || user.expiredAt < 0) return t('accounts.sessionUnknown')
  const date = new Date(user.expiredAt)
  if (Number.isNaN(date.valueOf())) return t('accounts.sessionUnknown')
  const formatted = new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
  return isExpired(user)
    ? t('accounts.sessionExpiredAt', { date: formatted })
    : t('accounts.sessionValid', { date: formatted })
}

const selectedUser = computed(() => users.value.find((user) => user.id === selectedId.value))

watch([users, activeUserId], () => {
  if (selectedId.value && users.value.some((user) => user.id === selectedId.value)) return
  selectedId.value = activeUserId.value || users.value[0]?.id || ''
}, { immediate: true })

const profileTotal = computed(() =>
  users.value.reduce((total, user) => total + profilesOf(user).length, 0),
)
const expiredTotal = computed(() => users.value.filter((user) => isExpired(user)).length)
const refreshTargets = computed(() =>
  users.value.filter((user) => user.authority !== AUTHORITY_DEV),
)

const filters = computed<{ value: FilterKey; text: string; count: number }[]>(() => [
  { value: 'all', text: t('accounts.filterAll'), count: users.value.length },
  {
    value: 'microsoft',
    text: t('accounts.microsoft'),
    count: users.value.filter((user) => user.authority === AUTHORITY_MICROSOFT).length,
  },
  {
    value: 'offline',
    text: t('accounts.offline'),
    count: users.value.filter((user) => user.authority === AUTHORITY_DEV).length,
  },
  {
    value: 'third',
    text: t('accounts.thirdParty'),
    count: users.value.filter(
      (user) => user.authority !== AUTHORITY_MICROSOFT && user.authority !== AUTHORITY_DEV,
    ).length,
  },
  { value: 'expired', text: t('accounts.filterExpired'), count: expiredTotal.value },
])

const sortOptions = computed<{ value: SortKey; title: string }[]>(() => [
  { value: 'name', title: t('accounts.sortName') },
  { value: 'authority', title: t('accounts.sortAuthority') },
  { value: 'profiles', title: t('accounts.sortProfiles') },
])

function searchable(user: UserProfile) {
  return [
    displayName(user),
    user.username,
    user.id,
    authorityName(user.authority),
    ...profilesOf(user).map((profile) => profile.name),
  ].join(' ').toLowerCase()
}

const filteredUsers = computed(() => {
  const query = search.value.trim().toLowerCase()
  const list = users.value.filter((user) => {
    if (filter.value === 'microsoft' && user.authority !== AUTHORITY_MICROSOFT) return false
    if (filter.value === 'offline' && user.authority !== AUTHORITY_DEV) return false
    if (
      filter.value === 'third' &&
      (user.authority === AUTHORITY_MICROSOFT || user.authority === AUTHORITY_DEV)
    ) return false
    if (filter.value === 'expired' && !isExpired(user)) return false
    return !query || searchable(user).includes(query)
  })
  const byName = (a: UserProfile, b: UserProfile) =>
    displayName(a).localeCompare(displayName(b), locale.value)
  return list.sort((a, b) => {
    if (sortKey.value === 'authority') {
      return authorityName(a.authority).localeCompare(authorityName(b.authority), locale.value) || byName(a, b)
    }
    if (sortKey.value === 'profiles') {
      return profilesOf(b).length - profilesOf(a).length || byName(a, b)
    }
    return byName(a, b)
  })
})

async function run(key: string, action: () => Promise<unknown>) {
  if (busy.value) return
  busy.value = key
  error.value = ''
  try {
    await action()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = ''
  }
}

function addMicrosoft() {
  return run('add', async () => {
    const profile = await login({ username: '', authority: AUTHORITY_MICROSOFT })
    if (profile?.id) select(profile.id)
  })
}

const isValidOfflineName = computed(() => /^[A-Za-z0-9_]{3,16}$/.test(offlineName.value.trim()))

function createOffline() {
  if (!isValidOfflineName.value) return
  return run('offline', async () => {
    const profile = await login({ username: offlineName.value.trim(), authority: AUTHORITY_DEV })
    if (profile?.id) select(profile.id)
    offlineName.value = ''
    offlineDialog.value = false
  })
}

function activate(id: string) {
  select(id)
}

function refresh(user?: UserProfile) {
  if (!user) return
  return run(`refresh:${user.id}`, () => refreshUser(user.id, { force: true }))
}

function reconnect(user?: UserProfile) {
  if (!user) return
  return run(`relogin:${user.id}`, async () => {
    const profile = await login({ username: user.username, authority: user.authority })
    if (profile?.id) select(profile.id)
  })
}

async function refreshAll() {
  if (actionBlocked.value || refreshTargets.value.length === 0) return
  const targets = [...refreshTargets.value]
  bulk.value = { running: true, done: 0, total: targets.length }
  error.value = ''
  notice.value = ''
  let ok = 0
  let failed = 0
  for (const user of targets) {
    try {
      await refreshUser(user.id, { force: true })
      ok++
    } catch {
      failed++
    }
    bulk.value = { ...bulk.value, done: bulk.value.done + 1 }
  }
  bulk.value = { ...bulk.value, running: false }
  notice.value = failed
    ? t('accounts.refreshPartial', { ok, failed })
    : t('accounts.refreshed', { count: ok })
}

function switchProfile(user: UserProfile, profileId: string) {
  return run(`profile:${user.id}`, async () => {
    await selectUserGameProfile(user, profileId)
    select(user.id)
  })
}

async function copyId(id: string) {
  try {
    await navigator.clipboard.writeText(id)
    copiedId.value = id
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copiedId.value = '' }, 1600)
  } catch {
    copiedId.value = ''
  }
}

function confirmRemove(user: UserProfile) {
  removeTarget.value = user
  removeDialog.value = true
}

function doRemove() {
  const target = removeTarget.value
  if (!target) return
  return run('remove', async () => {
    await removeUser(target)
    removeDialog.value = false
    removeTarget.value = undefined
    if (selectedId.value === target.id) selectedId.value = ''
    const remaining = users.value[0]
    if (remaining) select(remaining.id)
  })
}

function confirmRemoveProfile(user: UserProfile, profile: GameProfileAndTexture) {
  profileTarget.value = { user, profile }
  removeProfileDialog.value = true
}

function doRemoveProfile() {
  const target = profileTarget.value
  if (!target) return
  return run('remove-profile', async () => {
    await removeUserGameProfile(target.user, target.profile.id)
    removeProfileDialog.value = false
    profileTarget.value = undefined
  })
}

function linkModrinth() {
  return run('modrinth', async () => {
    await loginModrinth()
    modrinthLinked.value = await hasModrinthToken()
  })
}

onMounted(async () => {
  modrinthLinked.value = await hasModrinthToken().catch(() => false)
})
</script>

<style scoped>
.accounts-page {
  overflow-y: auto;
}

.accounts-card {
  background: rgba(var(--v-theme-surface), 0.35);
  border: var(--card-subsection-border);
  border-radius: var(--card-item-radius);
}

.accounts-item--active {
  background: rgba(var(--v-theme-primary), 0.1);
  border-radius: var(--card-item-radius);
}

.accounts-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.accounts-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 16px;
  background: rgba(var(--v-theme-surface), 0.35);
  border: var(--card-subsection-border);
  border-radius: var(--card-item-radius);
}

.accounts-stat__value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.1;
}

.accounts-stat__label {
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  opacity: 0.6;
}

.accounts-stat--alert .accounts-stat__value {
  color: rgb(var(--v-theme-error));
}

.accounts-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 12px;
}

.accounts-layout {
  display: grid;
  grid-template-columns: minmax(0, 340px) minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.accounts-list {
  max-height: 70vh;
  overflow-y: auto;
}

.accounts-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 320px;
  padding: 20px;
}

.accounts-detail__head {
  display: flex;
  align-items: center;
  gap: 16px;
}

.accounts-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.accounts-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: rgba(var(--v-theme-surface), 0.25);
  border-radius: var(--card-item-radius);
}

.accounts-info__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.8125rem;
}

.accounts-info__label {
  opacity: 0.6;
}

.accounts-info__value {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow-wrap: anywhere;
  text-align: right;
}

.accounts-profiles {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.accounts-profile {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: var(--card-item-radius);
}

.accounts-profile:hover {
  background: rgba(255, 255, 255, 0.04);
}

.accounts-detail__empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  text-align: center;
}

@media (max-width: 1100px) {
  .accounts-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .accounts-list {
    max-height: none;
  }
}

@media (max-width: 700px) {
  .accounts-toolbar,
  .accounts-stats {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
