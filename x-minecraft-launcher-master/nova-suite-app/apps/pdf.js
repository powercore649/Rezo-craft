import { button, fmtDate } from './util.js'

const meta = {
  id: 'pdf',
  name: 'NovaCraft PDF',
  letter: 'P',
  color: '#c0392b',
  tagline: 'Lecteur PDF',
}

const RECENT_KEY = 'novacraft.pdf.recent'

const loadRecent = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.path === 'string') : []
  } catch {
    return []
  }
}

const saveRecent = (items) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 12)))
  } catch {
    // Recents are a convenience, never a hard failure.
  }
}

export default {
  meta,
  mount(root, ctx) {
    let recent = loadRecent()

    const panel = document.createElement('div')
    panel.className = 'panel'
    const heading = document.createElement('h2')
    heading.textContent = 'Lire un PDF'
    const explain = document.createElement('p')
    explain.className = 'muted'
    explain.textContent = 'Choisis un fichier : il s’ouvre dans sa propre fenêtre, avec le zoom et la recherche du lecteur intégré.'
    const open = button('Ouvrir un PDF', () => void openPdf(), 'btn btn--primary')
    const listTitle = document.createElement('div')
    listTitle.className = 'muted'
    listTitle.textContent = 'Fichiers récents'
    const recentBox = document.createElement('div')
    recentBox.className = 'recent'
    panel.append(heading, explain, open, listTitle, recentBox)
    root.appendChild(panel)

    function renderRecent() {
      recentBox.innerHTML = ''
      if (recent.length === 0) {
        const empty = document.createElement('p')
        empty.className = 'muted'
        empty.textContent = 'Aucun PDF ouvert pour le moment.'
        recentBox.appendChild(empty)
        return
      }
      for (const entry of recent) {
        const row = document.createElement('div')
        row.className = 'recent__item'
        const name = document.createElement('span')
        name.textContent = entry.path.split(/[\\/]/).pop() || entry.path
        const path = document.createElement('span')
        path.className = 'recent__path'
        path.textContent = entry.path
        const when = document.createElement('span')
        when.className = 'muted'
        when.textContent = fmtDate(entry.at)
        const again = button('Ouvrir', () => void window.suite.openPdfFile(entry.path))
        row.append(name, path, when, again)
        recentBox.appendChild(row)
      }
    }

    async function openPdf() {
      const file = await window.suite.openPdf()
      if (!file) return
      recent = [{ path: file, at: Date.now() }, ...recent.filter((item) => item.path !== file)]
      saveRecent(recent)
      renderRecent()
      ctx.status(`Ouvert : ${file}`)
    }

    renderRecent()
    ctx.status('Le PDF s’ouvre dans une fenêtre séparée')

    return {
      destroy() {
        saveRecent(recent)
      },
    }
  },
}
