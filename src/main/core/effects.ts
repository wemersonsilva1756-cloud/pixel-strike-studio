import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EffectAsset, EffectKind, EffectPreview, EffectSpec } from '../../shared/effects'
import {
  EFFECT_KINDS,
  EFFECT_PRESETS,
  MAX_EFFECT_FPS,
  MAX_EFFECT_FRAMES,
  MIN_EFFECT_FPS,
  MIN_EFFECT_FRAMES,
  effectDurationMs
} from '../../shared/effects'
import { execute, queryAll, queryOne } from './database'
import { getProject } from './projects'
import { ensureDir, isDirectory, moveToTrash, pathExists } from './filesystem'
import { slugify, timestampSlug } from './naming'
import { encodePng } from './png'
import { shade, toDataUrl } from './sprites'
import { logActivity } from './activity'

/**
 * Biblioteca de efeitos (etapa 7).
 *
 * Cada quadro é desenhado por um motor de partículas simples e determinístico:
 * a mesma semente e as mesmas cores geram sempre a mesma animação.
 */

const FOLDER = 'efeitos'
const MAX_NAME = 60

let trashDir = ''

export function configureEffects(options: { trashDir: string }): void {
  trashDir = options.trashDir
}

function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
    ? value.toLowerCase()
    : fallback
}

export function validateEffectSpec(input: EffectSpec): EffectSpec {
  const kind: EffectKind = EFFECT_KINDS.includes(input.kind) ? input.kind : 'explosao'
  const preset = EFFECT_PRESETS[kind]
  const name = String(input.name ?? '').trim()
  if (name.length < 2) throw new Error('O nome do efeito precisa ter pelo menos 2 caracteres.')
  if (name.length > MAX_NAME) {
    throw new Error(`O nome do efeito pode ter no máximo ${MAX_NAME} caracteres.`)
  }

  const frames = Math.max(
    MIN_EFFECT_FRAMES,
    Math.min(MAX_EFFECT_FRAMES, Math.round(Number(input.frames) || preset.frames))
  )
  const fps = Math.max(
    MIN_EFFECT_FPS,
    Math.min(MAX_EFFECT_FPS, Math.round(Number(input.fps) || preset.fps))
  )

  return {
    kind,
    name,
    colors: {
      primaria: normalizeColor(input.colors?.primaria, preset.colors.primaria),
      secundaria: normalizeColor(input.colors?.secundaria, preset.colors.secundaria)
    },
    size: input.size === 96 ? 96 : input.size === 32 ? 32 : 64,
    frames,
    fps,
    seed: Math.abs(Math.floor(Number(input.seed) || 1)) % 2147483647 || 1
  }
}

/* ------------------------------------------------------------- desenho */

interface Surface {
  width: number
  height: number
  pixels: Uint8Array
}

function hash01(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function parseColor(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((char) => char + char)
          .join('')
      : clean
  return [
    Number.parseInt(full.slice(0, 2), 16) || 0,
    Number.parseInt(full.slice(2, 4), 16) || 0,
    Number.parseInt(full.slice(4, 6), 16) || 0
  ]
}

function setPixel(
  surface: Surface,
  x: number,
  y: number,
  color: string,
  alpha = 1
): void {
  if (alpha <= 0) return
  const px = Math.round(x)
  const py = Math.round(y)
  if (px < 0 || py < 0 || px >= surface.width || py >= surface.height) return
  const [r, g, b] = parseColor(color)
  const offset = (py * surface.width + px) * 4
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
  if (a <= surface.pixels[offset + 3]!) return
  surface.pixels[offset] = r
  surface.pixels[offset + 1] = g
  surface.pixels[offset + 2] = b
  surface.pixels[offset + 3] = a
}

function disc(surface: Surface, cx: number, cy: number, radius: number, color: string, alpha = 1): void {
  const limit = Math.ceil(radius)
  for (let y = -limit; y <= limit; y += 1) {
    for (let x = -limit; x <= limit; x += 1) {
      if (x * x + y * y > radius * radius) continue
      setPixel(surface, cx + x, cy + y, color, alpha)
    }
  }
}

function square(surface: Surface, cx: number, cy: number, size: number, color: string, alpha = 1): void {
  const half = Math.floor(size / 2)
  for (let y = -half; y <= half; y += 1) {
    for (let x = -half; x <= half; x += 1) {
      setPixel(surface, cx + x, cy + y, color, alpha)
    }
  }
}

function drawFrame(spec: EffectSpec, frame: number): Surface {
  const size = spec.size
  const surface: Surface = { width: size, height: size, pixels: new Uint8Array(size * size * 4) }
  const t = spec.frames <= 1 ? 0 : frame / (spec.frames - 1)
  const center = size / 2
  const primary = spec.colors.primaria
  const secondary = spec.colors.secundaria
  const seed = spec.seed + frame * 31

  switch (spec.kind) {
    case 'explosao': {
      const radius = size * 0.08 + t * size * 0.4
      disc(surface, center, center, radius, secondary, 0.9 - t * 0.5)
      disc(surface, center, center, radius * 0.62, primary, 1 - t * 0.7)
      for (let index = 0; index < 26; index += 1) {
        const angle = hash01(index, 1, seed) * Math.PI * 2
        const distance = radius * (0.75 + hash01(index, 2, seed) * 0.45)
        square(
          surface,
          center + Math.cos(angle) * distance,
          center + Math.sin(angle) * distance,
          Math.max(1, Math.round(size / 24)),
          hash01(index, 3, seed) > 0.5 ? primary : secondary,
          1 - t
        )
      }
      const ring = size * 0.18 + t * size * 0.44
      for (let step = 0; step < 64; step += 1) {
        const angle = (step / 64) * Math.PI * 2
        setPixel(
          surface,
          center + Math.cos(angle) * ring,
          center + Math.sin(angle) * ring,
          shade(primary, 0.25),
          Math.max(0, 0.8 - t)
        )
      }
      break
    }
    case 'fumaca': {
      for (let index = 0; index < 7; index += 1) {
        const offsetX = (hash01(index, 4, spec.seed) - 0.5) * size * 0.42
        const startY = center + (hash01(index, 5, spec.seed) - 0.5) * size * 0.24
        const rise = t * size * 0.34
        const radius = size * (0.09 + t * 0.14) * (0.7 + hash01(index, 6, spec.seed) * 0.6)
        disc(
          surface,
          center + offsetX + Math.sin(t * 6 + index) * size * 0.03,
          startY - rise,
          radius,
          index % 2 === 0 ? primary : secondary,
          (1 - t) * 0.75
        )
      }
      break
    }
    case 'fogo': {
      for (let index = 0; index < 8; index += 1) {
        const offsetX = (hash01(index, 7, spec.seed) - 0.5) * size * 0.34
        const baseY = size * 0.86 - t * size * 0.3 * (0.6 + hash01(index, 8, spec.seed))
        const radius = size * 0.1 * (1 - t * 0.55) * (0.7 + hash01(index, 9, spec.seed) * 0.7)
        disc(surface, center + offsetX, baseY, radius, index % 3 === 0 ? secondary : primary, 1 - t * 0.8)
      }
      disc(surface, center, size * 0.9, size * 0.12 * (1 - t * 0.6), primary, 1 - t)
      break
    }
    case 'impacto': {
      const length = size * (0.12 + t * 0.34)
      for (let ray = 0; ray < 8; ray += 1) {
        const angle = (ray / 8) * Math.PI * 2 + (ray % 2 === 0 ? 0 : Math.PI / 8)
        for (let step = size * 0.06; step < length; step += 1) {
          setPixel(
            surface,
            center + Math.cos(angle) * step,
            center + Math.sin(angle) * step,
            ray % 2 === 0 ? primary : secondary,
            1 - t
          )
        }
      }
      disc(surface, center, center, size * 0.1 * (1 - t * 0.7), primary, 1 - t)
      break
    }
    case 'sangue': {
      for (let index = 0; index < 12; index += 1) {
        const angle = -Math.PI / 2 + (hash01(index, 10, spec.seed) - 0.5) * Math.PI * 1.3
        const speed = size * 0.5 * (0.5 + hash01(index, 11, spec.seed))
        const x = center + Math.cos(angle) * speed * t
        const y = center + Math.sin(angle) * speed * t + size * 0.35 * t * t
        square(
          surface,
          x,
          y,
          Math.max(1, Math.round(size / 22)),
          index % 3 === 0 ? secondary : primary,
          1 - t * 0.7
        )
      }
      break
    }
    case 'cura': {
      disc(surface, center, center, size * 0.34 * (0.6 + t * 0.5), primary, 0.12 + (1 - t) * 0.2)
      for (let index = 0; index < 6; index += 1) {
        const offsetX = (hash01(index, 12, spec.seed) - 0.5) * size * 0.5
        const y = size * 0.78 - t * size * 0.5 - hash01(index, 13, spec.seed) * size * 0.15
        const arm = Math.max(1, Math.round(size / 18))
        const color = index % 2 === 0 ? primary : secondary
        square(surface, center + offsetX, y, arm, color, 1 - t)
        setPixel(surface, center + offsetX - arm, y, color, 1 - t)
        setPixel(surface, center + offsetX + arm, y, color, 1 - t)
        setPixel(surface, center + offsetX, y - arm, color, 1 - t)
        setPixel(surface, center + offsetX, y + arm, color, 1 - t)
      }
      break
    }
    case 'faisca':
    default: {
      for (let index = 0; index < 14; index += 1) {
        const angle = hash01(index, 14, spec.seed) * Math.PI * 2
        const distance = size * (0.1 + t * 0.34) * (0.6 + hash01(index, 15, spec.seed))
        square(
          surface,
          center + Math.cos(angle) * distance,
          center + Math.sin(angle) * distance,
          Math.max(1, Math.round(size / 26)),
          index % 2 === 0 ? primary : secondary,
          1 - t
        )
      }
      break
    }
  }

  return surface
}

export interface RenderedEffectFrame {
  width: number
  height: number
  pixels: Uint8Array
  png: Buffer
}

/** Desenha todos os quadros do efeito (nada é gravado). */
export function renderEffectFrames(spec: EffectSpec): RenderedEffectFrame[] {
  return Array.from({ length: spec.frames }, (_, frame) => {
    const surface = drawFrame(spec, frame)
    return {
      width: surface.width,
      height: surface.height,
      pixels: surface.pixels,
      png: encodePng(surface.width, surface.height, surface.pixels)
    }
  })
}

/** Spritesheet horizontal com todos os quadros. */
export function buildEffectSheet(frames: RenderedEffectFrame[]): {
  width: number
  height: number
  columns: number
  pixels: Uint8Array
  png: Buffer
} {
  if (frames.length === 0) throw new Error('Não há quadros para montar a spritesheet.')
  const first = frames[0]
  if (!first) throw new Error('Não há quadros para montar a spritesheet.')

  const width = first.width * frames.length
  const height = first.height
  const pixels = new Uint8Array(width * height * 4)

  frames.forEach((frame, index) => {
    const offsetX = index * first.width
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < frame.width; x += 1) {
        const from = (y * frame.width + x) * 4
        const to = (y * width + offsetX + x) * 4
        pixels[to] = frame.pixels[from] ?? 0
        pixels[to + 1] = frame.pixels[from + 1] ?? 0
        pixels[to + 2] = frame.pixels[from + 2] ?? 0
        pixels[to + 3] = frame.pixels[from + 3] ?? 0
      }
    }
  })

  return { width, height, columns: frames.length, pixels, png: encodePng(width, height, pixels) }
}

/** Prévia completa: quadros, spritesheet e duração. */
export async function previewEffect(input: EffectSpec): Promise<EffectPreview> {
  const spec = validateEffectSpec(input)
  const frames = renderEffectFrames(spec)
  const sheet = buildEffectSheet(frames)
  return {
    frames: frames.map((frame) => toDataUrl(frame.png)),
    sheet: toDataUrl(sheet.png),
    width: sheet.width,
    height: sheet.height,
    durationMs: effectDurationMs(spec)
  }
}

/* ------------------------------------------------------------- gravação */

function uniqueFolder(parent: string, slug: string): string {
  let candidate = join(parent, slug)
  let counter = 2
  while (pathExists(candidate)) {
    candidate = join(parent, `${slug}-${counter}`)
    counter += 1
  }
  return candidate
}

export async function saveEffect(projectId: string, input: EffectSpec): Promise<EffectAsset> {
  const spec = validateEffectSpec(input)
  const project = await getProject(projectId)
  if (!project.folderExists) {
    throw new Error(`A pasta do projeto não foi encontrada em "${project.path}".`)
  }

  const parent = join(project.path, FOLDER)
  ensureDir(parent)
  const folder = uniqueFolder(parent, slugify(spec.name))
  ensureDir(folder)
  const slug = folder.split(/[\\/]/).pop() ?? slugify(spec.name)

  const frames = renderEffectFrames(spec)
  const sheet = buildEffectSheet(frames)

  frames.forEach((frame, index) => {
    writeFileSync(join(folder, `quadro_${String(index + 1).padStart(2, '0')}.png`), frame.png)
  })
  writeFileSync(join(folder, `${slug}_sheet.png`), sheet.png)

  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const durationMs = effectDurationMs(spec)
  const jsonName = `${slug}.json`

  const ficha = {
    formato: 1,
    id,
    geradoPor: 'Pixel Strike Studio',
    geradoEm: createdAt,
    nome: spec.name,
    tipo: spec.kind,
    tamanho: spec.size,
    fps: spec.fps,
    quadros: frames.length,
    duracaoSegundos: Number((durationMs / 1000).toFixed(3)),
    cores: spec.colors,
    semente: spec.seed,
    folha: { arquivo: `${slug}_sheet.png`, colunas: sheet.columns, largura: sheet.width, altura: sheet.height }
  }

  writeFileSync(join(folder, jsonName), `${JSON.stringify(ficha, null, 2)}\n`, 'utf8')

  const jsonPath = `${FOLDER}/${slug}/${jsonName}`
  const sheetPath = `${FOLDER}/${slug}/${slug}_sheet.png`
  const data = JSON.stringify({
    folder: `${FOLDER}/${slug}`,
    kind: spec.kind,
    size: spec.size,
    frameCount: frames.length,
    fps: spec.fps,
    durationMs,
    sheetPath,
    columns: sheet.columns,
    spec
  })

  await execute(
    `INSERT INTO assets (id, project_id, kind, name, origin, relative_path, data, created_at, updated_at)
     VALUES (?, ?, 'efeito', ?, 'gerado', ?, ?, ?, ?)`,
    [id, projectId, spec.name, jsonPath, data, createdAt, createdAt]
  )

  await logActivity(
    projectId,
    'efeito.criado',
    `Efeito "${spec.name}" (${spec.kind}, ${frames.length} quadros) gerado em ${FOLDER}/${slug}.`
  )

  return {
    id,
    projectId,
    name: spec.name,
    folder: `${FOLDER}/${slug}`,
    jsonPath,
    sheetPath,
    framesPath: `${FOLDER}/${slug}`,
    kind: spec.kind,
    size: spec.size,
    frameCount: frames.length,
    fps: spec.fps,
    durationMs,
    createdAt,
    spec
  }
}

interface EffectRow {
  id: string
  project_id: string
  name: string
  relative_path: string
  data: string
  created_at: string
}

function toEffectAsset(row: EffectRow): EffectAsset | null {
  try {
    const parsed = JSON.parse(row.data) as {
      folder: string
      kind: EffectKind
      size: number
      frameCount: number
      fps: number
      durationMs: number
      sheetPath: string
      spec: EffectSpec
    }
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      folder: parsed.folder,
      jsonPath: row.relative_path,
      sheetPath: parsed.sheetPath,
      framesPath: parsed.folder,
      kind: parsed.kind,
      size: parsed.size,
      frameCount: parsed.frameCount,
      fps: parsed.fps,
      durationMs: parsed.durationMs,
      createdAt: row.created_at,
      spec: parsed.spec
    }
  } catch {
    return null
  }
}

export async function listEffects(projectId: string): Promise<EffectAsset[]> {
  const rows = await queryAll<EffectRow>(
    `SELECT id, project_id, name, relative_path, data, created_at
     FROM assets WHERE project_id = ? AND kind = 'efeito' ORDER BY created_at DESC`,
    [projectId]
  )
  return rows.map(toEffectAsset).filter((asset): asset is EffectAsset => asset !== null)
}

export async function removeEffect(assetId: string): Promise<void> {
  const row = await queryOne<EffectRow>(
    'SELECT id, project_id, name, relative_path, data, created_at FROM assets WHERE id = ?',
    [assetId]
  )
  if (!row) throw new Error('Este efeito não existe mais.')

  const asset = toEffectAsset(row)
  const project = await getProject(row.project_id)

  if (asset && project.folderExists) {
    const folder = join(project.path, asset.folder)
    if (isDirectory(folder)) {
      if (!trashDir) throw new Error('A lixeira do Studio não está configurada.')
      moveToTrash(folder, trashDir, `${timestampSlug(new Date())}_${slugify(asset.name)}`)
    }
  }

  await execute('DELETE FROM assets WHERE id = ?', [assetId])
  await logActivity(row.project_id, 'efeito.removido', `Efeito "${row.name}" movido para a lixeira.`)
}
