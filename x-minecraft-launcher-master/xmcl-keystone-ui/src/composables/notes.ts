import { ref, watch } from 'vue'

export interface NoteItem {
  id: string
  title: string
  content: string
  updatedAt: number
}

const STORAGE_KEY = 'novacraft.notes.v1'

function readNotes(): NoteItem[] {
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
        content: typeof item.content === 'string' ? item.content : '',
        updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
      }))
  } catch {
    return []
  }
}

const notes = ref<NoteItem[]>(readNotes())

let saveTimer: ReturnType<typeof setTimeout> | undefined
watch(notes, (value) => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = undefined
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      // Storage full or unavailable: the notes stay in memory for this session.
    }
  }, 250)
}, { deep: true })

function newId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
}

export function useNotes() {
  function create(title = ''): NoteItem {
    const note: NoteItem = { id: newId(), title, content: '', updatedAt: Date.now() }
    notes.value = [note, ...notes.value]
    return note
  }

  function update(id: string, patch: Partial<Pick<NoteItem, 'title' | 'content'>>) {
    notes.value = notes.value.map((note) => note.id === id
      ? { ...note, ...patch, updatedAt: Date.now() }
      : note)
  }

  function remove(id: string) {
    notes.value = notes.value.filter((note) => note.id !== id)
  }

  return { notes, create, update, remove }
}
