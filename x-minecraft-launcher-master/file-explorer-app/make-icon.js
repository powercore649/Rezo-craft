// Builds icon.png (256×256) and icon.ico from a procedural drawing.
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const SIZE = 256
const SS = 3

function crcTable() {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
}
const CRC = crcTable()

function crc32(buffer) {
  let c = -1
  for (let i = 0; i < buffer.length; i += 1) c = CRC[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

function encodePng(rgba, width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const rows = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    rows[y * (width * 4 + 1)] = 0
    rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function inRoundRect(x, y, left, top, right, bottom, radius) {
  const cx = Math.min(Math.max(x, left + radius), right - radius)
  const cy = Math.min(Math.max(y, top + radius), bottom - radius)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= radius * radius
}

function sample(x, y) {
  // Rounded background with a blue → violet gradient.
  if (!inRoundRect(x, y, 10, 10, SIZE - 10, SIZE - 10, 58)) return [0, 0, 0, 0]
  const t = Math.min(1, Math.max(0, (x + y) / (SIZE * 2)))
  let r = Math.round(91 + (122 - 91) * t)
  let g = Math.round(140 + (91 - 140) * t)
  let b = Math.round(255 + (255 - 255) * t)

  // Folder tab and body in white.
  const inTab = inRoundRect(x, y, 58, 88, 132, 124, 14)
  const inBody = inRoundRect(x, y, 58, 108, 198, 184, 16)
  if (inTab || inBody) {
    r = 255
    g = 255
    b = 255
  }

  // Warm accent bar inside the folder.
  if (inRoundRect(x, y, 74, 132, 182, 152, 9)) {
    r = 242
    g = 201
    b = 76
  }

  // Small spark above the folder.
  const spark = (x - 190) ** 2 + (y - 78) ** 2
  if (spark <= 15 * 15) {
    r = 255
    g = 255
    b = 255
  }

  return [r, g, b, 255]
}

const rgba = Buffer.alloc(SIZE * SIZE * 4)
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    let r = 0
    let g = 0
    let b = 0
    let a = 0
    for (let sy = 0; sy < SS; sy += 1) {
      for (let sx = 0; sx < SS; sx += 1) {
        const [pr, pg, pb, pa] = sample(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS)
        r += pr * pa
        g += pg * pa
        b += pb * pa
        a += pa
      }
    }
    const count = SS * SS
    const index = (y * SIZE + x) * 4
    rgba[index] = a ? Math.round(r / a) : 0
    rgba[index + 1] = a ? Math.round(g / a) : 0
    rgba[index + 2] = a ? Math.round(b / a) : 0
    rgba[index + 3] = Math.round(a / count)
  }
}

const png = encodePng(rgba, SIZE, SIZE)
const dir = __dirname
fs.writeFileSync(path.join(dir, 'icon.png'), png)

// ICO container with a single 256×256 PNG entry (Vista+ format).
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(1, 4)
const entry = Buffer.alloc(16)
entry[0] = 0
entry[1] = 0
entry[2] = 0
entry[3] = 0
entry.writeUInt16LE(1, 4)
entry.writeUInt16LE(32, 6)
entry.writeUInt32LE(png.length, 8)
entry.writeUInt32LE(22, 12)
fs.writeFileSync(path.join(dir, 'icon.ico'), Buffer.concat([header, entry, png]))

console.log('ICON_WRITTEN', png.length, fs.statSync(path.join(dir, 'icon.ico')).size)
