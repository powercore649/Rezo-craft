<template>
  <div data-testid="news-page" class="h-full w-full select-none overflow-auto">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-10 pt-3">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex min-w-0 items-start gap-3">
          <v-avatar color="primary" rounded size="44" variant="tonal">
            <v-icon size="24">newspaper</v-icon>
          </v-avatar>
          <div class="min-w-0">
            <h1 class="text-h5 font-weight-bold">{{ t('appNews.name') }}</h1>
            <p class="mt-1 max-w-2xl text-body-2 text-medium-emphasis">
              {{ t('appNews.description') }}
            </p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <v-chip v-if="countryLabel" label size="small" variant="tonal">
            <v-icon start size="14">public</v-icon>
            {{ countryLabel }}
          </v-chip>
          <v-btn
            :aria-label="t('appNews.refresh')"
            icon="refresh"
            :loading="loading"
            variant="tonal"
            @click="load(true)"
          />
        </div>
      </header>

      <v-alert v-if="feed?.error" density="compact" type="warning" variant="tonal">
        <div>{{ t('appNews.error') }}</div>
        <v-btn class="mt-2" size="small" variant="flat" @click="load(true)">{{ t('appNews.retry') }}</v-btn>
      </v-alert>

      <v-progress-linear v-if="loading && !items.length" indeterminate />

      <div v-if="items.length" class="grid gap-3 md:grid-cols-2">
        <button
          v-for="item of items"
          :key="item.link"
          class="news-card"
          type="button"
          @click="controller.openExternalLink(item.link)"
        >
          <div class="flex items-start gap-2">
            <div class="min-w-0 flex-1">
              <div class="text-body-1 font-weight-medium">{{ item.title }}</div>
              <div class="mt-2 flex flex-wrap items-center gap-2 text-caption text-medium-emphasis">
                <v-chip v-if="item.source" label size="x-small" variant="tonal">{{ item.source }}</v-chip>
                <span>{{ dateLabel(item.publishedAt) }}</span>
              </div>
            </div>
            <v-icon class="news-card__open" size="18">open_in_new</v-icon>
          </div>
        </button>
      </div>

      <div v-else-if="!loading" class="text-caption text-medium-emphasis">
        {{ t('appNews.empty') }}
      </div>

      <div class="text-caption text-medium-emphasis">
        {{ t('appNews.poweredBy') }}
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { NewsFeed, NewsItem } from '@xmcl/runtime-api'

const { t, locale } = useI18n()
const controller = windowController

const loading = ref(false)
const feed = ref<NewsFeed>()
const items = computed<NewsItem[]>(() => feed.value?.items ?? [])

const countryLabel = computed(() => {
  const country = feed.value?.country
  if (!country) return ''
  try {
    const countryName = new Intl.DisplayNames([locale.value], { type: 'region' }).of(country) ?? country
    return t('appNews.localized', { country: countryName })
  } catch {
    return country
  }
})

function dateLabel(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

async function load(force = false) {
  loading.value = true
  try {
    feed.value = await controller.getNews(force)
  } finally {
    loading.value = false
  }
}

onMounted(() => load(false))
</script>

<style scoped>
.news-card {
  display: block;
  padding: 14px;
  border: 1px solid rgba(var(--v-border-color), 0.16);
  border-radius: 12px;
  background: rgba(var(--v-theme-surface), 0.35);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.16s ease, transform 0.16s ease;
}

.news-card:hover {
  border-color: rgb(var(--v-theme-primary));
  transform: translateY(-1px);
}

.news-card__open {
  opacity: 0.4;
}
</style>
