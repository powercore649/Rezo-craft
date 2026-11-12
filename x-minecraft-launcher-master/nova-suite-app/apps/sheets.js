import { button, fileStem } from './util.js'

const meta = {
  id: 'sheets',
  name: 'NovaCraft Sheets',
  letter: 'S',
  color: '#1f9d55',
  tagline: 'Tableur',
}

const COLS = 10
const ROWS = 30
const colName = (index) => String.fromCharCode(65 + index)

function parseRef(ref) {
  const match = /^([A-Z]+)(\d+)$/.exec(ref)
  if (!match) throw new Error('#REF')
  let column = 0
  for (const char of match[1]) column = column * 26 + (char.charCodeAt(0) - 64)
  return { column: column - 1, row: Number(match[2]) - 1 }
}

function tokenize(source) {
  const text = String(source).toUpperCase().replace(/\s+/g, '')
  const tokens = []
  let index = 0
  while (index < text.length) {
    const match = /^(\d+(?:\.\d+)?|[A-Z]+[0-9]+|[A-Z]+(?=\()|[-+*/(),:])/.exec(text.slice(index))
    if (!match) throw new Error('#SYNTAXE')
    const value = match[0]
    index += value.length
    if (/^\d/.test(value)) tokens.push({ type: 'number', value: Number(value) })
    else if (/^[A-Z]+[0-9]+$/.test(value)) tokens.push({ type: 'ref', value })
    else if (/^[A-Z]+$/.test(value)) tokens.push({ type: 'func', value })
    else tokens.push({ type: 'op', value })
  }
  return tokens
}

function createEvaluator(cells) {
  const memo = new Map()
  const visiting = new Set()

  const rawOf = (ref) => (cells.get(ref) || '').trim()

  const numeric = (ref) => {
    const value = valueOf(ref)
    if (typeof value === 'number') return value
    if (value === '') return 0
    const parsed = Number(String(value).replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : NaN
  }

  function valueOf(ref) {
    if (memo.has(ref)) return memo.get(ref)
    if (visiting.has(ref)) throw new Error('#CYCLE')
    const raw = rawOf(ref)
    if (!raw.startsWith('=')) {
      memo.set(ref, raw)
      return raw
    }
    visiting.add(ref)
    try {
      const result = evaluateFormula(raw.slice(1))
      memo.set(ref, result)
      return result
    } finally {
      visiting.delete(ref)
    }
  }

  function rangeValues(startRef, endRef) {
    const start = parseRef(startRef)
    const end = parseRef(endRef)
    const values = []
    const rowFrom = Math.min(start.row, end.row)
    const rowTo = Math.max(start.row, end.row)
    const colFrom = Math.min(start.column, end.column)
    const colTo = Math.max(start.column, end.column)
    for (let row = rowFrom; row <= rowTo; row++) {
      for (let column = colFrom; column <= colTo; column++) {
        const value = valueOf(`${colName(column)}${row + 1}`)
        if (typeof value === 'number' && Number.isFinite(value)) values.push(value)
        else if (value !== '') {
          const parsed = Number(String(value).replace(',', '.'))
          if (Number.isFinite(parsed)) values.push(parsed)
        }
      }
    }
    return values
  }

  function evaluateFormula(source) {
    const tokens = tokenize(source)
    let index = 0
    const peek = () => tokens[index]
    const take = () => tokens[index++]
    const isOp = (value) => peek() && peek().type === 'op' && peek().value === value

    function expect(value) {
      const token = take()
      if (!token || token.type !== 'op' || token.value !== value) throw new Error('#SYNTAXE')
    }

    function parseExpression() {
      let left = parseTerm()
      while (isOp('+') || isOp('-')) {
        const operator = take().value
        const right = parseTerm()
        left = operator === '+' ? left + right : left - right
      }
      return left
    }

    function parseTerm() {
      let left = parseFactor()
      while (isOp('*') || isOp('/')) {
        const operator = take().value
        const right = parseFactor()
        left = operator === '*' ? left * right : left / right
      }
      return left
    }

    function parseCallArg() {
      if (peek() && peek().type === 'ref'
        && tokens[index + 1] && tokens[index + 1].type === 'op' && tokens[index + 1].value === ':') {
        const start = take().value
        take()
        const end = take()
        if (!end || end.type !== 'ref') throw new Error('#SYNTAXE')
        return rangeValues(start, end.value)
      }
      return [parseExpression()]
    }

    function parseCall(name) {
      expect('(')
      const groups = []
      if (!isOp(')')) {
        groups.push(parseCallArg())
        while (isOp(',')) {
          take()
          groups.push(parseCallArg())
        }
      }
      expect(')')
      const numbers = groups.flat().filter((value) => Number.isFinite(value))
      switch (name) {
        case 'SUM': return numbers.reduce((sum, value) => sum + value, 0)
        case 'AVERAGE': return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0
        case 'MIN': return numbers.length ? Math.min(...numbers) : 0
        case 'MAX': return numbers.length ? Math.max(...numbers) : 0
        case 'COUNT': return numbers.length
        case 'ROUND': return numbers.length ? Math.round(numbers[0] * 10 ** (numbers[1] || 0)) / 10 ** (numbers[1] || 0) : 0
        case 'ABS': return numbers.length ? Math.abs(numbers[0]) : 0
        default: throw new Error('#NOM')
      }
    }

    function parseFactor() {
      const token = take()
      if (!token) throw new Error('#SYNTAXE')
      if (token.type === 'number') return token.value
      if (token.type === 'ref') return numeric(token.value)
      if (token.type === 'func') return parseCall(token.value)
      if (token.type === 'op' && token.value === '-') return -parseFactor()
      if (token.type === 'op' && token.value === '(') {
        const value = parseExpression()
        expect(')')
        return value
      }
      throw new Error('#SYNTAXE')
    }

    const result = parseExpression()
    if (index < tokens.length) throw new Error('#SYNTAXE')
    return result
  }

  return { valueOf }
}

export default {
  meta,
  mount(root, ctx) {
    const cells = new Map()
    const state = { path: null, name: 'sans-titre' }
    let active = 'A1'
    let editing = null

    const bar = document.createElement('div')
    bar.className = 'toolbar'
    const address = document.createElement('span')
    address.className = 'muted'
    address.textContent = 'A1'
    address.style.minWidth = '38px'
    const input = document.createElement('input')
    input.className = 'field'
    input.style.flex = '1'
    input.placeholder = 'Valeur ou formule (=SUM(A1:A5))'
    const separator = () => {
      const node = document.createElement('span')
      node.className = 'sep'
      return node
    }
    bar.append(
      button('Ouvrir', () => void openFile()),
      button('Enregistrer', () => void save(), 'btn btn--primary'),
      button('CSV', () => void exportCsv()),
      separator(),
      button('Effacer', () => {
        if (!confirm('Effacer toutes les cellules ?')) return
        cells.clear()
        recalc()
      }),
      address,
      input,
    )
    root.appendChild(bar)
    const wrap = document.createElement('div')
    wrap.className = 'sheet-wrap'
    const table = document.createElement('table')
    table.className = 'sheet'
    wrap.appendChild(table)
    root.appendChild(wrap)

    const head = document.createElement('thead')
    const headRow = document.createElement('tr')
    headRow.appendChild(document.createElement('th'))
    for (let column = 0; column < COLS; column++) {
      const th = document.createElement('th')
      th.textContent = colName(column)
      headRow.appendChild(th)
    }
    head.appendChild(headRow)
    table.appendChild(head)
    const body = document.createElement('tbody')

    const display = (ref) => {
      const raw = (cells.get(ref) || '').trim()
      if (!raw.startsWith('=')) return raw
      try {
        const value = createEvaluator(cells).valueOf(ref)
        if (typeof value === 'number') return String(Math.round(value * 1e6) / 1e6)
        return String(value)
      } catch (error) {
        return error instanceof Error ? error.message : '#ERREUR'
      }
    }

    function recalc() {
      for (const cell of table.querySelectorAll('td[data-ref]')) {
        if (cell === editing) continue
        const ref = cell.dataset.ref
        const value = display(ref)
        cell.textContent = value
        cell.classList.toggle('is-error', value.startsWith('#'))
      }
      ctx.status(state.path ? state.path : `${state.name} — formules recalculées`)
    }

    function setActive(ref) {
      active = ref
      address.textContent = ref
      input.value = cells.get(ref) || ''
      for (const cell of table.querySelectorAll('td.is-active')) cell.classList.remove('is-active')
      const target = table.querySelector(`td[data-ref="${ref}"]`)
      if (target) target.classList.add('is-active')
    }

    function commit(cell, move) {
      const ref = cell.dataset.ref
      const raw = (cell.textContent || '').trim()
      if (raw) cells.set(ref, raw)
      else cells.delete(ref)
      editing = null
      recalc()
      setActive(ref)
      if (move) focusCell(move(ref))
    }

    function focusCell(ref) {
      const cell = table.querySelector(`td[data-ref="${ref}"]`)
      if (cell) {
        cell.focus()
        setActive(ref)
      }
    }

    const shift = (ref, dx, dy) => {
      const { column, row } = parseRef(ref)
      const nextColumn = Math.min(COLS - 1, Math.max(0, column + dx))
      const nextRow = Math.min(ROWS - 1, Math.max(0, row + dy))
      return `${colName(nextColumn)}${nextRow + 1}`
    }

    for (let row = 0; row < ROWS; row++) {
      const tr = document.createElement('tr')
      const th = document.createElement('th')
      th.className = 'row-head'
      th.textContent = String(row + 1)
      tr.appendChild(th)
      for (let column = 0; column < COLS; column++) {
        const ref = `${colName(column)}${row + 1}`
        const td = document.createElement('td')
        td.dataset.ref = ref
        td.tabIndex = 0
        td.addEventListener('focus', () => setActive(ref))
        td.addEventListener('blur', () => {
          if (editing === td) commit(td, null)
        })
        td.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit(td, (current) => shift(current, 0, 1))
          } else if (event.key === 'Tab') {
            event.preventDefault()
            commit(td, (current) => shift(current, 1, 0))
          } else if (event.key === 'Escape') {
            td.textContent = cells.get(ref) || ''
            editing = null
            recalc()
          } else if (event.key.startsWith('Arrow') && td.textContent === (cells.get(ref) || '')) {
            event.preventDefault()
            const delta = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[event.key]
            focusCell(shift(ref, delta[0], delta[1]))
          }
        })
        td.addEventListener('input', () => {
          editing = td
        })
        tr.appendChild(td)
      }
      body.appendChild(tr)
    }
    table.appendChild(body)

    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      const raw = input.value.trim()
      if (raw) cells.set(active, raw)
      else cells.delete(active)
      recalc()
      const cell = table.querySelector(`td[data-ref="${active}"]`)
      if (cell) cell.textContent = display(active)
    })


    async function openFile() {
      const file = await window.suite.openText({
        filters: [
          { name: 'Classeur NovaCraft', extensions: ['ncsheet'] },
          { name: 'CSV', extensions: ['csv'] },
          { name: 'Texte', extensions: ['txt'] },
        ],
      })
      if (!file) return
      cells.clear()
      let parsed = null
      try {
        parsed = JSON.parse(file.content)
      } catch {
        parsed = null
      }
      if (parsed && parsed.cells && typeof parsed.cells === 'object') {
        for (const [ref, raw] of Object.entries(parsed.cells)) {
          if (typeof raw === 'string' && raw) cells.set(ref, raw)
        }
      } else {
        const rows = parseCsv(file.content)
        rows.forEach((row, rowIndex) => {
          row.forEach((raw, columnIndex) => {
            if (raw) cells.set(`${colName(columnIndex)}${rowIndex + 1}`, raw)
          })
        })
      }
      state.path = file.path
      state.name = fileStem(file.name)
      recalc()
      setActive('A1')
    }

    async function save() {
      const payload = JSON.stringify({ app: 'sheets', version: 1, cells: Object.fromEntries(cells) }, null, 2)
      const saved = await window.suite.saveText({
        defaultName: `${state.name}.ncsheet`,
        content: payload,
        filters: [{ name: 'Classeur NovaCraft', extensions: ['ncsheet'] }],
      })
      if (saved) {
        state.path = saved
        state.name = fileStem(saved.split(/[\\/]/).pop() || state.name)
        recalc()
        ctx.status(`Enregistré : ${saved}`)
      }
    }

    async function exportCsv() {
      const lines = []
      for (let row = 0; row < ROWS; row++) {
        const values = []
        for (let column = 0; column < COLS; column++) {
          const ref = `${colName(column)}${row + 1}`
          const value = display(ref)
          values.push(/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
        }
        if (values.some((value) => value !== '')) lines.push(values.join(','))
      }
      const saved = await window.suite.saveText({
        defaultName: `${state.name}.csv`,
        content: lines.join('\r\n'),
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      })
      if (saved) ctx.status(`CSV exporté : ${saved}`)
    }

    recalc()
    setActive('A1')
    ctx.status('Entrée valide, Tab passe à la cellule suivante')

    return {
      destroy() {
        editing = null
      },
    }
  },
}

function parseCsv(text) {
  return String(text).split(/\r?\n/).filter((line) => line.length > 0).map((line) => {
    const values = []
    let current = ''
    let quoted = false
    for (let index = 0; index < line.length; index++) {
      const char = line[index]
      if (quoted) {
        if (char === '"' && line[index + 1] === '"') {
          current += '"'
          index++
        } else if (char === '"') {
          quoted = false
        } else {
          current += char
        }
      } else if (char === '"') {
        quoted = true
      } else if (char === ',') {
        values.push(current)
        current = ''
      } else {
        current += char
      }
    }
    values.push(current)
    return values
  })
}
