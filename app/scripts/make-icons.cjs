/* Builds the PNG app icons from public/favicon.svg: run `node scripts/make-icons.cjs`.
   The mark sits on the app's night background inside the maskable safe zone. */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const PUBLIC_DIR = path.join(__dirname, '..', 'public')
const svg = fs.readFileSync(path.join(PUBLIC_DIR, 'favicon.svg'))
const BACKGROUND = '#020816'

async function icon(size) {
  const mark = Math.round(size * 0.6)
  const glyph = await sharp(svg, { density: 1200 }).resize(mark, mark).png().toBuffer()
  const out = path.join(PUBLIC_DIR, `icon-${size}.png`)
  await sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: glyph, gravity: 'center' }])
    .png()
    .toFile(out)
  console.log(`wrote ${path.relative(process.cwd(), out)}`)
}

Promise.all([icon(192), icon(512)]).catch((err) => {
  console.error(err)
  process.exit(1)
})
