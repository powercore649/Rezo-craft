<template>
  <v-dialog v-model="open" max-width="640" persistent>
    <v-card class="welcome">
      <div class="welcome__hero">
        <div class="welcome__logo">
          <v-icon size="30">rocket_launch</v-icon>
        </div>
        <div>
          <h1 class="welcome__title">{{ t('welcome.title') }}</h1>
          <p class="welcome__subtitle">{{ t('welcome.subtitle') }}</p>
        </div>
      </div>

      <v-card-text class="pt-2">
        <p class="welcome__intro">{{ t('welcome.intro') }}</p>
        <div class="welcome__grid">
          <div v-for="feature in features" :key="feature.title" class="welcome__item">
            <v-icon :color="feature.color" size="22">{{ feature.icon }}</v-icon>
            <div>
              <div class="welcome__item-title">{{ t(feature.title) }}</div>
              <div class="welcome__item-hint">{{ t(feature.hint) }}</div>
            </div>
          </div>
        </div>
        <p class="welcome__where">{{ t('welcome.where') }}</p>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" variant="flat" @click="close">{{ t('welcome.start') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useLocalStorage } from '@vueuse/core'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// Shown once per install: the marker is stored locally, so a reinstall or a
// reset of the local storage shows the tour again.
const marker = useLocalStorage('novacraft_welcome', '')
const open = ref(marker.value !== '1.0')

const features = [
  { icon: 'battery_charging_full', color: 'success', title: 'welcome.battery', hint: 'welcome.batteryHint' },
  { icon: 'desktop_windows', color: 'primary', title: 'welcome.widgets', hint: 'welcome.widgetsHint' },
  { icon: 'sticky_note_2', color: 'warning', title: 'welcome.notes', hint: 'welcome.notesHint' },
  { icon: 'system_update', color: 'info', title: 'welcome.updates', hint: 'welcome.updatesHint' },
]

function close() {
  marker.value = '1.0'
  open.value = false
}
</script>

<style scoped>
.welcome {
  overflow: hidden;
}

.welcome__hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 24px 24px 8px;
  background: radial-gradient(circle at 10% 0%, rgba(91, 140, 255, 0.28), transparent 60%);
}

.welcome__logo {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(135deg, #5b8cff, #7a5bff);
  box-shadow: 0 8px 22px rgba(91, 140, 255, 0.35);
}

.welcome__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
}

.welcome__subtitle {
  margin: 2px 0 0;
  font-size: 0.8rem;
  opacity: 0.65;
}

.welcome__intro {
  margin: 0 0 14px;
  font-size: 0.88rem;
  line-height: 1.5;
  opacity: 0.8;
}

.welcome__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 10px;
}

.welcome__item {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
}

.welcome__item-title {
  font-size: 0.86rem;
  font-weight: 600;
}

.welcome__item-hint {
  margin-top: 2px;
  font-size: 0.76rem;
  line-height: 1.35;
  opacity: 0.65;
}

.welcome__where {
  margin: 14px 0 0;
  font-size: 0.78rem;
  opacity: 0.55;
}
</style>
