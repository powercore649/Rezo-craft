<template>
  <div
    class="app-version-banner non-selectable"
    role="banner"
    :aria-label="label"
    :title="label"
  >
    <img class="app-version-banner__logo" :src="logo" alt="" aria-hidden="true" />
    <span class="app-version-banner__name">{{ APP_NAME }}</span>
    <span v-if="version" class="app-version-banner__version">v{{ version }}</span>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { APP_NAME } from '@/constant'
import { kEnvironment } from '@/composables/environment'
import { injection } from '@/util/inject'
import logo from '@/assets/logo.png'

const env = injection(kEnvironment)
const version = computed(() => env.value?.version ?? '')
const label = computed(() => (version.value ? `${APP_NAME} v${version.value}` : APP_NAME))
</script>

<style scoped>
.app-version-banner {
  position: relative;
  z-index: 3;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding: 0 10px;
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.95);
  background-image: linear-gradient(90deg, #ff4d8d 0%, #c23bd8 55%, #6e2ce0 100%);
  -webkit-app-region: drag;
}

.app-version-banner__logo {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  object-fit: contain;
}

.app-version-banner__name {
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.app-version-banner__version {
  padding: 1px 6px;
  border-radius: 999px;
  background-color: rgba(0, 0, 0, 0.22);
  font-variant-numeric: tabular-nums;
}

.non-selectable {
  user-select: none;
}
</style>
