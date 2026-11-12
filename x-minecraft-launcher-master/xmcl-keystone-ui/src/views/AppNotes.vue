<template>
  <div data-testid="notes-page" class="h-full w-full overflow-hidden">
    <div class="mx-auto flex h-full w-full max-w-6xl flex-col gap-3 px-4 pb-4 pt-3">
      <header class="flex flex-wrap items-center gap-3">
        <v-avatar color="primary" rounded size="44" variant="tonal">
          <v-icon size="24">sticky_note_2</v-icon>
        </v-avatar>
        <div class="min-w-0 flex-grow">
          <h1 class="text-h5 font-weight-bold">{{ t('appNotes.name') }}</h1>
          <p class="text-body-2 text-medium-emphasis">{{ t('appNotes.description') }}</p>
        </div>
        <v-text-field
          v-model="search"
          class="notes-search"
          density="compact"
          hide-details
          :placeholder="t('appNotes.search')"
          prepend-inner-icon="search"
          variant="solo-filled"
        />
        <v-btn prepend-icon="add" variant="flat" @click="createAndSelect()">
          {{ t('appNotes.new') }}
        </v-btn>
      </header>

      <div class="flex min-h-0 flex-1 gap-3">
        <aside class="notes-list">
          <button
            v-for="note of filtered"
            :key="note.id"
            class="notes-list__item"
            :class="{ 'notes-list__item--active': note.id === selectedId }"
            type="button"
            @click="selectedId = note.id"
          >
            <div class="truncate font-weight-medium">{{ note.title || t('appNotes.untitled') }}</div>
            <div class="mt-1 truncate text-caption text-medium-emphasis">{{ preview(note.content) }}</div>
            <div class="mt-1 text-caption text-medium-emphasis">{{ dateLabel(note.updatedAt) }}</div>
          </button>
          <div v-if="!filtered.length" class="notes-list__empty text-caption text-medium-emphasis">
            {{ search ? t('appNotes.noResult') : t('appNotes.empty') }}
          </div>
        </aside>

        <section v-if="current" class="notes-editor">
          <div class="flex items-center gap-2">
            <v-text-field
              v-model="draft.title"
              density="compact"
              hide-details
              :placeholder="t('appNotes.titlePlaceholder')"
              variant="plain"
            />
            <v-btn
              :aria-label="t('appNotes.delete')"
              icon="delete_outline"
              variant="text"
              @click="removeCurrent()"
            />
          </div>
          <textarea
            v-model="draft.content"
            class="notes-textarea"
            :placeholder="t('appNotes.contentPlaceholder')"
            spellcheck="false"
          />
          <footer class="notes-footer text-caption text-medium-emphasis">
            <span>{{ t('appNotes.words', { count: wordCount }) }}</span>
            <span>{{ t('appNotes.chars', { count: draft.content.length }) }}</span>
            <span>{{ saved ? t('appNotes.saved') : t('appNotes.saving') }}</span>
          </footer>
        </section>
        <section v-else class="notes-editor notes-editor--empty text-caption text-medium-emphasis">
          {{ t('appNotes.emptyHint') }}
        </section>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { NoteItem } from '@/composables/notes'
import { useNotes } from '@/composables/notes'

const { t, locale } = useI18n()
const { notes, create, update, remove } = useNotes()

const search = ref('')
const selectedId = ref('')
const draft = reactive({ title: '', content: '' })
const saved = ref(true)

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return notes.value
  return notes.value.filter((note) =>
    note.title.toLowerCase().includes(query) || note.content.toLowerCase().includes(query))
})

const current = computed(() => notes.value.find((note) => note.id === selectedId.value))

const wordCount = computed(() => draft.content.trim().split(/\s+/).filter(Boolean).length)

function preview(content: string) {
  return content.replace(/\s+/g, ' ').trim().slice(0, 80) || t('appNotes.noContent')
}

function dateLabel(value: number) {
  try {
    return new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' })
      .format(new Date(value))
  } catch {
    return new Date(value).toLocaleString()
  }
}

function loadDraft(id: string) {
  const note = notes.value.find((item) => item.id === id)
  draft.title = note?.title ?? ''
  draft.content = note?.content ?? ''
  saved.value = true
}

watch(selectedId, (id) => {
  if (id) loadDraft(id)
  else {
    draft.title = ''
    draft.content = ''
  }
})

let saveTimer: ReturnType<typeof setTimeout> | undefined

function flush() {
  if (!selectedId.value) return
  const note = notes.value.find((item) => item.id === selectedId.value)
  if (!note) return
  if (note.title === draft.title && note.content === draft.content) {
    saved.value = true
    return
  }
  update(selectedId.value, { title: draft.title, content: draft.content })
  saved.value = true
}

watch(() => [draft.title, draft.content], () => {
  if (!selectedId.value) return
  saved.value = false
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = undefined
    flush()
  }, 400)
})

onMounted(() => {
  if (notes.value.length) selectedId.value = notes.value[0].id
})

onBeforeUnmount(() => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    flush()
  }
})

function createAndSelect() {
  const note: NoteItem = create('')
  selectedId.value = note.id
}

function removeCurrent() {
  const id = selectedId.value
  if (!id) return
  remove(id)
  selectedId.value = notes.value[0]?.id ?? ''
}
</script>

<style scoped>
.notes-search {
  max-width: 240px;
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 290px;
  flex-shrink: 0;
  overflow: auto;
  padding: 6px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 14px;
  background: rgba(var(--v-theme-surface), 0.7);
}

.notes-list__item {
  padding: 8px 10px;
  border-radius: 10px;
  text-align: left;
  border: 1px solid transparent;
  background: rgba(var(--v-theme-on-surface), 0.03);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.notes-list__item:hover {
  background: rgba(var(--v-theme-on-surface), 0.07);
}

.notes-list__item--active {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
}

.notes-list__empty {
  padding: 12px;
}

.notes-editor {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  padding: 10px 14px 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 14px;
  background: rgba(var(--v-theme-surface), 0.7);
}

.notes-editor--empty {
  align-items: center;
  justify-content: center;
}

.notes-textarea {
  flex: 1;
  min-height: 0;
  margin-top: 6px;
  padding: 8px 2px;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.6;
}

.notes-footer {
  display: flex;
  gap: 16px;
  padding-top: 8px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
</style>
