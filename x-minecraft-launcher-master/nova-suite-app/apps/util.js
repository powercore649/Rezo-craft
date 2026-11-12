export const esc = (value) =>
  String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]))

export const words = (text) => {
  const clean = String(text || '').replace(/<[^>]*>/g, ' ').trim()
  return clean ? clean.split(/\s+/).length : 0
}

export const debounce = (fn, ms) => {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

export const fmtDate = (value) =>
  new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

export const docHtml = (title, body) => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 12pt; line-height: 1.6; color: #16181d; }
  h1 { font-size: 20pt; } h2 { font-size: 15pt; }
  hr { border: 0; border-top: 1px solid #d7dbe2; margin: 14pt 0; }
  table { border-collapse: collapse; } td, th { border: 1px solid #d9dde5; padding: 4pt 6pt; }
  img { max-width: 100%; }
</style>
</head>
<body>${body}</body>
</html>`

export const readJson = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export const toolbar = (parent, nodes) => {
  const bar = document.createElement('div')
  bar.className = 'toolbar'
  for (const node of nodes) {
    if (node === 'sep') {
      const sep = document.createElement('span')
      sep.className = 'sep'
      bar.appendChild(sep)
      continue
    }
    if (node === 'spacer') {
      const spacer = document.createElement('span')
      spacer.className = 'spacer'
      bar.appendChild(spacer)
      continue
    }
    bar.appendChild(node)
  }
  parent.appendChild(bar)
  return bar
}

export const button = (label, onClick, className = 'btn') => {
  const node = document.createElement('button')
  node.type = 'button'
  node.className = className
  node.textContent = label
  node.addEventListener('click', onClick)
  return node
}

export const fileStem = (name) => String(name || 'sans-titre').replace(/\.[^.]+$/, '')
