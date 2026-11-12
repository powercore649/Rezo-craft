import { icon } from './icons.js'

const KEY = 'novacraft.files.settings'
const DEFAULTS = {
  theme: 'dark',
  accent: 'blue',
  density: 'normal',
  font: 'normal',
  extensions: true,
  sidebar: true,
  detailsDefault: false,
}

export const settings = { ...DEFAULTS }

const esc = (value) =>
  String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]))

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) Object.assign(settings, JSON.parse(raw))
  } catch {
    // Ignore unreadable settings.
  }
}

function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // Storage is optional.
  }
}

export function applySettings() {
  document.body.dataset.theme = settings.theme
  document.body.dataset.accent = settings.accent
  document.body.dataset.density = settings.density
  document.body.dataset.font = settings.font
  document.body.classList.toggle('side-hidden', !settings.sidebar)
}

export function displayName(entry) {
  if (settings.extensions || entry.isDir || !entry.ext) return entry.name
  return entry.name.slice(0, -(entry.ext.length + 1)) || entry.name
}

const DOCS = [
  {
    title: 'Naviguer',
    items: [
      'Précédent, Suivant, Dossier parent et Actualiser sont dans la barre de navigation.',
      'Clique sur un segment du fil d’Ariane pour remonter à ce dossier.',
      'Double-clique sur un dossier pour l’ouvrir, sur un fichier pour l’ouvrir avec l’application associée de Windows.',
      'Ctrl+L ouvre une boîte « Aller à » pour saisir un chemin complet.',
    ],
  },
  {
    title: 'Agir sur les fichiers',
    items: [
      'Nouveau crée un dossier ou un document texte vide.',
      'Couper, copier et coller agissent sur la sélection ; coller dépose dans le dossier courant.',
      'Renommer (F2) et Supprimer envoient l’élément vers la corbeille système, après confirmation.',
      'Le menu contextuel reprend ces actions et ajoute « Afficher dans l’Explorateur » et « Propriétés ».',
    ],
  },
  {
    title: 'Rechercher et trier',
    items: [
      'Le champ de recherche filtre le dossier courant au fil de la frappe.',
      'Les en-têtes Nom, Modifié le, Type et Taille trient la liste ; un second clic inverse l’ordre.',
      'Le bouton Trier propose les mêmes choix depuis la barre de commandes.',
      'Les fichiers sont groupés par date ; clique sur un en-tête de groupe pour le replier.',
    ],
  },
  {
    title: 'Personnaliser',
    items: [
      'L’icône engrenage ouvre le panneau Personnalisation.',
      'Thème sombre ou clair, couleur d’accent, densité des lignes et taille du texte s’appliquent immédiatement.',
      'Tu peux masquer la barre latérale, masquer les extensions de fichiers et ouvrir le panneau Détails au démarrage.',
      '« Réinitialiser les réglages » revient à l’apparence d’origine ; les choix restent enregistrés sur cet ordinateur.',
    ],
  },
  {
    title: 'Raccourcis clavier',
    shortcuts: [
      ['F5', 'Actualiser le dossier'],
      ['Retour arrière', 'Dossier parent'],
      ['Entrée', 'Ouvrir la sélection'],
      ['F2', 'Renommer'],
      ['Suppr', 'Mettre à la corbeille'],
      ['Ctrl+A', 'Tout sélectionner'],
      ['Ctrl+C / X / V', 'Copier / couper / coller'],
      ['Ctrl+L', 'Aller à un chemin'],
      ['Échap', 'Fermer un menu ou un panneau'],
    ],
  },
  {
    title: 'Dépannage',
    items: [
      'Un dossier inaccessible affiche un message dans la barre d’état : vérifie les droits d’accès.',
      'Corbeille et Réseau ouvrent les dossiers système de Windows.',
      'Les réglages sont stockés localement ; effacer les données de l’application les remet à zéro.',
    ],
  },
]

function buildOptionRow(label, key, options, onChange) {
  const row = document.createElement('div')
  row.className = 'setting'
  const title = document.createElement('div')
  title.className = 'setting__label'
  title.textContent = label
  row.appendChild(title)
  const group = document.createElement('div')
  group.className = 'setting__options'
  for (const option of options) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'setting__option' + (settings[key] === option.value ? ' is-active' : '')
    button.textContent = option.label
    button.addEventListener('click', () => {
      settings[key] = option.value
      saveSettings()
      applySettings()
      onChange()
    })
    group.appendChild(button)
  }
  row.appendChild(group)
  return row
}

function buildSwitchRow(label, key, onChange) {
  const row = document.createElement('div')
  row.className = 'setting setting--switch'
  const title = document.createElement('div')
  title.className = 'setting__label'
  title.textContent = label
  row.appendChild(title)
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'switch' + (settings[key] ? ' is-on' : '')
  button.setAttribute('role', 'switch')
  button.setAttribute('aria-checked', String(Boolean(settings[key])))
  button.innerHTML = '<span class="switch__knob"></span>'
  button.addEventListener('click', () => {
    settings[key] = !settings[key]
    saveSettings()
    applySettings()
    onChange()
  })
  row.appendChild(button)
  return row
}

export function initSettingsUi(el, onChange) {
  const renderSettings = () => {
    if (!el.settingsBody) return
    el.settingsBody.innerHTML = ''
    const refresh = () => {
      applySettings()
      renderSettings()
      onChange()
    }
    el.settingsBody.appendChild(buildOptionRow('Thème', 'theme', [
      { value: 'dark', label: 'Sombre' },
      { value: 'light', label: 'Clair' },
    ], refresh))
    el.settingsBody.appendChild(buildOptionRow('Couleur d’accent', 'accent', [
      { value: 'blue', label: 'Bleu' },
      { value: 'violet', label: 'Violet' },
      { value: 'green', label: 'Vert' },
      { value: 'orange', label: 'Orange' },
    ], refresh))
    el.settingsBody.appendChild(buildOptionRow('Densité des lignes', 'density', [
      { value: 'compact', label: 'Compacte' },
      { value: 'normal', label: 'Normale' },
      { value: 'comfortable', label: 'Confortable' },
    ], refresh))
    el.settingsBody.appendChild(buildOptionRow('Taille du texte', 'font', [
      { value: 'small', label: 'Petite' },
      { value: 'normal', label: 'Normale' },
      { value: 'large', label: 'Grande' },
    ], refresh))
    el.settingsBody.appendChild(buildSwitchRow('Afficher les extensions de fichiers', 'extensions', refresh))
    el.settingsBody.appendChild(buildSwitchRow('Afficher la barre latérale', 'sidebar', refresh))
    el.settingsBody.appendChild(buildSwitchRow('Ouvrir le panneau Détails au démarrage', 'detailsDefault', refresh))

    const reset = document.createElement('button')
    reset.type = 'button'
    reset.className = 'setting__reset'
    reset.textContent = 'Réinitialiser les réglages'
    reset.addEventListener('click', () => {
      Object.assign(settings, DEFAULTS)
      saveSettings()
      applySettings()
      renderSettings()
      onChange()
    })
    el.settingsBody.appendChild(reset)

    const hint = document.createElement('p')
    hint.className = 'setting__hint'
    hint.textContent = 'Les réglages sont enregistrés sur cet ordinateur.'
    el.settingsBody.appendChild(hint)
  }

  const renderDocs = () => {
    if (!el.docsBody) return
    el.docsBody.innerHTML = ''
    for (const section of DOCS) {
      const heading = document.createElement('h3')
      heading.textContent = section.title
      el.docsBody.appendChild(heading)
      if (section.items) {
        const list = document.createElement('ul')
        for (const item of section.items) {
          const li = document.createElement('li')
          li.textContent = item
          list.appendChild(li)
        }
        el.docsBody.appendChild(list)
      }
      if (section.shortcuts) {
        const table = document.createElement('table')
        for (const [keys, action] of section.shortcuts) {
          const row = document.createElement('tr')
          const first = document.createElement('td')
          first.innerHTML = '<kbd>' + esc(keys) + '</kbd>'
          const second = document.createElement('td')
          second.textContent = action
          row.append(first, second)
          table.appendChild(row)
        }
        el.docsBody.appendChild(table)
      }
    }
  }

  const closePanels = () => {
    el.settingsPanel.hidden = true
    el.docsPanel.hidden = true
  }

  const openPanel = (name) => {
    const showSettings = name === 'settings'
    el.settingsPanel.hidden = !showSettings
    el.docsPanel.hidden = showSettings
    if (showSettings) renderSettings()
    else renderDocs()
  }

  const settingsButton = document.getElementById('open-settings')
  const docsButton = document.getElementById('open-docs')
  settingsButton.innerHTML = icon('settings', 16)
  docsButton.innerHTML = icon('help', 16)
  settingsButton.addEventListener('click', () => openPanel('settings'))
  docsButton.addEventListener('click', () => openPanel('docs'))
  document.getElementById('settings-close').addEventListener('click', closePanels)
  document.getElementById('docs-close').addEventListener('click', closePanels)
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePanels()
  })

  renderSettings()
  renderDocs()
  return { renderSettings, renderDocs, closePanels }
}
