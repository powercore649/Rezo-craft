import { button, debounce, docHtml, fileStem, toolbar, words } from './util.js'

const meta = {
  id: 'word',
  name: 'NovaCraft Word',
  letter: 'W',
  color: '#2f6bff',
  tagline: 'Traitement de texte',
}

const DRAFT_KEY = 'novacraft.word.draft'

export default {
  meta,
  mount(root, ctx) {
    const state = { path: null, name: 'sans-titre' }
    const countLabel = document.createElement('span')
    countLabel.className = 'muted'

    const page = document.createElement('div')
    page.className = 'page'
    page.contentEditable = 'true'
    page.spellcheck = true
    page.dataset.placeholder = 'Commence à écrire…'

    const pageArea = document.createElement('div')
    pageArea.className = 'page-area'
    pageArea.appendChild(page)

    const formattingButtons = []

    const formatButton = (label, command, value) => {
      const text = document.createElement('span')
      text.textContent = label
      const node = button(label, () => {
        page.focus()
        document.execCommand(command, false, value)
        refreshStates()
        page.dispatchEvent(new Event('input'))
      })
      node.setAttribute('aria-label', label)
      formattingButtons.push({ node, command })
      return node
    }

    const shade = document.createElement('select')
    shade.className = 'select'
    shade.title = 'Taille du texte'
    for (const size of ['2', '3', '4', '5', '6']) {
      const option = document.createElement('option')
      option.value = size
      option.textContent = ['Petit', 'Normal', 'Moyen', 'Grand', 'Titre'][Number(size) - 2]
      if (size === '3') option.selected = true
      shade.appendChild(option)
    }
    shade.addEventListener('change', () => {
      page.focus()
      document.execCommand('fontSize', false, shade.value)
      page.dispatchEvent(new Event('input'))
    })

    const color = document.createElement('input')
    color.type = 'color'
    color.className = 'field'
    color.value = '#16181d'
    color.title = 'Couleur du texte'
    color.style.width = '40px'
    color.addEventListener('input', () => {
      page.focus()
      document.execCommand('foreColor', false, color.value)
    })

    const nodes = [
      button('Ouvrir', () => void openFile()),
      button('Enregistrer', () => void save(), 'btn btn--primary'),
      button('PDF', () => void exportPdf()),
      'sep',
      button('Annuler', () => run('undo'), 'btn'),
      button('Rétablir', () => run('redo'), 'btn'),
      'sep',
      formatButton('G', 'bold'),
      formatButton('I', 'italic'),
      formatButton('S', 'underline'),
      formatButton('B', 'strikeThrough'),
      'sep',
      shade,
      color,
      'sep',
      formatButton('H1', 'formatBlock', 'h1'),
      formatButton('H2', 'formatBlock', 'h2'),
      formatButton('¶', 'formatBlock', 'p'),
      'sep',
      formatButton('• Liste', 'insertUnorderedList'),
      formatButton('1. Liste', 'insertOrderedList'),
      formatButton('—', 'insertHorizontalRule'),
      'sep',
      formatButton('⯇', 'justifyLeft'),
      formatButton('≡', 'justifyCenter'),
      formatButton('⯈', 'justifyRight'),
      'spacer',
      countLabel,
    ]

    toolbar(root, nodes)
    root.appendChild(pageArea)

    function run(command) {
      page.focus()
      document.execCommand(command, false)
      refreshStates()
      page.dispatchEvent(new Event('input'))
    }

    function refreshStates() {
      for (const { node, command } of formattingButtons) {
        try {
          node.classList.toggle('is-active', document.queryCommandState(command))
        } catch {
          node.classList.remove('is-active')
        }
      }
    }

    function refreshCount() {
      const count = words(page.innerText)
      countLabel.textContent = `${count} mot${count > 1 ? 's' : ''}`
      ctx.status(state.path ? state.path : `${state.name} — brouillon enregistré automatiquement`)
    }

    const persistDraft = debounce(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          html: page.innerHTML,
          name: state.name,
          path: state.path,
          savedAt: Date.now(),
        }))
      } catch {
        // A full quota must not break typing.
      }
    }, 400)

    page.addEventListener('input', () => {
      persistDraft()
      refreshCount()
    })
    page.addEventListener('keyup', refreshStates)
    page.addEventListener('mouseup', refreshStates)

    async function openFile() {
      const file = await window.suite.openText({
        filters: [
          { name: 'Document NovaCraft', extensions: ['ncdoc'] },
          { name: 'HTML', extensions: ['html', 'htm'] },
          { name: 'Texte', extensions: ['txt', 'md'] },
        ],
      })
      if (!file) return
      let html = ''
      const parsed = (() => {
        try {
          return JSON.parse(file.content)
        } catch {
          return null
        }
      })()
      if (parsed && typeof parsed.html === 'string') html = parsed.html
      else if (/<\/?[a-z][\s\S]*>/i.test(file.content)) html = file.content
      else html = file.content.split(/\r?\n/).map((line) => `<p>${line || '<br>'}</p>`).join('')

      page.innerHTML = html
      state.path = file.path
      state.name = fileStem(file.name)
      refreshCount()
    }

    async function save() {
      const payload = JSON.stringify({ app: 'word', version: 1, html: page.innerHTML }, null, 2)
      const saved = await window.suite.saveText({
        defaultName: `${state.name}.ncdoc`,
        content: payload,
        filters: [{ name: 'Document NovaCraft', extensions: ['ncdoc'] }],
      })
      if (saved) {
        state.path = saved
        state.name = fileStem(saved.split(/[\\/]/).pop() || state.name)
        persistDraft()
        refreshCount()
        ctx.status(`Enregistré : ${saved}`)
      }
    }

    async function exportPdf() {
      const target = await window.suite.exportPdf({
        html: docHtml(state.name, page.innerHTML),
        defaultName: `${state.name}.pdf`,
      })
      if (target) ctx.status(`PDF créé : ${target}`)
    }

    const onKey = (event) => {
      if (!event.ctrlKey && !event.metaKey) return
      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        void save()
      } else if (key === 'o') {
        event.preventDefault()
        void openFile()
      } else if (key === 'p') {
        event.preventDefault()
        void exportPdf()
      }
    }
    document.addEventListener('keydown', onKey)
    document.execCommand('styleWithCSS', false, 'true')

    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
      if (draft && typeof draft.html === 'string') {
        page.innerHTML = draft.html
        state.name = draft.name || state.name
        state.path = draft.path || null
      }
    } catch {
      // A corrupt draft is simply ignored.
    }
    refreshCount()
    page.focus()

    return {
      destroy() {
        document.removeEventListener('keydown', onKey)
      },
    }
  },
}
