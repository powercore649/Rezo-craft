import { button, debounce, fmtDate, words } from './util.js'

const meta = {
  id: 'notes',
  name: 'NovaCraft Notes',
  letter: 'N',
  color: '#8e5cff',
  tagline: 'Notes rapides',
}

const KEY = 'novacraft.notes'

const load = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (Array.isArray(parsed) && parsed.length) return parsed
  } catch {
    // Fall through to the starter note.
  }
  return [{
    id: 'welcome',
    title: 'Bienvenue dans NovaCraft Notes',
    body: 'Écris ici : tout est enregistré automatiquement.\n\nAstuce : utilise la recherche à gauche pour retrouver une note.',
    updatedAt: Date.now(),
  }]
}

export default {
  meta,
  mount(root, ctx) {
    let notes = load()
    let activeId = notes[0].id
    let filter = ''

    const wrap = document.createElement('div')
    wrap.className = 'notes'

    const listPanel = document.createElement('div')
    listPanel.className = 'notes__list'
    const search = document.createElement('input')
    search.className = 'field notes__search'
    search.placeholder = 'Rechercher…'
    const items = document.createElement('div')
    items.className = 'notes__items'
    const listActions = document.createElement('div')
    listActions.style.cssText = 'display:flex;gap:6px;padding:0 10px 10px'
    listActions.append(
      button('Nouvelle', () => {
        const note = { id: `note-${Date.now()}`, title: 'Nouvelle note', body: '', updatedAt: Date.now() }
        notes.unshift(note)
        activeId = note.id
        persist()
        render()
        titleInput.focus()
      }, 'btn btn--primary'),
      button('Supprimer', () => {
        if (notes.length <= 1) return
        notes = notes.filter((note) => note.id !== activeId)
        activeId = notes[0].id
        persist()
        render()
      }, 'btn btn--danger'),
    )
    listPanel.append(search, items, listActions)

    const editor = document.createElement('div')
    editor.className = 'notes__editor'
    const titleInput = document.createElement('input')
    titleInput.className = 'notes__title'
    titleInput.placeholder = 'Titre'
    const bodyInput = document.createElement('textarea')
    bodyInput.className = 'notes__body'
    bodyInput.placeholder = 'Écris ta note…'
    const metaLine = document.createElement('div')
    metaLine.className = 'muted'
    editor.append(titleInput, bodyInput, metaLine)

    wrap.append(listPanel, editor)
    root.appendChild(wrap)

    const active = () => notes.find((note) => note.id === activeId)

    function persist() {
      try {
        localStorage.setItem(KEY, JSON.stringify(notes))
      } catch {
        ctx.status('Mémoire locale pleine : la note n’a pas pu être enregistrée')
      }
    }

    function render() {
      items.innerHTML = ''
      const needle = filter.trim().toLowerCase()
      const visible = notes.filter((note) =>
        !needle || note.title.toLowerCase().includes(needle) || note.body.toLowerCase().includes(needle))
      if (visible.length === 0) {
        const empty = document.createElement('p')
        empty.className = 'muted'
        empty.textContent = 'Aucune note.'
        items.appendChild(empty)
      }
      for (const note of visible) {
        const item = document.createElement('button')
        item.className = `note-item${note.id === activeId ? ' is-active' : ''}`
        const title = document.createElement('div')
        title.className = 'note-item__title'
        title.textContent = note.title || 'Sans titre'
        const when = document.createElement('div')
        when.className = 'muted'
        when.textContent = fmtDate(note.updatedAt)
        item.append(title, when)
        item.addEventListener('click', () => {
          flush()
          activeId = note.id
          syncEditor()
          render()
        })
        items.appendChild(item)
      }
      const note = active()
      metaLine.textContent = note
        ? `${words(note.body)} mot(s) · modifié le ${fmtDate(note.updatedAt)}`
        : ''
    }

    function syncEditor() {
      const note = active()
      titleInput.value = note ? note.title : ''
      bodyInput.value = note ? note.body : ''
      ctx.status(note ? `${note.title} — enregistrée automatiquement` : '')
    }

    function flush() {
      const note = active()
      if (!note) return
      note.title = titleInput.value
      note.body = bodyInput.value
      note.updatedAt = Date.now()
      persist()
    }

    const autosave = debounce(() => {
      flush()
      render()
    }, 350)

    titleInput.addEventListener('input', autosave)
    bodyInput.addEventListener('input', autosave)

    search.addEventListener('input', () => {
      filter = search.value
      render()
    })

    const onKey = (event) => {
      if (!event.ctrlKey && !event.metaKey) return
      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        flush()
        render()
        ctx.status('Note enregistrée')
      }
    }
    document.addEventListener('keydown', onKey)

    render()
    syncEditor()

    return {
      destroy() {
        flush()
        document.removeEventListener('keydown', onKey)
      },
    }
  },
}
