<template>
  <div data-testid="writer-page" class="h-full w-full overflow-hidden">
    <div class="mx-auto flex h-full w-full max-w-6xl flex-col gap-3 px-4 pb-4 pt-3">
      <header class="flex flex-wrap items-center gap-3">
        <v-avatar color="secondary" rounded size="44" variant="tonal">
          <v-icon size="24">description</v-icon>
        </v-avatar>
        <div class="min-w-0 flex-grow">
          <h1 class="text-h5 font-weight-bold">{{ t('appWriter.name') }}</h1>
          <p class="text-body-2 text-medium-emphasis">{{ t('appWriter.description') }}</p>
        </div>
        <v-text-field
          v-model="search"
          class="writer-search"
          density="compact"
          hide-details
          :placeholder="t('appWriter.search')"
          prepend-inner-icon="search"
          variant="solo-filled"
        />
        <v-btn prepend-icon="add" variant="flat" @click="createAndSelect()">
          {{ t('appWriter.new') }}
        </v-btn>
      </header>

      <div class="flex min-h-0 flex-1 gap-3">
        <aside class="writer-list">
          <button
            v-for="doc of filtered"
            :key="doc.id"
            class="writer-list__item"
            :class="{ 'writer-list__item--active': doc.id === selectedId }"
            type="button"
            @click="select(doc.id)"
          >
            <div class="truncate font-weight-medium">{{ doc.title || t('appWriter.untitled') }}</div>
            <div class="mt-1 truncate text-caption text-medium-emphasis">{{ plainPreview(doc.html) || t('appWriter.noContent') }}</div>
            <div class="mt-1 text-caption text-medium-emphasis">{{ dateLabel(doc.updatedAt) }}</div>
          </button>
          <div v-if="!filtered.length" class="writer-list__empty text-caption text-medium-emphasis">
            {{ search ? t('appWriter.noResult') : t('appWriter.empty') }}
          </div>
        </aside>

        <section v-if="current" class="writer-editor">
          <div class="flex items-center gap-2">
            <v-text-field
              v-model="draftTitle"
              density="compact"
              hide-details
              :placeholder="t('appWriter.titlePlaceholder')"
              variant="plain"
            />
            <v-btn
              :aria-label="t('appWriter.export')"
              append-icon="download"
              variant="text"
              @click="exportDocument()"
            >
              {{ t('appWriter.export') }}
            </v-btn>
            <v-btn
              :aria-label="t('appWriter.delete')"
              icon="delete_outline"
              variant="text"
              @click="removeCurrent()"
            />
          </div>

          <div class="writer-toolbar">
            <template v-for="tool of tools" :key="tool.label">
              <v-divider v-if="tool.divider" class="mx-1" vertical />
              <v-btn
                class="writer-toolbar__button"
                density="comfortable"
                :disabled="!current"
                icon
                size="small"
                :title="tool.label"
                :aria-label="tool.label"
                variant="text"
                @mousedown.prevent="applyCommand(tool.command, tool.value)"
              >
                <v-icon size="20">{{ tool.icon }}</v-icon>
              </v-btn>
            </template>
          </div>

          <div
            ref="editor"
            class="writer-page"
            contenteditable="true"
            role="textbox"
            spellcheck="false"
            @input="onInput()"
          />

          <footer class="writer-footer text-caption text-medium-emphasis">
            <span>{{ t('appWriter.words', { count: wordCount }) }}</span>
            <span>{{ t('appWriter.chars', { count: charCount }) }}</span>
            <span>{{ saved ? t('appWriter.saved') : t('appWriter.saving') }}</span>
          </footer>
        </section>
        <section v-else class="writer-editor writer-editor--empty text-caption text-medium-emphasis">
          {{ t('appWriter.emptyHint') }}
        </section>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useDocuments } from '@/composables/documents'

const { t, locale } = useI18n()
const { documents, create, update, remove } = useDocuments()

const search = ref('')
const selectedId = ref('')
const draftTitle = ref('')
const editor = ref<HTMLElement>()
const saved = ref(true)
const wordCount = ref(0)
const charCount = ref(0)

const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return documents.value
  return documents.value.filter((doc) =>
    doc.title.toLowerCase().includes(query) || plainPreview(doc.html).toLowerCase().includes(query))
})

const current = computed(() => documents.value.find((doc) => doc.id === selectedId.value))

const tools = computed(() => [
  { icon: 'format_bold', label: t('appWriter.bold'), command: 'bold' },
  { icon: 'format_italic', label: t('appWriter.italic'), command: 'italic' },
  { icon: 'format_underlined', label: t('appWriter.underline'), command: 'underline' },
  { icon: 'format_strikethrough', label: t('appWriter.strike'), command: 'strikeThrough' },
  { icon: 'format_h1', label: t('appWriter.heading1'), command: 'formatBlock', value: '<h1>', divider: true },
  { icon: 'format_h2', label: t('appWriter.heading2'), command: 'formatBlock', value: '<h2>' },
  { icon: 'format_paragraph', label: t('appWriter.paragraph'), command: 'formatBlock', value: '<p>' },
  { icon: 'format_list_bulleted', label: t('appWriter.bullets'), command: 'insertUnorderedList', divider: true },
  { icon: 'format_list_numbered', label: t('appWriter.numbers'), command: 'insertOrderedList' },
  { icon: 'format_quote', label: t('appWriter.quote'), command: 'formatBlock', value: '<blockquote>' },
  { icon: 'format_align_left', label: t('appWriter.alignLeft'), command: 'justifyLeft', divider: true },
  { icon: 'format_align_center', label: t('appWriter.alignCenter'), command: 'justifyCenter' },
  { icon: 'format_align_right', label: t('appWriter.alignRight'), command: 'justifyRight' },
  { icon: 'undo', label: t('appWriter.undo'), command: 'undo', divider: true },
  { icon: 'redo', label: t('appWriter.redo'), command: 'redo' },
  { icon: 'format_clear', label: t('appWriter.clearFormat'), command: 'removeFormat' },
])

function plainPreview(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

function dateLabel(value: number) {
  try {
    return new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' })
      .format(new Date(value))
  } catch {
    return new Date(value).toLocaleString()
  }
}

function refreshCounts() {
  const text = editor.value?.innerText ?? ''
  charCount.value = text.replace(/\s+/g, ' ').trim().length
  wordCount.value = text.trim().split(/\s+/).filter(Boolean).length
}

function select(id: string) {
  selectedId.value = id
  draftTitle.value = documents.value.find((doc) => doc.id === id)?.title ?? ''
  saved.value = true
  nextTick(() => {
    if (!editor.value) return
    editor.value.innerHTML = documents.value.find((doc) => doc.id === id)?.html ?? ''
    refreshCounts()
  })
}

let saveTimer: ReturnType<typeof setTimeout> | undefined

function flush() {
  if (!selectedId.value) return
  const doc = documents.value.find((item) => item.id === selectedId.value)
  if (!doc) return
  const html = editor.value?.innerHTML ?? ''
  if (doc.title === draftTitle.value && doc.html === html) {
    saved.value = true
    return
  }
  update(selectedId.value, { title: draftTitle.value, html })
  saved.value = true
}

function scheduleSave() {
  saved.value = false
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = undefined
    flush()
  }, 400)
}

function onInput() {
  refreshCounts()
  scheduleSave()
}

watch(draftTitle, () => {
  if (selectedId.value) scheduleSave()
})

function applyCommand(command: string, value?: string) {
  if (!current.value) return
  editor.value?.focus()
  document.execCommand(command, false, value)
  onInput()
}

function createAndSelect() {
  const doc = create('')
  select(doc.id)
}

function removeCurrent() {
  const id = selectedId.value
  if (!id) return
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = undefined
  }
  remove(id)
  const next = documents.value[0]
  if (next) select(next.id)
  else {
    selectedId.value = ''
    draftTitle.value = ''
  }
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }[char] ?? char))
}

function exportDocument() {
  if (!current.value) return
  const body = editor.value?.innerHTML ?? ''
  const title = escapeHtml(draftTitle.value || t('appWriter.untitled'))
  const page = [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8">',
    `<title>${title}</title>`,
    '<style>body{font-family:Segoe UI,Arial,sans-serif;line-height:1.6;max-width:820px;margin:40px auto;padding:0 24px;color:#1c1c1c}blockquote{border-left:4px solid #ccc;margin-left:0;padding-left:16px;color:#555}</style>',
    '</head><body>',
    body,
    '</body></html>',
  ].join('')
  const url = URL.createObjectURL(new Blob([page], { type: 'text/html;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${(draftTitle.value || 'document').replace(/[\\/:*?"<>|]/g, '-')}.html`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

onMounted(() => {
  if (documents.value.length) select(documents.value[0].id)
})

onBeforeUnmount(() => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    flush()
  }
})
</script>

<style scoped>
.writer-search {
  max-width: 220px;
}

.writer-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 270px;
  flex-shrink: 0;
  overflow: auto;
  padding: 6px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 14px;
  background: rgba(var(--v-theme-surface), 0.7);
}

.writer-list__item {
  padding: 8px 10px;
  border-radius: 10px;
  text-align: left;
  border: 1px solid transparent;
  background: rgba(var(--v-theme-on-surface), 0.03);
}

.writer-list__item:hover {
  background: rgba(var(--v-theme-on-surface), 0.07);
}

.writer-list__item--active {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
}

.writer-list__empty {
  padding: 12px;
}

.writer-editor {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  padding: 10px 14px 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 14px;
  background: rgba(var(--v-theme-surface), 0.7);
}

.writer-editor--empty {
  align-items: center;
  justify-content: center;
}

.writer-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  margin: 4px 0 8px;
  padding: 4px 6px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 10px;
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.writer-page {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 20px 24px;
  border-radius: 12px;
  outline: none;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  font-size: 15px;
  line-height: 1.7;
}

.writer-page:focus {
  border-color: rgba(var(--v-theme-primary), 0.6);
}

.writer-page :deep(h1) {
  font-size: 26px;
  font-weight: 700;
  margin: 0 0 12px;
}

.writer-page :deep(h2) {
  font-size: 20px;
  font-weight: 600;
  margin: 18px 0 10px;
}

.writer-page :deep(p) {
  margin: 0 0 10px;
}

.writer-page :deep(ul),
.writer-page :deep(ol) {
  margin: 0 0 10px;
  padding-left: 24px;
}

.writer-page :deep(ul) {
  list-style: disc;
}

.writer-page :deep(ol) {
  list-style: decimal;
}

.writer-page :deep(blockquote) {
  margin: 0 0 10px;
  padding-left: 14px;
  border-left: 3px solid rgba(var(--v-theme-primary), 0.6);
  color: rgba(var(--v-theme-on-surface), 0.8);
}

.writer-footer {
  display: flex;
  gap: 16px;
  padding-top: 8px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
</style>
