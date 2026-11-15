const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const PUBLIC_DIR = path.join(__dirname, '..', 'public')
const HERO_LG = path.join(PUBLIC_DIR, 'hero', 'lg')
const HERO_SM = path.join(PUBLIC_DIR, 'hero', 'sm')
const HERO_MOBILE = path.join(PUBLIC_DIR, 'hero', 'mobile')

// Output to temp directory (completely separate)
const TEMP_DIR = path.join(PUBLIC_DIR, '..', 'hero-compressed')
const TEMP_LG = path.join(TEMP_DIR, 'lg')
const TEMP_SM = path.join(TEMP_DIR, 'sm')
const TEMP_MOBILE = path.join(TEMP_DIR, 'mobile')

async function compressHeroFrames() {
  console.log('Compressing hero frames...')
  
  const lgFiles = fs.readdirSync(HERO_LG).filter(f => f.endsWith('.webp')).sort()
  console.log(`Found ${lgFiles.length} lg frames`)
  
  if (!fs.existsSync(TEMP_LG)) fs.mkdirSync(TEMP_LG, { recursive: true })
  
  for (const file of lgFiles) {
    const input = path.join(HERO_LG, file)
    const output = path.join(TEMP_LG, file)
    await sharp(input)
      .webp({ quality: 50, effort: 6 })
      .toFile(output)
  }
  console.log('LG frames compressed to temp')
  
  const smFiles = fs.readdirSync(HERO_SM).filter(f => f.endsWith('.webp')).sort()
  console.log(`Found ${smFiles.length} sm frames`)
  
  if (!fs.existsSync(TEMP_SM)) fs.mkdirSync(TEMP_SM, { recursive: true })
  
  for (const file of smFiles) {
    const input = path.join(HERO_SM, file)
    const output = path.join(TEMP_SM, file)
    await sharp(input)
      .webp({ quality: 45, effort: 6 })
      .toFile(output)
  }
  console.log('SM frames compressed to temp')
}

async function compressMobileImages() {
  console.log('Compressing mobile images...')
  
  const mobileFiles = fs.readdirSync(HERO_MOBILE)
  console.log(`Found ${mobileFiles.length} mobile images`)
  
  if (!fs.existsSync(TEMP_MOBILE)) fs.mkdirSync(TEMP_MOBILE, { recursive: true })
  
  for (const file of mobileFiles) {
    const input = path.join(HERO_MOBILE, file)
    const ext = path.extname(file).toLowerCase()
    const base = path.basename(file, ext)
    const output = path.join(TEMP_MOBILE, `${base}.webp`)
    
    await sharp(input)
      .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 55, effort: 6 })
      .toFile(output)
    
    console.log(`Compressed ${file} -> ${base}.webp`)
  }
  console.log('Mobile images compressed to temp')
}

async function main() {
  await compressHeroFrames()
  await compressMobileImages()
  
  console.log('\nCompression complete. Files in:', TEMP_DIR)
  console.log('Now run the swap script to replace originals.')
}

main().catch(console.error)