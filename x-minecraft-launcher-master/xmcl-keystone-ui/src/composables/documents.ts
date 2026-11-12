import { ref, watch } from 'vue'

export interface DocumentItem {
  id: string
  title: string
  /** Rich text HTML produced by the editor. */
  html: string
  updatedAt: number
}

const STORAGE_KEY = 'novacraft.documents.v1'

function readDocuments(): DocumentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && typeof item.id === 'string')
      .map((item) => ({
        id: item.id as string,
        title: typeof item.title === 'string' ? item.title : '',
        html: typeof item.html === 'string' ? item.html : '',
        updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
      }))
  } catch {
    return []
  }
}

const documents = ref<DocumentItem[]>(readDocuments())

let saveTimer: ReturnType<typeof setTimeout> | undefined
watch(documents, (value) => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = undefined
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      // Storage full or unavailable: the documents stay in memory for this session.
    }
  }, 250)
}, { deep: true })

function newId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
}

export function useDocuments() {
  function create(title = ''): DocumentItem {
    const document: DocumentItem = { id: newId(), title, html: '', updatedAt: Date.now() }
    documents.value = [document, ...documents.value]
    return document
  }

  function update(id: string, patch: Partial<Pick<DocumentItem, 'title' | 'html'>>) {
    documents.value = documents.value.map((document) => document.id === id
      ? { ...document, ...patch, updatedAt: Date.now() }
      : document)
  }

  function remove(id: string) {
    documents.value = documents.value.filter((document) => document.id !== id)
  }

  return { documents, create, update, remove }
}
