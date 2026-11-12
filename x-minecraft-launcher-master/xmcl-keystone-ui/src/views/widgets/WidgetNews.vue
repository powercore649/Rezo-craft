<template>
  <section class="widget-card pa-4" data-testid="widget-news">
    <div class="d-flex align-center gap-2">
      <v-icon color="primary" size="20">newspaper</v-icon>
      <h3 class="text-subtitle-2 font-weight-bold flex-grow">{{ t('appWidgets.news.name') }}</h3>
      <v-btn
        :aria-label="t('appWidgets.refresh')"
        icon="refresh"
        size="x-small"
        variant="text"
        :loading="loading"
        @click="load(true)"
      />
      <v-btn
        :aria-label="t('appWidgets.seeAll')"
        icon="arrow_forward"
        size="x-small"
        variant="text"
        @click="router.push('/news')"
      />
    </div>

    <div v-if="items.length" class="mt-2 flex flex-col gap-2">
      <button
        v-for="item of items"
        :key="item.link"
        class="widget-link"
        type="button"
        @click="controller.openExternalLink(item.link)"
      >
        <div class="widget-link__title">{{ item.title }}</div>
        <div class="widget-link__hint">{{ item.source }}</div>
      </button>
    </div>
    <div v-else class="mt-2 text-caption text-medium-emphasis">
      {{ failed ? t('appWidgets.news.error') : t('appWidgets.news.loading') }}
    </div>
  </section>
</template>

<script lang="ts" setup>
import type { NewsItem } from '@xmcl/runtime-api'

const router = useRouter()
const { t } = useI18n()
const controller = windowController

const items = ref<NewsItem[]>([])
const loading = ref(false)
const failed = ref(false)

async function load(force = false) {
  if (loading.value) return
  loading.value = true
  try {
    const feed = await controller.getNews(force)
    items.value = feed.items.slice(0, 3)
    failed.value = !items.value.length
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})
</script>
