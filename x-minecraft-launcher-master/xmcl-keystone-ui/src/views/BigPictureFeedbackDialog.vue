<template>
  <v-dialog
    :model-value="modelValue"
    max-width="650"
    content-class="elevation-0"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="bp-subpage-card !m-0 !p-6 max-h-[85vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <v-icon color="primary" size="24">bug_report</v-icon>
          </div>
          <div>
            <h2 class="text-xl font-bold">{{ t('feedback.name') }}</h2>
            <div class="text-xs text-white/60">
              {{ t('feedback.description') }}
            </div>
          </div>
        </div>

        <v-btn
          icon="close"
          variant="text"
          size="small"
          data-gamepad-focusable
          @click="$emit('update:modelValue', false)"
        />
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto py-4 custom-scrollbar flex flex-col gap-4">
        <!-- Community Channels -->
        <div class="flex flex-col gap-3">
          <!-- Discord -->
          <div
            class="bp-setting-row !p-4 cursor-pointer"
            tabindex="0"
            role="button"
            data-gamepad-focusable
            @click="openUrl('https://discord.gg/5CZXbjMcyv')"
            @keydown.enter="openUrl('https://discord.gg/5CZXbjMcyv')"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-[#5865F2]/20 flex items-center justify-center">
                <v-icon size="24">xmcl:discord</v-icon>
              </div>
              <div class="flex flex-col">
                <div class="font-bold text-sm text-white">{{ t('feedback.discord') }}</div>
                <div class="text-xs text-white/50">{{ t('feedback.discordDescription') }}</div>
              </div>
            </div>
            <v-icon size="20" class="text-white/40">open_in_new</v-icon>
          </div>

          <!-- Export Diagnostic Logs -->
          <div
            class="bp-setting-row !p-4 cursor-pointer"
            tabindex="0"
            role="button"
            data-gamepad-focusable
            @click="exportLogs"
            @keydown.enter="exportLogs"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <v-icon size="24" color="warning">folder_zip</v-icon>
              </div>
              <div class="flex flex-col">
                <div class="font-bold text-sm text-white">{{ t('feedback.generateReport') }}</div>
                <div class="text-xs text-white/50">{{ t('feedback.description') }}</div>
              </div>
            </div>
            <v-icon size="20" class="text-white/40">folder</v-icon>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="pt-3 border-t border-white/10 flex items-center justify-end">
        <v-btn
          color="primary"
          variant="tonal"
          class="rounded-xl font-semibold"
          data-gamepad-focusable
          @click="$emit('update:modelValue', false)"
        >
          <span v-if="gamepadConnected" class="bp-glyph bp-glyph--b mr-1">{{ buttonBLabel }}</span>
          {{ t('shared.close') }}
        </v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDialog } from '@/composables/dialog'
import { useService } from '@/composables/service'
import { useGamepad } from '@/composables/gamepad'
import { BaseServiceKey } from '@xmcl/runtime-api'

const props = withDefaults(defineProps<{
  modelValue?: boolean
}>(), {
  modelValue: false,
})

defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const { t } = useI18n()
const { handleUrl } = useService(BaseServiceKey)
const { show: showLogDialog } = useDialog('log')

const gamepad = useGamepad()
const gamepadConnected = gamepad.connected
const buttonBLabel = gamepad.buttonB

function openUrl(url: string) {
  handleUrl(url)
}

function exportLogs() {
  showLogDialog()
}
</script>
