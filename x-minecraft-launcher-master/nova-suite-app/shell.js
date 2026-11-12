import word from './apps/word.js'
import sheets from './apps/sheets.js'
import slides from './apps/slides.js'
import pdf from './apps/pdf.js'
import notes from './apps/notes.js'

const apps = [word, sheets, slides, pdf, notes]

const rail = document.getElementById('rail')
const view = document.getElementById('view')
const nameEl = document.getElementById('app-name')
const taglineEl = document.getElementById('app-tagline')
const statusLeft = document.getElementById('status-left')
const statusRight = document.getElementById('status-right')

let current = null
let currentId = ''

const status = (text) => {
  statusLeft.textContent = text || ''
}

function renderRail(activeId) {
  rail.innerHTML = ''
  const home = document.createElement('button')
  home.className = `rail__home${activeId === 'home' ? ' is-active' : ''}`
  home.innerHTML = '<span class="rail__logo">N</span><span>NovaCraft Suite</span>'
  home.addEventListener('click', () => {
    location.hash = '#home'
  })
  rail.appendChild(home)

  for (const app of apps) {
    const button = document.createElement('button')
    button.className = `rail__item${app.meta.id === activeId ? ' is-active' : ''}`
    button.title = app.meta.tagline
    const badge = document.createElement('span')
    badge.className = 'rail__badge'
    badge.style.background = app.meta.color
    badge.textContent = app.meta.letter
    const label = document.createElement('span')
    label.textContent = app.meta.name.replace('NovaCraft ', '')
    button.append(badge, label)
    button.addEventListener('click', () => {
      location.hash = `#${app.meta.id}`
    })
    rail.appendChild(button)
  }
}

function renderHome() {
  nameEl.textContent = 'NovaCraft Suite'
  taglineEl.textContent = 'Cinq applications, un seul espace de travail'
  status('')
  statusRight.textContent = 'NovaCraft Suite'
  document.title = 'NovaCraft Suite'
  view.innerHTML = `
    <div class="home">
      <h1>NovaCraft Suite</h1>
      <p class="muted">Choisis une application pour commencer.</p>
      <div class="home__grid" id="home-grid"></div>
    </div>`
  const grid = document.getElementById('home-grid')
  for (const app of apps) {
    const card = document.createElement('button')
    card.className = 'home__card'
    const badge = document.createElement('span')
    badge.className = 'home__badge'
    badge.style.background = app.meta.color
    badge.textContent = app.meta.letter
    const text = document.createElement('div')
    const title = document.createElement('div')
    title.className = 'home__name'
    title.textContent = app.meta.name
    const sub = document.createElement('div')
    sub.className = 'muted'
    sub.textContent = app.meta.tagline
    text.append(title, sub)
    card.append(badge, text)
    card.addEventListener('click', () => {
      location.hash = `#${app.meta.id}`
    })
    grid.appendChild(card)
  }
}

function route() {
  const requested = decodeURIComponent(location.hash.replace('#', '')) || 'home'
  const app = apps.find((candidate) => candidate.meta.id === requested)
  const id = app ? app.meta.id : 'home'
  if (id === currentId) return

  if (current && typeof current.destroy === 'function') {
    try {
      current.destroy()
    } catch {
      // A failing teardown must not block navigation.
    }
  }
  current = null
  currentId = id
  renderRail(id)

  if (!app) {
    renderHome()
    return
  }

  nameEl.textContent = app.meta.name
  taglineEl.textContent = app.meta.tagline
  status('')
  statusRight.textContent = app.meta.name
  document.title = app.meta.name
  view.innerHTML = ''
  try {
    current = app.mount(view, { status }) || null
  } catch (error) {
    view.innerHTML = `<p class="empty">Impossible d'ouvrir ${app.meta.name} : ${String(error)}</p>`
  }
}

const initial = new URLSearchParams(location.search).get('app')
if (initial && apps.some((app) => app.meta.id === initial)) {
  location.hash = `#${initial}`
}

window.addEventListener('hashchange', route)
route()
