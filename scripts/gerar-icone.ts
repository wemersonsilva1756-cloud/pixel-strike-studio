/**
 * Gera o ícone do aplicativo (build/icon.png e build/icon.ico) em pixel art,
 * usando o mesmo codificador PNG do Studio. Rodar com: npm run icon
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { encodePng } from '../src/main/core/png'

const SIZE = 256
const pixels = new Uint8Array(SIZE * SIZE * 4)

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16)
  ]
}

function put(x: number, y: number, color: string, alpha = 255): void {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
  const [r, g, b] = hexToRgb(color)
  const offset = (y * SIZE + x) * 4
  pixels[offset] = r
  pixels[offset + 1] = g
  pixels[offset + 2] = b
  pixels[offset + 3] = alpha
}

function fill(x: number, y: number, width: number, height: number, color: string): void {
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      put(x + column, y + row, color)
    }
  }
}

// Fundo escuro com cantos recortados.
const background = '#0b1220'
const border = '#1e3a8a'
const accent = '#38bdf8'
const highlight = '#e2e8f0'
const deep = '#0f172a'

fill(24, 0, SIZE - 48, SIZE, background)
fill(8, 8, SIZE - 16, SIZE - 16, background)
fill(16, 4, SIZE - 32, 4, border)
fill(16, SIZE - 8, SIZE - 32, 4, border)

// Mira central: anel grosso, cruz e centro.
const center = SIZE / 2
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    const dx = x - center + 0.5
    const dy = y - center + 0.5
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance <= 78 && distance >= 64) put(x, y, accent)
    if (distance <= 44 && distance >= 32) put(x, y, border)
  }
}

// Cruz de mira (traços grossos saindo do centro).
fill(center - 6, 34, 12, 56, highlight)
fill(center - 6, SIZE - 90, 12, 56, highlight)
fill(34, center - 6, 56, 12, highlight)
fill(SIZE - 90, center - 6, 56, 12, highlight)

// Centro com detalhe em diagonal.
fill(center - 26, center - 26, 52, 52, deep)
fill(center - 20, center - 20, 40, 40, accent)
fill(center - 8, center - 8, 16, 16, highlight)

// Cantos em pixel art, para dar o tom de jogo.
for (const [x, y] of [
  [28, 28],
  [SIZE - 44, 28],
  [28, SIZE - 44],
  [SIZE - 44, SIZE - 44]
] as Array<[number, number]>) {
  fill(x, y, 16, 16, border)
  fill(x + 4, y + 4, 8, 8, accent)
}

const png = encodePng(SIZE, SIZE, pixels)

// ICO com um único quadro 256x256 em PNG (formato aceito desde o Windows Vista).
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(1, 4)

const entry = Buffer.alloc(16)
entry.writeUInt8(0, 0)
entry.writeUInt8(0, 1)
entry.writeUInt8(0, 2)
entry.writeUInt8(0, 3)
entry.writeUInt16LE(1, 4)
entry.writeUInt16LE(32, 6)
entry.writeUInt32LE(png.length, 8)
entry.writeUInt32LE(22, 12)

const buildDir = join(process.cwd(), 'build')
mkdirSync(buildDir, { recursive: true })
writeFileSync(join(buildDir, 'icon.png'), png)
writeFileSync(join(buildDir, 'icon.ico'), Buffer.concat([header, entry, png]))

console.log(`build/icon.png e build/icon.ico gerados (${SIZE}x${SIZE}, ${png.length} bytes de PNG).`)
