<template>
  <div class="desktop-widgets">
    <div class="desktop-widgets__bar">
      <v-icon size="14">widgets</v-icon>
      <span class="desktop-widgets__title">{{ t('appWidgets.desktopTitle') }}</span>
      <v-btn
        :aria-label="t('appWidgets.desktopHide')"
        class="desktop-widgets__action"
        icon="close"
        size="x-small"
        variant="text"
        @click="hide"
      />
    </div>
    <div class="desktop-widgets__grid">
      <WidgetPcStats />
      <WidgetClock />
    </div>
  </div>
</template>

<script lang="ts" setup>
import WidgetClock from '@/views/widgets/WidgetClock.vue'
import WidgetPcStats from '@/views/widgets/WidgetPcStats.vue'
import '@/views/widgets/widgets.css'

const { t } = useI18n()

function hide() {
  void windowController.setDesktopWidget(false)
}
</script>

<style scoped>
.desktop-widgets {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
  overflow: auto;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  background: rgba(16, 16, 24, 0.66);
  backdrop-filter: blur(18px);
}

.desktop-widgets__bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px 8px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  -webkit-app-region: drag;
}

.desktop-widgets__title {
  flex: 1;
}

.desktop-widgets__action {
  -webkit-app-region: no-drag;
}

.desktop-widgets__grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
