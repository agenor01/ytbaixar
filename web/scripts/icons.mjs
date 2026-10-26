// Gera os PNGs do PWA e o .ico do atalho de PC a partir de public/icon.svg.
// Uso: pnpm icons
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const here = dirname(fileURLToPath(import.meta.url))
const web = join(here, "..")
const svg = readFileSync(join(web, "public", "icon.svg"))
const out = join(web, "public", "icons")
mkdirSync(out, { recursive: true })

const png = (size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer()

for (const size of [192, 512]) writeFileSync(join(out, `icon-${size}.png`), await png(size))
writeFileSync(join(out, "apple-touch-icon.png"), await png(180))

// Maskable: o desenho precisa caber nos 80% do meio, então encolhe e põe fundo
const inner = await png(400)
writeFileSync(join(out, "maskable-512.png"),
  await sharp({ create: { width: 512, height: 512, channels: 4, background: "#16171c" } })
    .composite([{ input: inner, top: 56, left: 56 }]).png().toBuffer())

// .ico com PNGs dentro (Windows aceita desde o Vista)
const sizes = [16, 32, 48, 256]
const images = await Promise.all(sizes.map(png))
const header = Buffer.alloc(6 + 16 * sizes.length)
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4)
let offset = header.length
sizes.forEach((s, i) => {
  const e = 6 + 16 * i
  header.writeUInt8(s >= 256 ? 0 : s, e); header.writeUInt8(s >= 256 ? 0 : s, e + 1)
  header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6)
  header.writeUInt32LE(images[i].length, e + 8); header.writeUInt32LE(offset, e + 12)
  offset += images[i].length
})
const appDir = join(web, "..", "app")
mkdirSync(appDir, { recursive: true })
writeFileSync(join(appDir, "ytbaixar.ico"), Buffer.concat([header, ...images]))

console.log("Ícones gerados em", out, "e app/ytbaixar.ico")
