/**
 * ELASTICO — PWA Icon Generator Script
 *
 * Creates all required PWA icon sizes from a single SVG template.
 * Uses the green "E" on rounded background matching the app's favicon.
 * Sizes: 72, 96, 128, 144, 152, 192, 384, 512
 */

const { createCanvas } = require('canvas')
const fs = require('fs')
const path = require('path')

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
const BG_COLOR = '#0a0a0a'
const PRIMARY = '#00e676'
const OUT_DIR = path.join(__dirname, '..', 'public', 'icons')

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

function generateIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Background
  const radius = size * 0.2
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, radius)
  ctx.fillStyle = BG_COLOR
  ctx.fill()

  // Green circle behind the letter
  const circleRadius = size * 0.38
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, circleRadius, 0, Math.PI * 2)
  ctx.fillStyle = PRIMARY
  ctx.fill()

  // Letter "E"
  const fontSize = Math.round(size * 0.52)
  ctx.fillStyle = '#000000'
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('E', size / 2, size / 2 + fontSize * 0.04)

  const buffer = canvas.toBuffer('image/png')
  const filePath = path.join(OUT_DIR, `icon-${size}x${size}.png`)
  fs.writeFileSync(filePath, buffer)
  console.log(`  ✓ icon-${size}x${size}.png (${(buffer.length / 1024).toFixed(1)} KB)`)
}

console.log('[ELASTICO] Generating PWA icons...')
for (const size of SIZES) {
  generateIcon(size)
}
console.log(`[ELASTICO] ${SIZES.length} icons generated in ${OUT_DIR}`)