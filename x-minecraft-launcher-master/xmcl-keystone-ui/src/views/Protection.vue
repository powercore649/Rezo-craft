<template>
  <div class="protection-page">
    <header class="protection-page__head">
      <div class="protection-page__icon">
        <v-icon size="26">shield</v-icon>
      </div>
      <div>
        <h1 class="protection-page__title">{{ t('antivirus.title') }}</h1>
        <p class="protection-page__sub">{{ t('antivirus.description') }}</p>
      </div>
    </header>
    <SettingAntivirus />
  </div>
</template>

<script lang="ts" setup>
import SettingAntivirus from './SettingAntivirus.vue'

const { t } = useI18n()
</script>

<style scoped>
.protection-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 900px;
  padding: 24px 24px 40px;
}

.protection-page__head {
  display: flex;
  align-items: center;
  gap: 14px;
}

.protection-page__icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(135deg, #3fb27f, #2d8a63);
  box-shadow: 0 8px 22px rgba(63, 178, 127, 0.28);
}

.protection-page__title {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
}

.protection-page__sub {
  margin-top: 2px;
  font-size: 0.82rem;
  opacity: 0.65;
}
</style>
