import { button, docHtml, esc, fileStem, toolbar } from './util.js'

const meta = {
  id: 'slides',
  name: 'NovaCraft Slides',
  letter: 'S',
  color: '#e2571f',
  tagline: 'Présentations',
}

let sequence = 0
const createSlide = (title = 'Nouvelle diapositive', body = '') => ({
  id: `slide-${Date.now()}-${sequence++}`,
  title,
  body,
})

function presentHtml(name, slides) {
  const sections = slides.map((slide, index) => `<section class="slide${index === 0 ? ' is-active' : ''}"><h1>${esc(slide.title)}</h1><div class="body">${slide.body}</div></section>`).join('')
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${esc(name)}</title><style>
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:#0b0d12;font-family:'Segoe UI',system-ui,sans-serif;color:#fff;overflow:hidden}
.slide{display:none;height:100vh;padding:9vh 10vw;flex-direction:column;gap:26px}
.slide.is-active{display:flex}
h1{font-size:clamp(28px,4vw,56px);margin:0;line-height:1.15}
.body{font-size:clamp(18px,2.2vw,32px);line-height:1.5}
.body h1,.body h2{font-size:1.2em}
.hint{position:fixed;right:16px;bottom:12px;font-size:12px;opacity:.35}
</style></head><body>${sections}<div class="hint">← → naviguer · Échap fermer</div><script>
const slides=[...document.querySelectorAll('.slide')];let index=0;
function show(next){slides[index].classList.remove('is-active');index=(next+slides.length)%slides.length;slides[index].classList.add('is-active')}
addEventListener('keydown',(event)=>{
  if(event.key==='ArrowRight'||event.key===' '||event.key==='PageDown'){event.preventDefault();show(index+1)}
  else if(event.key==='ArrowLeft'||event.key==='PageUp'){event.preventDefault();show(index-1)}
  else if(event.key==='Escape'){window.close()}
})
</script></body></html>`
}

export default {
  meta,
  mount(root, ctx) {
    const state = { path: null, name: 'presentation', slides: [createSlide('Bienvenue dans NovaCraft Slides', 'Clique ici pour écrire le contenu de ta diapositive.')], index: 0 }

    const counter = document.createElement('span')
    counter.className = 'muted'

    const list = document.createElement('div')
    list.className = 'slides__list'
    const stage = document.createElement('div')
    stage.className = 'slides__stage'
    const canvas = document.createElement('div')
    canvas.className = 'slide-canvas'
    const titleInput = document.createElement('input')
    titleInput.placeholder = 'Titre de la diapositive'
    const bodyEl = document.createElement('div')
    bodyEl.className = 'slide-canvas__body'
    bodyEl.contentEditable = 'true'
    bodyEl.dataset.placeholder = 'Contenu…'
    canvas.append(titleInput, bodyEl)
    stage.append(canvas)

    const actions = [
      button('Nouvelle', () => {
        state.slides.push(createSlide())
        state.index = state.slides.length - 1
        refresh()
      }),
      button('Dupliquer', () => {
        const current = state.slides[state.index]
        state.slides.splice(state.index + 1, 0, createSlide(current.title, current.body))
        state.index += 1
        refresh()
      }),
      button('Supprimer', () => {
        if (state.slides.length <= 1) return
        state.slides.splice(state.index, 1)
        state.index = Math.max(0, state.index - 1)
        refresh()
      }, 'btn btn--danger'),
    ]

    toolbar(root, [
      button('Ouvrir', () => void openFile()),
      button('Enregistrer', () => void save(), 'btn btn--primary'),
      button('Présenter', () => void present()),
      button('PDF', () => void exportPdf()),
      'sep',
      ...actions,
      'sep',
      button('↑', () => {
        if (state.index === 0) return
        const [slide] = state.slides.splice(state.index, 1)
        state.slides.splice(state.index - 1, 0, slide)
        state.index -= 1
        refresh()
      }),
      button('↓', () => {
        if (state.index >= state.slides.length - 1) return
        const [slide] = state.slides.splice(state.index, 1)
        state.slides.splice(state.index + 1, 0, slide)
        state.index += 1
        refresh()
      }),
      'spacer',
      counter,
    ])

    const wrap = document.createElement('div')
    wrap.className = 'slides'
    wrap.append(list, stage)
    root.appendChild(wrap)

    function current() {
      return state.slides[state.index]
    }

    function syncEditor() {
      const slide = current()
      titleInput.value = slide.title
      bodyEl.innerHTML = slide.body || ''
    }

    function commit() {
      const slide = current()
      if (!slide) return
      slide.title = titleInput.value
      slide.body = bodyEl.innerHTML
      renderList()
    }

    function renderList() {
      list.innerHTML = ''
      state.slides.forEach((slide, index) => {
        const item = document.createElement('button')
        item.className = `slide-thumb${index === state.index ? ' is-active' : ''}`
        const title = document.createElement('div')
        title.textContent = `${index + 1}. ${slide.title || 'Sans titre'}`
        title.style.fontWeight = '600'
        const excerpt = document.createElement('div')
        excerpt.className = 'muted'
        excerpt.style.marginTop = '4px'
        excerpt.textContent = (slide.body.replace(/<[^>]+>/g, ' ').trim() || 'Diapositive vide').slice(0, 60)
        item.append(title, excerpt)
        item.addEventListener('click', () => {
          commit()
          state.index = index
          syncEditor()
          renderList()
        })
        list.appendChild(item)
      })
      counter.textContent = `${state.index + 1} / ${state.slides.length}`
    }

    function refresh() {
      syncEditor()
      renderList()
      ctx.status(state.path ? state.path : `${state.name} — ${state.slides.length} diapositive(s)`)
    }

    titleInput.addEventListener('input', commit)
    bodyEl.addEventListener('input', commit)

    async function openFile() {
      const file = await window.suite.openText({
        filters: [
          { name: 'Présentation NovaCraft', extensions: ['ncslides'] },
          { name: 'JSON', extensions: ['json'] },
        ],
      })
      if (!file) return
      try {
        const parsed = JSON.parse(file.content)
        if (!parsed || !Array.isArray(parsed.slides) || parsed.slides.length === 0) return
        state.slides = parsed.slides.map((slide) => createSlide(String(slide.title || 'Sans titre'), String(slide.body || '')))
        state.index = 0
        state.path = file.path
        state.name = fileStem(file.name)
        refresh()
      } catch (error) {
        ctx.status(`Fichier illisible : ${String(error)}`)
      }
    }

    async function save() {
      commit()
      const payload = JSON.stringify({ app: 'slides', version: 1, slides: state.slides }, null, 2)
      const saved = await window.suite.saveText({
        defaultName: `${state.name}.ncslides`,
        content: payload,
        filters: [{ name: 'Présentation NovaCraft', extensions: ['ncslides'] }],
      })
      if (saved) {
        state.path = saved
        state.name = fileStem(saved.split(/[\\/]/).pop() || state.name)
        refresh()
        ctx.status(`Enregistré : ${saved}`)
      }
    }

    async function present() {
      commit()
      const opened = await window.suite.present({ html: presentHtml(state.name, state.slides) })
      ctx.status(opened ? 'Présentation ouverte en plein écran' : 'Impossible de lancer la présentation')
    }

    async function exportPdf() {
      commit()
      const body = state.slides.map((slide) => `<section style="page-break-after: always; min-height: 240mm"><h1>${esc(slide.title)}</h1><div>${slide.body}</div></section>`).join('')
      const target = await window.suite.exportPdf({ html: docHtml(state.name, body), defaultName: `${state.name}.pdf` })
      if (target) ctx.status(`PDF créé : ${target}`)
    }

    refresh()

    return {
      destroy() {
        commit()
      },
    }
  },
}
