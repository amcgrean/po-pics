// Run: node scripts/generate-icons.mjs
// Generates simple green PO icons as PNG using pure JS (no native deps)

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/icons')
mkdirSync(outDir, { recursive: true })

// Minimal PNG encoder
function createPNG(size, drawFn) {
  const data = new Uint8Array(size * size * 4)

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const i = (y * size + x) * 4
    data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = a
  }

  // Fill background green
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      setPixel(x, y, 0, 104, 52) // #006834
    }
  }

  drawFn(setPixel, size)

  return encodePNG(data, size)
}

function encodePNG(pixels, size) {
  // Build raw scanlines (filter byte 0 = None per row)
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = new Uint8Array(1 + size * 4)
    row[0] = 0 // filter type None
    for (let x = 0; x < size; x++) {
      const si = (y * size + x) * 4
      const di = 1 + x * 4
      row[di] = pixels[si]; row[di+1] = pixels[si+1]
      row[di+2] = pixels[si+2]; row[di+3] = pixels[si+3]
    }
    rows.push(row)
  }

  // Concatenate rows
  const rawSize = rows.reduce((s, r) => s + r.length, 0)
  const raw = new Uint8Array(rawSize)
  let offset = 0
  for (const row of rows) { raw.set(row, offset); offset += row.length }

  const compressed = deflateRaw(raw)

  // PNG signature
  const sig = new Uint8Array([137,80,78,71,13,10,26,10])

  // IHDR chunk
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, size); dv.setUint32(4, size)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  // IDAT chunk data
  const idat = compressed

  function makeChunk(type, data) {
    const typeBytes = new TextEncoder().encode(type)
    const len = new Uint8Array(4)
    new DataView(len.buffer).setUint32(0, data.length)
    const crcInput = new Uint8Array(4 + data.length)
    crcInput.set(typeBytes)
    crcInput.set(data, 4)
    const crcVal = crc32(crcInput)
    const crcBytes = new Uint8Array(4)
    new DataView(crcBytes.buffer).setUint32(0, crcVal)
    const out = new Uint8Array(4 + 4 + data.length + 4)
    let o = 0
    out.set(len, o); o += 4
    out.set(typeBytes, o); o += 4
    out.set(data, o); o += data.length
    out.set(crcBytes, o)
    return out
  }

  const ihdrChunk = makeChunk('IHDR', ihdr)
  const idatChunk = makeChunk('IDAT', idat)
  const iendChunk = makeChunk('IEND', new Uint8Array(0))

  const total = sig.length + ihdrChunk.length + idatChunk.length + iendChunk.length
  const out = new Uint8Array(total)
  let o = 0
  out.set(sig, o); o += sig.length
  out.set(ihdrChunk, o); o += ihdrChunk.length
  out.set(idatChunk, o); o += idatChunk.length
  out.set(iendChunk, o)
  return Buffer.from(out)
}

// Very simple deflate (uncompressed blocks, valid PNG)
function deflateRaw(data) {
  const BLOCK = 65535
  const numBlocks = Math.ceil(data.length / BLOCK) || 1
  const out = []

  // zlib header
  out.push(0x78, 0x01)

  for (let i = 0; i < numBlocks; i++) {
    const start = i * BLOCK
    const chunk = data.slice(start, start + BLOCK)
    const last = i === numBlocks - 1 ? 1 : 0
    out.push(last)
    out.push(chunk.length & 0xff, (chunk.length >> 8) & 0xff)
    out.push(~chunk.length & 0xff, (~chunk.length >> 8) & 0xff)
    for (const b of chunk) out.push(b)
  }

  // Adler32
  let s1 = 1, s2 = 0
  for (const b of data) { s1 = (s1 + b) % 65521; s2 = (s2 + s1) % 65521 }
  const adler = (s2 << 16) | s1
  out.push((adler >> 24) & 0xff, (adler >> 16) & 0xff, (adler >> 8) & 0xff, adler & 0xff)

  return new Uint8Array(out)
}

function crc32(data) {
  let crc = 0xffffffff
  for (const b of data) {
    crc ^= b
    for (let j = 0; j < 8; j++) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1)
  }
  return (crc ^ 0xffffffff) >>> 0
}

// Draw "PO" text using simple bitmap font strokes
function drawPO(setPixel, size) {
  const scale = size / 192
  const strokeW = Math.max(1, Math.round(4 * scale))
  const color = [255, 255, 255]

  function line(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1)
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x1 + dx * i / steps)
      const y = Math.round(y1 + dy * i / steps)
      for (let ox = -strokeW; ox <= strokeW; ox++) {
        for (let oy = -strokeW; oy <= strokeW; oy++) {
          setPixel(x + ox, y + oy, ...color)
        }
      }
    }
  }

  function arc(cx, cy, rx, ry, startDeg, endDeg) {
    const steps = 60
    for (let i = 0; i <= steps; i++) {
      const angle = (startDeg + (endDeg - startDeg) * i / steps) * Math.PI / 180
      const x = Math.round(cx + rx * Math.cos(angle))
      const y = Math.round(cy + ry * Math.sin(angle))
      for (let ox = -strokeW; ox <= strokeW; ox++) {
        for (let oy = -strokeW; oy <= strokeW; oy++) {
          setPixel(x + ox, y + oy, ...color)
        }
      }
    }
  }

  const s = scale
  const centerY = size / 2

  // P — left side
  const px = Math.round(30 * s)
  const pTop = Math.round(centerY - 42 * s)
  const pBot = Math.round(centerY + 42 * s)
  const pMid = Math.round(centerY - 4 * s)
  // vertical stroke
  line(px, pTop, px, pBot)
  // top bowl
  arc(Math.round(px + 18 * s), pTop + Math.round(22 * s), Math.round(20 * s), Math.round(22 * s), -90, 90)
  line(px, pTop, Math.round(px + 18 * s), pTop)
  line(px, pMid, Math.round(px + 18 * s), pMid)

  // O — right side
  const ox = Math.round(110 * s)
  const oCx = Math.round(ox + 22 * s)
  const oCy = centerY
  arc(oCx, oCy, Math.round(28 * s), Math.round(42 * s), 0, 360)
}

for (const size of [192, 512]) {
  const png = createPNG(size, drawPO)
  const path = join(outDir, `icon-${size}.png`)
  writeFileSync(path, png)
  console.log(`Created ${path} (${png.length} bytes)`)
}
