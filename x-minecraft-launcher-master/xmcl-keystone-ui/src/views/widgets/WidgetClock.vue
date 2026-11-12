<template>
  <section class="widget-card pa-4" data-testid="widget-clock">
    <div class="d-flex align-center gap-2">
      <v-icon color="primary" size="20">schedule</v-icon>
      <h3 class="text-subtitle-2 font-weight-bold flex-grow">{{ t('appWidgets.clock.name') }}</h3>
    </div>
    <div class="mt-3 widget-clock__time">{{ time }}</div>
    <div class="text-caption text-medium-emphasis text-capitalize">{{ date }}</div>
  </section>
</template>

<script lang="ts" setup>
const { t, locale } = useI18n()

const now = ref(new Date())
const time = computed(() => new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit' }).format(now.value))
const date = computed(() => new Intl.DateTimeFormat(locale.value, { weekday: 'long', day: 'numeric', month: 'long' }).format(now.value))

let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => { now.value = new Date() }, 10_000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>
