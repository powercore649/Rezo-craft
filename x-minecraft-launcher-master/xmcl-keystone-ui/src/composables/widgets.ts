import { computed, ref, watch } from 'vue'

export interface WidgetDefinition {
  id: string
  icon: string
  nameKey: string
  descriptionKey: string
}

export const widgetDefinitions: WidgetDefinition[] = [
  { id: 'pc-stats', icon: 'monitor_heart', nameKey: 'appWidgets.pcStats.name', descriptionKey: 'appWidgets.pcStats.description' },
  { id: 'clock', icon: 'schedule', nameKey: 'appWidgets.clock.name', descriptionKey: 'appWidgets.clock.description' },
  { id: 'instance', icon: 'sports_esports', nameKey: 'appWidgets.instance.name', descriptionKey: 'appWidgets.instance.description' },
  { id: 'news', icon: 'newspaper', nameKey: 'appWidgets.news.name', descriptionKey: 'appWidgets.news.description' },
]

const STORAGE_KEY = 'novacraft.widgets.v1'
const defaults = () => widgetDefinitions.map((widget) => widget.id)

function readStored(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return defaults()
    return widgetDefinitions
      .filter((widget) => parsed.includes(widget.id))
      .map((widget) => widget.id)
  } catch {
    return defaults()
  }
}

export function useWidgets() {
  const enabled = ref<string[]>(readStored())

  watch(enabled, (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      // A full or disabled storage must not break the home page.
    }
  }, { deep: true })

  const visible = computed(() => widgetDefinitions.filter((widget) => enabled.value.includes(widget.id)))

  function isEnabled(id: string) {
    return enabled.value.includes(id)
  }

  function toggle(id: string, value: boolean) {
    const has = enabled.value.includes(id)
    if (value && !has) enabled.value = [...enabled.value, id]
    else if (!value && has) enabled.value = enabled.value.filter((entry) => entry !== id)
  }

  return { enabled, visible, isEnabled, toggle }
}
