<template>
  <section class="about">
    <XmclAccountPanel class="mb-4" />
    <SettingCard>
      <div class="pa-4">
        <!-- Logo & Header info -->
        <div class="d-flex align-center flex-wrap gap-4 mb-6">
          <v-img
            :src="logo"
            :alt="`${APP_NAME} Logo`"
            width="64"
            height="64"
            class="mr-4 rounded-lg flex-grow-0 flex-shrink-0"
          ></v-img>
          <div>
            <a
              class="text-h5 font-weight-bold text-decoration-none"
              :href="discordUrl"
              target="_blank"
            >
              {{ APP_NAME }}
            </a>
            <div class="text-caption opacity-70 mt-1">
              REZO &amp; Raphael Wieczorek
            </div>
          </div>
          <v-spacer />
          <div class="d-flex align-center gap-2">
            <v-icon color="primary" size="small">verified</v-icon>
            <div class="text-caption font-weight-medium">{{ t('setting.aboutLicense') }}</div>
          </div>
        </div>
        <div class="text-caption opacity-70 mb-6">
          NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
        </div>

        <!-- Debug Info Box -->
        <div class="mb-8">
          <div class="text-subtitle-2 font-weight-bold mb-2 opacity-80">
            {{ t('setting.about') }}
          </div>
          <pre
            class="debug-info-code pa-4 text-caption font-mono"
          ><code>{{ debugInfo }}</code></pre>
        </div>

        <v-divider class="my-6 opacity-20" />

        <!-- Credits Section -->
        <div class="mb-8">
          <h3 :id="creditsHeadingId" class="text-subtitle-1 font-weight-bold text-center mb-4">
            {{ t('setting.aboutContributors') }}
          </h3>
          <div
            class="grid grid-cols-1 md:grid-cols-2 gap-6"
            role="group"
            :aria-labelledby="creditsHeadingId"
          >
            <div
              v-for="c in credits"
              :key="c"
              class="credit-card d-flex flex-column align-center text-center pa-4"
            >
              <v-icon color="primary" size="36" class="mb-2">account_circle</v-icon>
              <div class="text-subtitle-2 font-weight-bold">{{ c }}</div>
            </div>
          </div>
        </div>

        <v-divider class="my-6 opacity-20" />

        <!-- Support Section -->
        <div>
          <h3 :id="supportHeadingId" class="text-subtitle-1 font-weight-bold text-center mb-4">
            {{ t('feedback.discord') }}
          </h3>
          <div
            class="d-flex flex-column align-center text-center"
            role="group"
            :aria-labelledby="supportHeadingId"
          >
            <div class="text-caption opacity-80 mb-3">
              {{ t('feedback.discordDescription') }}
            </div>
            <v-btn
              color="indigo darken-2"
              variant="flat"
              prepend-icon="xmcl:discord"
              :href="discordUrl"
              target="_blank"
              rel="noreferrer"
            >
              {{ t('feedback.discordJoin') }}
            </v-btn>
            <div class="text-caption opacity-60 mt-3">
              {{ discordUrl }}
            </div>
          </div>
        </div>
      </div>
    </SettingCard>
  </section>
</template>

<script lang="ts" setup>
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import XmclAccountPanel from '@/components/XmclAccountPanel.vue'
import SettingCard from '@/components/SettingCard.vue'
import { kEnvironment } from '@/composables/environment'
import { kFlights } from '@/composables/flights'
import { injection } from '@/util/inject'
import logo from '../assets/logo.png'
import { APP_NAME } from '@/constant'

const env = injection(kEnvironment)
const flights = injection(kFlights)

const creditsHeadingId = useId()
const supportHeadingId = useId()

const debugInfo = computed(() => {
  return JSON.stringify({ ...env.value, flights }, null, 2)
})

const { t } = useI18n()

const discordUrl = 'https://discord.gg/5CZXbjMcyv'

const credits = ['REZO', 'Raphael Wieczorek']
</script>

<style scoped>
.debug-info-code {
  background: rgba(0, 0, 0, 0.25);
  border: var(--card-subsection-border);
  border-radius: var(--card-item-radius);
  color: rgba(var(--v-theme-on-surface), 0.85);
  max-height: 180px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.credit-card {
  background: rgba(var(--v-theme-surface), 0.3);
  border: var(--card-subsection-border);
  border-radius: var(--card-item-radius);
  transition: all 0.2s ease;
  min-height: 120px;
  justify-content: center;
}
.credit-card:hover {
  background: rgba(var(--v-theme-surface), 0.5);
  border-color: rgba(var(--v-theme-primary), 0.3);
  transform: translateY(-2px);
}

:deep(.v-img__img) {
  object-fit: contain;
}
</style>
