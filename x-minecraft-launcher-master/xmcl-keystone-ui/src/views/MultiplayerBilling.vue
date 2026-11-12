<template>
  <div
    id="multiplayer-together"
    data-testid="together-section"
    class="grid w-full content-start gap-4 px-4 pb-8 pt-2"
  >
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex min-w-0 items-start gap-3">
        <v-avatar color="primary" rounded size="44" variant="tonal">
          <v-icon size="24">hub</v-icon>
        </v-avatar>
        <div class="min-w-0">
          <div class="text-overline text-medium-emphasis">
            {{ t('multiplayer.togetherName') }}
          </div>
          <h2 class="text-h6 font-weight-bold">{{ t('multiplayer.togetherHomeName') }}</h2>
          <p class="mt-1 max-w-2xl text-body-2 text-medium-emphasis">
            {{ t('multiplayer.billingDescription') }}
          </p>
        </div>
      </div>
      <v-btn
        :aria-label="t('shared.refresh')"
        icon="refresh"
        :loading="loading"
        variant="text"
        @click="refresh()"
      />
    </header>

    <v-alert type="success" variant="tonal" density="comfortable" class="items-start">
      <div class="flex items-start gap-3">
        <v-icon size="22">volunteer_activism</v-icon>
        <div>
          <div class="text-body-2 font-weight-bold">{{ t('freeAccess.title') }}</div>
          <div class="text-caption">{{ t('freeAccess.notice') }}</div>
          <div class="mt-1 text-caption">{{ t('freeAccess.body') }}</div>
        </div>
      </div>
    </v-alert>

    <div class="flex flex-wrap items-center gap-2">
      <v-chip v-if="subscription" :color="subscriptionColor" label size="small">
        <v-icon start>verified</v-icon>
        {{ t(`multiplayer.subscription.${subscription.status}`) }}
      </v-chip>
      <v-chip v-if="trial" label size="small" variant="tonal">
        <v-icon start>science</v-icon>
        {{ t(`multiplayer.trial.${trial.status}`) }}
      </v-chip>
      <span v-if="subscription && periodEndsAt" class="text-caption text-medium-emphasis">
        {{
          subscription.cancelAtPeriodEnd
            ? t('multiplayer.togetherPlanEnds', { date: periodEndsAt })
            : t('multiplayer.togetherPlanRenews', { date: periodEndsAt })
        }}
      </span>
    </div>

    <v-alert v-if="error" density="compact" type="error" variant="tonal">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span>{{ t('multiplayer.billingError') }}</span>
        <v-btn size="small" variant="text" :loading="loading" @click="refresh()">
          {{ t('multiplayer.togetherRetry') }}
        </v-btn>
      </div>
    </v-alert>

    <v-progress-linear v-if="loading && !overview" color="primary" indeterminate rounded />

    <v-card v-if="relayAllowance" class="pa-4" color="success" variant="tonal">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2 text-caption">
          <v-icon size="16">cloud_done</v-icon>
          {{ t('multiplayer.togetherRelayTitle') }}
        </div>
        <span class="text-caption">
          {{
            t('multiplayer.relayAllowanceSummary', {
              remaining: formatBytes(relayAllowance.remaining),
              total: formatBytes(relayAllowance.included),
            })
          }}
        </span>
      </div>
      <v-progress-linear
        class="mt-3"
        color="success"
        height="8"
        :model-value="relayPercent"
        rounded
      />
    </v-card>

    <v-card class="pa-4" variant="outlined">
      <div class="flex items-center gap-2">
        <v-icon size="18" color="primary">hub</v-icon>
        <div class="text-base font-semibold">{{ t('multiplayer.togetherHomeName') }}</div>
      </div>
      <p class="mt-2 text-body-2 text-medium-emphasis">
        {{ t('freeAccess.togetherHint') }}
      </p>
    </v-card>

    <div class="flex flex-wrap items-center justify-between gap-3 px-1">
      <p v-if="hasAccess" class="min-w-48 flex-1 text-body-2 text-medium-emphasis">
        {{ t('multiplayer.togetherSupportHint') }}
      </p>
      <v-btn
        href="https://discord.gg/5CZXbjMcyv"
        prepend-icon="xmcl:discord"
        target="browser"
        variant="text"
      >
        {{ t('multiplayer.joinDiscord') }}
      </v-btn>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TogetherSection } from '@/composables/together'
import { formatTogetherBytes } from '@/util/multiplayerTogether'

const props = defineProps<{
  together: TogetherSection
}>()

const {
  overview,
  loading,
  error,
  trial,
  subscription,
  hasAccess,
  relayAllowance,
  refresh,
} = props.together

const { t, locale } = useI18n()

const subscriptionColor = computed(() => {
  switch (subscription.value?.status) {
    case 'active':
      return 'success'
    case 'payment_due':
      return 'warning'
    default:
      return undefined
  }
})

const relayPercent = computed(() => {
  const allowance = relayAllowance.value
  if (!allowance?.included) return 0
  return Math.max(0, Math.min(100, (allowance.remaining / allowance.included) * 100))
})

const dateFormatter = computed(
  () => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }),
)

function formatDate(value?: string) {
  if (!value) return ''
  const time = Date.parse(value)
  return Number.isFinite(time) ? dateFormatter.value.format(time) : ''
}

const periodEndsAt = computed(() => formatDate(subscription.value?.currentPeriodEndsAt))

function formatBytes(bytes: number) {
  return formatTogetherBytes(bytes, locale.value)
}
</script>
