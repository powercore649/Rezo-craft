<template>
  <div class="quick-menu">
    <v-btn
      class="quick-menu__fab"
      icon
      size="small"
      variant="flat"
      :aria-label="t('quickMenu.title')"
      @click="open = true"
    >
      <v-icon size="20">menu</v-icon>
    </v-btn>

    <v-navigation-drawer v-model="open" temporary location="left" width="300">
      <div class="qm-head">
        <div>
          <div class="qm-title">{{ t('quickMenu.title') }}</div>
          <div class="qm-sub">NovaCraft</div>
        </div>
        <v-btn
          :icon="editing ? 'check' : 'tune'"
          size="small"
          variant="text"
          :aria-label="editing ? t('quickMenu.done') : t('quickMenu.customize')"
          @click="editing = !editing"
        />
      </div>
      <v-divider />
      <v-list density="compact" nav>
        <v-list-item v-for="entry in entries" :key="entry.id" :value="entry.id" @click="onEntry(entry)">
          <template #prepend>
            <v-checkbox-btn
              v-if="editing"
              :model-value="isVisible(entry.id)"
              :aria-label="isVisible(entry.id) ? t('quickMenu.hide') : t('quickMenu.show')"
              @click.stop="toggle(entry.id)"
            />
            <v-icon v-else>{{ entry.icon }}</v-icon>
          </template>
          <v-list-item-title :class="{ 'qm-dim': editing && !isVisible(entry.id) }">{{ t(entry.label) }}</v-list-item-title>
          <template #append>
            <div v-if="editing" class="qm-move">
              <v-btn icon="keyboard_arrow_up" size="x-small" variant="text" :aria-label="t('quickMenu.moveUp')" @click.stop="move(entry.id, -1)" />
              <v-btn icon="keyboard_arrow_down" size="x-small" variant="text" :aria-label="t('quickMenu.moveDown')" @click.stop="move(entry.id, 1)" />
            </div>
          </template>
        </v-list-item>
      </v-list>
      <p v-if="editing" class="qm-hint">{{ t('quickMenu.hint') }}</p>
    </v-navigation-drawer>
  </div>
</template>

<script lang="ts" setup>
import { useLocalStorage } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

interface MenuEntry {
  id: string
  route: string
  icon: string
  label: string
}

const { t } = useI18n()
const router = useRouter()

const open = ref(false)
const editing = ref(false)

const all: MenuEntry[] = [
  { id: 'home', route: '/home', icon: 'home', label: 'quickMenu.home' },
  { id: 'store', route: '/store', icon: 'storefront', label: 'quickMenu.store' },
  { id: 'servers', route: '/servers', icon: 'dns', label: 'quickMenu.servers' },
  { id: 'news', route: '/news', icon: 'campaign', label: 'quickMenu.news' },
  { id: 'notes', route: '/notes', icon: 'sticky_note_2', label: 'quickMenu.notes' },
  { id: 'software-center', route: '/store', icon: 'apps', label: 'quickMenu.softwareCenter' },
  { id: 'protection', route: '/protection', icon: 'shield', label: 'quickMenu.protection' },
  { id: 'setting', route: '/setting', icon: 'settings', label: 'quickMenu.setting' },
]

const defaults = all.map((entry) => entry.id)
const config = useLocalStorage('novacraft_quick_menu', { order: [...defaults], hidden: [] as string[] })

const order = computed(() => {
  const saved = (config.value.order ?? []).filter((id) => defaults.includes(id))
  return [...saved, ...defaults.filter((id) => !saved.includes(id))]
})

const hidden = computed(() => config.value.hidden ?? [])

const entries = computed(() => {
  const ids = editing.value ? order.value : order.value.filter((id) => !hidden.value.includes(id))
  return ids.map((id) => all.find((entry) => entry.id === id)).filter((entry): entry is MenuEntry => !!entry)
})

function isVisible(id: string) {
  return !hidden.value.includes(id)
}

function toggle(id: string) {
  const next = new Set(hidden.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  config.value = { ...config.value, hidden: [...next] }
}

function move(id: string, direction: number) {
  const list = [...order.value]
  const index = list.indexOf(id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= list.length) return
  const [moved] = list.splice(index, 1)
  list.splice(target, 0, moved)
  config.value = { ...config.value, order: list }
}

function onEntry(entry: MenuEntry) {
  if (editing.value) return
  open.value = false
  if (entry.id === 'software-center') {
    // Opens its own window instead of a route inside the launcher.
    void (window as any).softwareCenter?.open()
    return
  }
  void router.push(entry.route)
}
</script>

<style scoped>
.quick-menu__fab {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 1001;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(28, 32, 44, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.quick-menu__fab:hover {
  background: rgba(40, 46, 62, 0.95);
}

.qm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px 12px;
}

.qm-title {
  font-size: 1rem;
  font-weight: 700;
}

.qm-sub {
  font-size: 0.72rem;
  opacity: 0.55;
}

.qm-move {
  display: flex;
}

.qm-dim {
  opacity: 0.45;
}

.qm-hint {
  padding: 10px 16px 18px;
  font-size: 0.72rem;
  line-height: 1.4;
  opacity: 0.55;
}
</style>
