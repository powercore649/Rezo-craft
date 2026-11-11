import { icon } from './icons.js'

const $ = (selector) => document.querySelector(selector)

const el = {
  tabTitle: $('#tab-title'),
  tabIcon: $('#tab-icon'),
  crumbs: $('#crumbs'),
  search: $('#search'),
  list: $('#list'),
  head: $('#head'),
  side: $('#side'),
  status: $('#status'),
  selectAll: $('#select-all'),
  details: $('#details'),
  detailsBody: $('#details-body'),
  menu: $('#menu'),
  overlay: $('#overlay'),
  winMax: $('#win-max'),
}

const state = {
  path: '',
  parent: '',
  entries: [],
  history: [],
  cursor: -1,
  sort: { key: 'mtime', dir: -1 },
  filter: '',
  selected: new Set(),
  collapsed: new Set(),
  roots: { nav: [], places: [], pinned: [], drives: [] },
}

const esc = (value) =>
  String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]))

const fmtDate = (value) => {
  const date = new Date(value)
  const pad = (number) => String(number).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const fmtSize = (bytes) => {
  const ko = Math.round(bytes / 1024)
  return `${ko.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} Ko`
}

const KINDS = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico'],
  audio: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'],
  video: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'xz', 'jar'],
  pdf: ['pdf'],
  office: ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods'],
  text: ['txt', 'md', 'log', 'yml', 'yaml', 'json', 'xml', 'toml', 'ini', 'cfg', 'html', 'htm', 'css', 'js', 'ts', 'sh', 'bat', 'ps1'],
}

const kindOf = (ext) => Object.entries(KINDS).find(([, list]) => list.includes(ext))?.[0] || ''

const typeLabel = (entry) => {
  if (entry.isDir) return 'Dossier de fichiers'
  const kind = kindOf(entry.ext)
  if (kind === 'archive') return 'Dossier compressé'
  if (entry.ext === 'exe' || entry.ext === 'msi') return 'Application'
  if (kind === 'image') return `Fichier ${entry.ext.toUpperCase()}`
  if (kind === 'video') return `Fichier ${entry.ext.toUpperCase()}`
  if (kind === 'audio') return `Fichier audio ${entry.ext.toUpperCase()}`
  if (kind === 'pdf') return 'Document PDF'
  if (entry.ext === 'doc' || entry.ext === 'docx') return 'Document Microsoft Word'
  if (entry.ext === 'ppt' || entry.ext === 'pptx') return 'Présentation Microsoft PowerPoint'
  if (entry.ext === 'xls' || entry.ext === 'xlsx') return 'Feuille de calcul Microsoft Excel'
  if (entry.ext === 'txt' || entry.ext === 'md') return 'Document texte'
  if (entry.ext === 'yml' || entry.ext === 'yaml') return 'Fichier YML'
  if (entry.ext === 'json') return 'Fichier JSON'
  if (kind === 'text') return `Fichier ${entry.ext.toUpperCase()}`
  return entry.ext ? `Fichier ${entry.ext.toUpperCase()}` : 'Fichier'
}

const slug = (entry) => {
  if (entry.isDir) return 'folder'
  const kind = kindOf(entry.ext)
  if (kind) return kind
  if (entry.ext === 'exe' || entry.ext === 'msi') return 'exe'
  return 'file'
}

const badge = (entry) => {
  if (entry.isDir) {
    return `<span class="row__icon type-icon--folder">${icon('folder', 22)}</span>`
  }
  const kind = slug(entry)
  const label = (entry.ext || '??').slice(0, 3).toUpperCase()
  return `<span class="row__icon"><span class="type-icon type-icon--${kind}">${esc(label)}</span></span>`
}

function groupOf(entry, now) {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const weekStart = new Date(today)
  const day = (today.getDay() + 6) % 7
  weekStart.setDate(today.getDate() - day)
  const lastWeek = new Date(weekStart)
  lastWeek.setDate(weekStart.getDate() - 7)
  if (entry.mtime >= today.getTime()) return "Aujourd'hui"
  if (entry.mtime >= yesterday.getTime()) return 'Hier'
  if (entry.mtime >= weekStart.getTime()) return 'Plus tôt cette semaine'
  if (entry.mtime >= lastWeek.getTime()) return 'Semaine dernière'
  return 'Plus ancien'
}

const GROUP_ORDER = ["Aujourd'hui", 'Hier', 'Plus tôt cette semaine', 'Semaine dernière', 'Plus ancien']

function visibleEntries() {
  const needle = state.filter.trim().toLowerCase()
  const filtered = needle
    ? state.entries.filter((entry) => entry.name.toLowerCase().includes(needle))
    : state.entries.slice()
  const { key, dir } = state.sort
  filtered.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    let result = 0
    if (key === 'name') result = a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
    else if (key === 'mtime') result = a.mtime - b.mtime
    else if (key === 'size') result = a.size - b.size
    else result = typeLabel(a).localeCompare(typeLabel(b), 'fr')
    return result * dir
  })
  return filtered
}

function selectionInfo() {
  const visible = visibleEntries()
  const selected = visible.filter((entry) => state.selected.has(entry.path))
  return { visible, selected }
}

function updateStatus() {
  const { visible, selected } = selectionInfo()
  const count = visible.length
  const base = `${count} élément${count > 1 ? 's' : ''}`
  el.status.textContent = selected.length ? `${selected.length} sur ${base} sélectionné${selected.length > 1 ? 's' : ''}` : base
  el.selectAll.checked = count > 0 && selected.length === count
  el.selectAll.indeterminate = selected.length > 0 && selected.length < count
}

function renderCrumbs() {
  el.crumbs.innerHTML = ''
  const separator = state.path.includes('\\') ? '\\' : '/'
  const root = state.path.startsWith('\\\\')
    ? state.path.split(separator).slice(0, 4).join(separator)
    : `${state.path.split(separator)[0]}${separator}`
  const parts = [{ label: root.replace(/[\\/]+$/, '') || root, path: root }]
  let current = root
  for (const segment of state.path.slice(root.length).split(separator).filter(Boolean)) {
    current = current.endsWith(separator) ? current + segment : `${current}${separator}${segment}`
    parts.push({ label: segment, path: current })
  }
  parts.forEach((part, index) => {
    if (index > 0) {
      const chevron = document.createElement('span')
      chevron.className = 'crumb__sep'
      chevron.innerHTML = icon('chevronRight', 12)
      el.crumbs.appendChild(chevron)
    }
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'crumb'
    button.textContent = part.label
    button.title = part.path
    button.addEventListener('click', () => void go(part.path))
    el.crumbs.appendChild(button)
  })
  const chevron = document.createElement('span')
  chevron.className = 'crumb__sep'
  chevron.innerHTML = icon('chevronRight', 12)
  el.crumbs.appendChild(chevron)
}

function renderSidebar() {
  el.side.innerHTML = ''
  const add = (item, options = {}) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `side__item${options.active ? ' is-active' : ''}${options.tree ? ' side__item--tree' : ''}`
    button.title = item.path || item.label
    const iconHtml = options.pin
      ? icon('pin', 13)
      : icon(item.icon === 'folder' ? 'folder' : item.icon, 17)
    button.innerHTML = `<span class="side__icon${item.icon === 'folder' ? ' side__icon--folder' : ''}">${iconHtml}</span><span class="side__label">${esc(item.label)}</span>${options.pin ? '' : ''}`
    if (item.path) {
      button.addEventListener('click', () => {
        if (options.action) options.action()
        else void go(item.path)
      })
    } else if (options.action) {
      button.addEventListener('click', options.action)
    }
    el.side.appendChild(button)
  }

  for (const item of state.roots.nav) add(item, { active: item.path === state.path })
  const sep = document.createElement('div')
  sep.className = 'side__sep'
  el.side.appendChild(sep)
  for (const item of state.roots.places) {
    add(item, { active: item.path === state.path, pin: false })
  }
  if (state.roots.pinned.length) {
    const sep2 = document.createElement('div')
    sep2.className = 'side__sep'
    el.side.appendChild(sep2)
    for (const item of state.roots.pinned) add(item, { active: item.path === state.path, tree: true })
  }
  const sep3 = document.createElement('div')
  sep3.className = 'side__sep'
  el.side.appendChild(sep3)
  const group = document.createElement('div')
  group.className = 'side__group'
  group.textContent = 'Ce PC'
  el.side.appendChild(group)
  for (const drive of state.roots.drives) add(drive, { active: drive.path === state.path, tree: true })

  const trash = document.createElement('button')
  trash.type = 'button'
  trash.className = 'side__item'
  trash.innerHTML = `<span class="side__icon">${icon('trash', 17)}</span><span class="side__label">Corbeille</span>`
  trash.addEventListener('click', () => void window.files.recycleBin())
  el.side.appendChild(trash)

  const network = document.createElement('button')
  network.type = 'button'
  network.className = 'side__item'
  network.innerHTML = `<span class="side__icon">${icon('network', 17)}</span><span class="side__label">Réseau</span>`
  network.addEventListener('click', () => void window.files.network())
  el.side.appendChild(network)
}

function renderList() {
  const { visible, selected } = selectionInfo()
  el.list.innerHTML = ''
  if (!visible.length) {
    const empty = document.createElement('div')
    empty.className = 'empty'
    empty.textContent = state.filter ? 'Aucun résultat.' : 'Ce dossier est vide.'
    el.list.appendChild(empty)
    updateStatus()
    return
  }
  const now = Date.now()
  const groups = new Map()
  for (const entry of visible) {
    const key = groupOf(entry, now)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(entry)
  }
  for (const name of GROUP_ORDER) {
    const items = groups.get(name)
    if (!items) continue
    const collapsed = state.collapsed.has(name)
    const head = document.createElement('button')
    head.type = 'button'
    head.className = 'group__head'
    head.innerHTML = `<span class="group__chevron">${icon(collapsed ? 'chevronRight' : 'chevronDown', 12)}</span>${esc(name)}`
    head.addEventListener('click', () => {
      if (collapsed) state.collapsed.delete(name)
      else state.collapsed.add(name)
      renderList()
    })
    el.list.appendChild(head)
    if (collapsed) continue
    for (const entry of items) {
      const row = document.createElement('div')
      row.className = `row${selected.some((item) => item.path === entry.path) ? ' is-selected' : ''}`
      row.dataset.path = entry.path
      row.innerHTML = `
        <label class="row__check"><input type="checkbox" ${state.selected.has(entry.path) ? 'checked' : ''} aria-label="Sélectionner ${esc(entry.name)}"></label>
        <span class="row__name">${badge(entry)}<span class="row__label">${esc(entry.name)}</span></span>
        <span class="row__cell">${entry.isDir ? '' : fmtDate(entry.mtime)}</span>
        <span class="row__cell">${esc(typeLabel(entry))}</span>
        <span class="row__cell row__cell--right">${entry.isDir ? '' : fmtSize(entry.size)}</span>`
      row.querySelector('input').addEventListener('click', (event) => {
        event.stopPropagation()
        toggleSelect(entry, true)
      })
      row.addEventListener('click', (event) => select(entry, event.ctrlKey || event.metaKey || event.shiftKey))
      row.addEventListener('dblclick', () => void openEntry(entry))
      row.addEventListener('contextmenu', (event) => {
        event.preventDefault()
        if (!state.selected.has(entry.path)) select(entry, false)
        openContextMenu(event.clientX, event.clientY)
      })
      el.list.appendChild(row)
    }
  }
  updateStatus()
}

function select(entry, additive) {
  if (!additive) state.selected.clear()
  if (additive && state.selected.has(entry.path)) state.selected.delete(entry.path)
  else state.selected.add(entry.path)
  renderList()
  renderDetails()
}

function toggleSelect(entry, checked) {
  if (checked) state.selected.add(entry.path)
  else state.selected.delete(entry.path)
  renderList()
  renderDetails()
}

function selectedEntries() {
  return visibleEntries().filter((entry) => state.selected.has(entry.path))
}

function renderDetails() {
  if (el.details.hidden) return
  const entries = selectedEntries()
  if (entries.length !== 1) {
    el.detailsBody.innerHTML = `<p>${entries.length ? `${entries.length} éléments sélectionnés` : 'Sélectionne un fichier pour voir ses détails.'}</p>`
    return
  }
  const entry = entries[0]
  void window.files.info(entry.path).then((info) => {
    el.detailsBody.innerHTML = `
      <div class="details__preview">${entry.isDir ? icon('folder', 44) : (entry.ext || '').slice(0, 3).toUpperCase()}</div>
      <div class="details__name">${esc(info.name)}</div>
      <div class="details__row"><span>Type</span><span>${esc(typeLabel(entry))}</span></div>
      <div class="details__row"><span>Taille</span><span>${entry.isDir ? '—' : fmtSize(info.size)}</span></div>
      <div class="details__row"><span>Modifié le</span><span>${fmtDate(info.mtime)}</span></div>
      <div class="details__row"><span>Créé le</span><span>${fmtDate(info.created)}</span></div>
      <div class="details__row"><span>Emplacement</span><span>${esc(entry.path)}</span></div>`
  })
}

function renderHead() {
  for (const button of el.head.querySelectorAll('.head__col')) {
    button.classList.toggle('is-sorted', button.dataset.sort === state.sort.key)
    button.dataset.dir = button.dataset.sort === state.sort.key ? String(state.sort.dir) : ''
  }
}

async function go(target, remember = true) {
  if (!target) return
  try {
    const listing = await window.files.list(target)
    state.path = listing.path
    state.parent = listing.parent
    state.entries = listing.entries
    state.selected.clear()
    state.filter = ''
    el.search.value = ''
    if (remember) {
      state.history = state.history.slice(0, state.cursor + 1)
      state.history.push(state.path)
      state.cursor = state.history.length - 1
    }
    try {
      localStorage.setItem('novacraft.files.last', state.path)
    } catch {
      // Storage is optional.
    }
    el.tabTitle.textContent = listing.name
    el.tabIcon.innerHTML = icon('folder', 15)
    el.search.placeholder = `Rechercher dans : ${listing.name}`
    document.title = `${listing.name} — NovaCraft Fichiers`
    renderCrumbs()
    renderSidebar()
    renderHead()
    renderList()
    renderDetails()
  } catch (error) {
    el.status.textContent = `Dossier inaccessible : ${error && error.message ? error.message : error}`
  }
}

function travel(step) {
  const next = state.cursor + step
  if (next < 0 || next >= state.history.length) return
  state.cursor = next
  void go(state.history[next], false)
}

async function openEntry(entry) {
  if (entry.isDir) {
    await go(entry.path)
    return
  }
  const error = await window.files.open(entry.path)
  el.status.textContent = error ? `Impossible d’ouvrir : ${error}` : `Ouvert : ${entry.name}`
}

function closeMenu() {
  el.menu.hidden = true
  el.menu.innerHTML = ''
}

function showMenu(x, y, items) {
  el.menu.innerHTML = ''
  for (const item of items) {
    if (item === 'sep') {
      const sep = document.createElement('div')
      sep.className = 'menu__sep'
      el.menu.appendChild(sep)
      continue
    }
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `menu__item${item.checked ? ' is-checked' : ''}${item.disabled ? ' is-disabled' : ''}`
    button.textContent = item.label
    if (!item.disabled) {
      button.addEventListener('click', () => {
        closeMenu()
        void item.action()
      })
    }
    el.menu.appendChild(button)
  }
  el.menu.hidden = false
  const rect = el.menu.getBoundingClientRect()
  el.menu.style.left = `${Math.min(x, window.innerWidth - rect.width - 8)}px`
  el.menu.style.top = `${Math.min(y, window.innerHeight - rect.height - 8)}px`
}

function openContextMenu(x, y) {
  const entries = selectedEntries()
  showMenu(x, y, [
    { label: 'Ouvrir', action: () => (entries.length === 1 ? openEntry(entries[0]) : Promise.resolve()) },
    { label: 'Afficher dans l’Explorateur', action: () => window.files.reveal(entries[0].path) },
    'sep',
    { label: 'Copier', action: () => copySelection('copy') },
    { label: 'Couper', action: () => copySelection('cut') },
    { label: 'Coller', action: () => paste() },
    'sep',
    { label: 'Renommer', action: () => renameEntry(entries[0]) },
    { label: 'Supprimer', action: () => deleteSelection() },
    'sep',
    { label: 'Propriétés', action: () => showDetails() },
  ])
}

async function copySelection(mode) {
  const paths = selectedEntries().map((entry) => entry.path)
  if (!paths.length) return
  await window.files.clipboard(mode, paths)
  el.status.textContent = `${paths.length} élément${paths.length > 1 ? 's' : ''} ${mode === 'cut' ? 'coupé' : 'copié'}${paths.length > 1 ? 's' : ''}`
}

async function paste() {
  const count = await window.files.paste(state.path)
  if (count) {
    await go(state.path, false)
    el.status.textContent = `${count} élément${count > 1 ? 's' : ''} collé${count > 1 ? 's' : ''}`
  }
}

function askName(title, initial, confirmLabel) {
  return new Promise((resolve) => {
    el.overlay.hidden = false
    el.overlay.innerHTML = ''
    const dialog = document.createElement('div')
    dialog.className = 'dialog'
    dialog.innerHTML = `<div class="dialog__title">${esc(title)}</div>
      <input class="dialog__input" value="${esc(initial)}" spellcheck="false">
      <div class="dialog__actions">
        <button class="dialog__btn" data-cancel>Annuler</button>
        <button class="dialog__btn dialog__btn--primary" data-ok>${esc(confirmLabel || 'Valider')}</button>
      </div>`
    el.overlay.appendChild(dialog)
    const input = dialog.querySelector('input')
    const close = (value) => {
      el.overlay.hidden = true
      el.overlay.innerHTML = ''
      resolve(value)
    }
    dialog.querySelector('[data-cancel]').addEventListener('click', () => close(null))
    dialog.querySelector('[data-ok]').addEventListener('click', () => close(input.value.trim() || null))
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') close(input.value.trim() || null)
      if (event.key === 'Escape') close(null)
    })
    el.overlay.addEventListener('mousedown', (event) => {
      if (event.target === el.overlay) close(null)
    })
    input.focus()
    input.select()
  })
}

function askConfirm(title, message, confirmLabel) {
  return new Promise((resolve) => {
    el.overlay.hidden = false
    el.overlay.innerHTML = ''
    const dialog = document.createElement('div')
    dialog.className = 'dialog'
    dialog.innerHTML = `<div class="dialog__title">${esc(title)}</div>
      <div class="dialog__text">${esc(message)}</div>
      <div class="dialog__actions">
        <button class="dialog__btn" data-cancel>Annuler</button>
        <button class="dialog__btn dialog__btn--primary" data-ok>${esc(confirmLabel || 'Confirmer')}</button>
      </div>`
    el.overlay.appendChild(dialog)
    const close = (value) => {
      el.overlay.hidden = true
      el.overlay.innerHTML = ''
      resolve(value)
    }
    dialog.querySelector('[data-cancel]').addEventListener('click', () => close(false))
    dialog.querySelector('[data-ok]').addEventListener('click', () => close(true))
    el.overlay.addEventListener('mousedown', (event) => {
      if (event.target === el.overlay) close(false)
    })
  })
}

async function createFolder() {
  const name = await askName('Nouveau dossier', 'Nouveau dossier', 'Créer')
  if (!name) return
  try {
    await window.files.mkdir(state.path, name)
    await go(state.path, false)
    el.status.textContent = `Dossier créé : ${name}`
  } catch (error) {
    el.status.textContent = `Création impossible : ${error && error.message ? error.message : error}`
  }
}

async function createTextFile() {
  const name = await askName('Nouveau document texte', 'Nouveau document texte.txt', 'Créer')
  if (!name) return
  try {
    await window.files.newFile(state.path, name)
    await go(state.path, false)
    el.status.textContent = `Fichier créé : ${name}`
  } catch (error) {
    el.status.textContent = `Création impossible : ${error && error.message ? error.message : error}`
  }
}

async function renameEntry(entry) {
  const name = await askName('Renommer', entry.name, 'Renommer')
  if (!name || name === entry.name) return
  try {
    await window.files.rename(entry.path, name)
    await go(state.path, false)
    el.status.textContent = `Renommé en ${name}`
  } catch (error) {
    el.status.textContent = `Renommage impossible : ${error && error.message ? error.message : error}`
  }
}

async function deleteSelection() {
  const entries = selectedEntries()
  if (!entries.length) return
  const ok = await askConfirm(
    'Supprimer',
    entries.length === 1 ? `« ${entries[0].name} » sera placé dans la corbeille.` : `${entries.length} éléments seront placés dans la corbeille.`,
    'Supprimer',
  )
  if (!ok) return
  try {
    await window.files.trash(entries.map((entry) => entry.path))
    await go(state.path, false)
    el.status.textContent = `${entries.length} élément${entries.length > 1 ? 's' : ''} supprimé${entries.length > 1 ? 's' : ''}`
  } catch (error) {
    el.status.textContent = `Suppression impossible : ${error && error.message ? error.message : error}`
  }
}

function showDetails() {
  el.details.hidden = false
  renderDetails()
}

function wireToolbar() {
  const ids = {
    'nav-back': 'back',
    'nav-forward': 'forward',
    'nav-up': 'up',
    'nav-refresh': 'refresh',
  }
  for (const [id, name] of Object.entries(ids)) {
    document.getElementById(id).innerHTML = icon(name, 16)
  }
  document.getElementById('search-icon').innerHTML = icon('search', 15)
  document.getElementById('cmd-new-icon').innerHTML = icon('new', 15)
  document.getElementById('cmd-new-chevron').innerHTML = icon('chevronDown', 12)
  document.getElementById('cmd-sort-icon').innerHTML = icon('sort', 15)
  document.getElementById('cmd-sort-chevron').innerHTML = icon('chevronDown', 12)
  document.getElementById('cmd-view-icon').innerHTML = icon('view', 15)
  document.getElementById('cmd-view-chevron').innerHTML = icon('chevronDown', 12)
  document.getElementById('cmd-details-icon').innerHTML = icon('details', 15)
  document.getElementById('cmd-more').innerHTML = icon('more', 16)
  document.getElementById('win-min').innerHTML = ''
  document.getElementById('win-max').innerHTML = ''
  document.getElementById('win-close').innerHTML = ''
  document.getElementById('cmd-cut').innerHTML = icon('cut', 16)
  document.getElementById('cmd-copy').innerHTML = icon('copy', 16)
  document.getElementById('cmd-paste').innerHTML = icon('paste', 16)
  document.getElementById('cmd-rename').innerHTML = icon('rename', 16)
  document.getElementById('cmd-delete').innerHTML = icon('trash', 16)

  document.getElementById('nav-back').addEventListener('click', () => travel(-1))
  document.getElementById('nav-forward').addEventListener('click', () => travel(1))
  document.getElementById('nav-up').addEventListener('click', () => go(state.parent))
  document.getElementById('nav-refresh').addEventListener('click', () => go(state.path, false))

  document.getElementById('cmd-new').addEventListener('click', (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    showMenu(rect.left, rect.bottom + 4, [
      { label: 'Dossier', action: createFolder },
      { label: 'Document texte', action: createTextFile },
    ])
  })
  document.getElementById('cmd-cut').addEventListener('click', () => copySelection('cut'))
  document.getElementById('cmd-copy').addEventListener('click', () => copySelection('copy'))
  document.getElementById('cmd-paste').addEventListener('click', () => paste())
  document.getElementById('cmd-rename').addEventListener('click', () => {
    const entries = selectedEntries()
    if (entries.length === 1) void renameEntry(entries[0])
  })
  document.getElementById('cmd-delete').addEventListener('click', () => deleteSelection())

  document.getElementById('cmd-sort').addEventListener('click', (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const key = state.sort.key
    const dir = state.sort.dir
    showMenu(rect.left, rect.bottom + 4, [
      { label: 'Nom', checked: key === 'name', action: () => setSort('name') },
      { label: 'Date de modification', checked: key === 'mtime', action: () => setSort('mtime') },
      { label: 'Type', checked: key === 'type', action: () => setSort('type') },
      { label: 'Taille', checked: key === 'size', action: () => setSort('size') },
      'sep',
      { label: 'Croissant', checked: dir === 1, action: () => { state.sort.dir = 1; renderHead(); renderList() } },
      { label: 'Décroissant', checked: dir === -1, action: () => { state.sort.dir = -1; renderHead(); renderList() } },
    ])
  })

  document.getElementById('cmd-view').addEventListener('click', (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    showMenu(rect.left, rect.bottom + 4, [
      { label: 'Détails', checked: true, action: () => undefined },
      { label: 'Compact', action: () => { el.list.style.fontSize = '11.5px' } },
      'sep',
      { label: 'Afficher les détails', action: showDetails },
    ])
  })

  document.getElementById('cmd-more').addEventListener('click', (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    showMenu(rect.left - 160, rect.bottom + 4, [
      { label: 'Actualiser', action: () => go(state.path, false) },
      { label: 'Tout sélectionner', action: () => {
        state.selected = new Set(visibleEntries().map((entry) => entry.path))
        renderList()
      } },
      { label: 'Coller', action: paste },
      { label: 'Ouvrir dans l’Explorateur', action: () => window.files.reveal(state.path) },
    ])
  })

  document.getElementById('cmd-details').addEventListener('click', () => {
    el.details.hidden = !el.details.hidden
    renderDetails()
  })
  document.getElementById('details-close').addEventListener('click', () => {
    el.details.hidden = true
  })

  el.head.querySelectorAll('.head__col').forEach((button) => {
    button.addEventListener('click', () => setSort(button.dataset.sort))
  })

  el.selectAll.addEventListener('change', () => {
    if (el.selectAll.checked) state.selected = new Set(visibleEntries().map((entry) => entry.path))
    else state.selected.clear()
    renderList()
  })

  el.search.addEventListener('input', () => {
    state.filter = el.search.value
    renderList()
  })

  document.getElementById('win-min').addEventListener('click', () => window.files.minimize())
  document.getElementById('win-max').addEventListener('click', () => window.files.toggleMaximize())
  document.getElementById('win-close').addEventListener('click', () => window.files.close())
  document.getElementById('tab-close').addEventListener('click', () => window.files.close())
  document.getElementById('tab-add').addEventListener('click', () => go(state.roots.home || state.path))

  window.files.onMaximized((maximized) => {
    el.winMax.classList.toggle('is-restored', maximized)
  })
}

function setSort(key) {
  state.sort = { key, dir: state.sort.key === key ? -state.sort.dir : 1 }
  renderHead()
  renderList()
}

function wireKeyboard() {
  document.addEventListener('keydown', (event) => {
    const typing = event.target instanceof HTMLInputElement
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
      event.preventDefault()
      void askName('Aller à', state.path, 'Ouvrir').then((value) => value && go(value))
      return
    }
    if (typing) return
    if (event.key === 'F5') {
      event.preventDefault()
      void go(state.path, false)
    } else if (event.key === 'Backspace') {
      if (!state.parent) return
      event.preventDefault()
      void go(state.parent)
    } else if (event.key === 'Enter') {
      const entries = selectedEntries()
      if (entries.length === 1) {
        event.preventDefault()
        void openEntry(entries[0])
      }
    } else if (event.key === 'F2') {
      const entries = selectedEntries()
      if (entries.length === 1) {
        event.preventDefault()
        void renameEntry(entries[0])
      }
    } else if (event.key === 'Delete') {
      event.preventDefault()
      void deleteSelection()
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault()
      state.selected = new Set(visibleEntries().map((entry) => entry.path))
      renderList()
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
      void copySelection('copy')
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'x') {
      void copySelection('cut')
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
      void paste()
    } else if (event.key === 'Escape') {
      closeMenu()
    }
  })
  document.addEventListener('click', (event) => {
    if (!el.menu.hidden && !el.menu.contains(event.target)) closeMenu()
  })
}

async function init() {
  wireToolbar()
  wireKeyboard()
  try {
    state.roots = await window.files.roots()
  } catch {
    state.roots = { nav: [], places: [], pinned: [], drives: [], home: '' }
  }
  let start = ''
  try {
    start = localStorage.getItem('novacraft.files.last') || ''
  } catch {
    start = ''
  }
  if (!start) start = state.roots.places.find((item) => item.icon === 'downloads')?.path || state.roots.home || ''
  renderSidebar()
  await go(start)
}

void init()
