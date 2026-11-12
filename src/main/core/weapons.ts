import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  Rarity,
  SkinPattern,
  Wear,
  WeaponAsset,
  WeaponComparison,
  WeaponPreview,
  WeaponSpec,
  WeaponSuggestion
} from '../../shared/weapons'
import {
  PATTERN_LABELS,
  RARITIES,
  SKIN_PATTERNS,
  WEARS,
  WEAPON_BASES,
  defaultColors,
  defaultWeaponName,
  interpretWeapon,
  rarityById,
  weaponBaseById,
  wearById,
  wearForFloat
} from '../../shared/weapons'
import { execute, queryAll, queryOne } from './database'
import { getProject } from './projects'
import { ensureDir, isDirectory, moveToTrash, pathExists } from './filesystem'
import { slugify, timestampSlug } from './naming'
import { encodePng } from './png'
import { shade, toDataUrl } from './sprites'
import { logActivity } from './activity'

/**
 * Editor de armas e skins (etapa 6).
 *
 * O ícone é desenhado em pixel art a partir do modelo da arma, com o padrão da
 * skin, as duas cores escolhidas e marcas de desgaste proporcionais ao float.
 * Raridade vira a faixa colorida embaixo do ícone e a etiqueta da ficha — nunca
 * se mistura com a condição.
 */

const FOLDER = 'armas'
const MAX_NAME = 60
const LOGICAL = 32

let trashDir = ''

export function configureWeapons(options: { trashDir: string }): void {
  trashDir = options.trashDir
}

function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
    ? value.toLowerCase()
    : fallback
}

function isPattern(value: unknown): value is SkinPattern {
  return typeof value === 'string' && SKIN_PATTERNS.some((pattern) => pattern.id === value)
}

function isWear(value: unknown): value is Wear {
  return typeof value === 'string' && WEARS.some((wear) => wear.id === value)
}

function isRarity(value: unknown): value is Rarity {
  return typeof value === 'string' && RARITIES.some((rarity) => rarity.id === value)
}

/** Valida e normaliza a skin vinda da interface. */
export function validateWeaponSpec(input: WeaponSpec): WeaponSpec {
  const name = String(input.name ?? '').trim()
  if (name.length < 2) throw new Error('O nome da arma precisa ter pelo menos 2 caracteres.')
  if (name.length > MAX_NAME) {
    throw new Error(`O nome da arma pode ter no máximo ${MAX_NAME} caracteres.`)
  }

  const base = weaponBaseById(String(input.baseId ?? ''))
  const rarity: Rarity = isRarity(input.rarity) ? input.rarity : 'azul'
  const wear: Wear = isWear(input.wear) ? input.wear : wearForFloat(Number(input.float) || 0).id
  const range = wearById(wear)
  const pattern: SkinPattern = isPattern(input.pattern) ? input.pattern : 'solido'
  const fallback = defaultColors(pattern)

  const rawFloat = Number(input.float)
  const float = Math.max(range.min, Math.min(Number.isFinite(rawFloat) ? rawFloat : range.min, range.max))

  return {
    baseId: base.id,
    name,
    rarity,
    wear,
    float: Number(float.toFixed(4)),
    pattern,
    colors: {
      primaria: normalizeColor(input.colors?.primaria, fallback.primaria),
      secundaria: normalizeColor(input.colors?.secundaria, fallback.secundaria)
    },
    seed: Math.abs(Math.floor(Number(input.seed) || 1)) % 2147483647 || 1,
    size: input.size === 96 ? 96 : input.size === 32 ? 32 : 64
  }
}

/* ----------------------------------------------------------------- desenho */

type CellCode = 'B' | 'D' | 'M' | 'G'
type Mask = Array<CellCode | null>

function paintRect(
  mask: Mask,
  x: number,
  y: number,
  width: number,
  height: number,
  code: CellCode
): void {
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const px = x + column
      const py = y + row
      if (px < 0 || py < 0 || px >= LOGICAL || py >= LOGICAL) continue
      mask[py * LOGICAL + px] = code
    }
  }
}

/**
 * Silhueta lateral de cada modelo em uma grade de 32x32.
 * B = corpo da skin, D = detalhe da skin, M = metal, G = cabo/empunhadura.
 */
function buildMask(baseId: string): Mask {
  const mask: Mask = Array.from({ length: LOGICAL * LOGICAL }, () => null)
  const cls = weaponBaseById(baseId).classId

  if (cls === 'faca') {
    for (let index = 0; index < 15; index += 1) {
      paintRect(mask, 8 + index, 20 - index, 2, 2, 'B')
    }
    paintRect(mask, 5, 19, 4, 3, 'G')
    paintRect(mask, 4, 18, 2, 2, 'D')
    paintRect(mask, 12, 17, 3, 1, 'D')
    return mask
  }

  if (cls === 'rifle') {
    paintRect(mask, 6, 13, 16, 6, 'B')
    paintRect(mask, 2, 14, 4, 4, 'G')
    paintRect(mask, 22, 14, 6, 2, 'M')
    paintRect(mask, 8, 19, 3, 4, 'G')
    paintRect(mask, 12, 19, 4, 5, 'D')
    paintRect(mask, 12, 11, 4, 2, 'M')
    if (baseId === 'm4a4') {
      paintRect(mask, 17, 15, 6, 1, 'D')
      paintRect(mask, 17, 11, 5, 2, 'M')
    } else {
      paintRect(mask, 19, 15, 4, 1, 'D')
    }
    return mask
  }

  if (cls === 'sniper') {
    paintRect(mask, 5, 13, 14, 5, 'B')
    paintRect(mask, 1, 13, 4, 5, 'G')
    paintRect(mask, 19, 14, 9, 2, 'M')
    paintRect(mask, 21, 12, 3, 2, 'D')
    paintRect(mask, 10, 9, 8, 3, 'M')
    paintRect(mask, 11, 10, 6, 1, 'D')
    paintRect(mask, 9, 19, 3, 4, 'G')
    return mask
  }

  if (cls === 'pistola') {
    paintRect(mask, 8, 12, 14, 4, 'B')
    paintRect(mask, 22, 13, 4, 2, 'M')
    paintRect(mask, 9, 16, 5, 7, 'G')
    paintRect(mask, 14, 16, 3, 1, 'M')
    paintRect(mask, 10, 13, 8, 1, 'D')
    if (baseId === 'usp-s') paintRect(mask, 22, 13, 6, 2, 'M')
    if (baseId === 'desert-eagle') paintRect(mask, 20, 12, 6, 4, 'B')
    return mask
  }

  // submetralhadoras
  paintRect(mask, 5, 13, 14, 6, 'B')
  paintRect(mask, 2, 14, 3, 3, 'M')
  paintRect(mask, 19, 14, 6, 2, 'M')
  paintRect(mask, 8, 19, 3, 4, 'G')
  paintRect(mask, 12, 19, 3, 6, 'D')
  paintRect(mask, 16, 12, 3, 1, 'D')
  if (baseId === 'p90') paintRect(mask, 6, 11, 10, 2, 'D')
  return mask
}

function hash01(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function mix(a: string, b: string, t: number): string {
  const parse = (hex: string): [number, number, number] => {
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
  const [ar, ag, ab] = parse(a)
  const [br, bg, bb] = parse(b)
  const toHex = (value: number): string =>
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
  return `#${toHex(ar + (br - ar) * t)}${toHex(ag + (bg - ag) * t)}${toHex(ab + (bb - ab) * t)}`
}

/** Cor da skin em cada pixel do corpo, de acordo com o padrão escolhido. */
function patternColor(
  spec: WeaponSpec,
  x: number,
  y: number
): string {
  const primary = spec.colors.primaria
  const secondary = spec.colors.secundaria
  const seed = spec.seed

  switch (spec.pattern) {
    case 'listras': {
      return (x + y) % 6 < 3 ? primary : secondary
    }
    case 'camuflado': {
      const noise = hash01(Math.floor(x / 3), Math.floor(y / 3), seed)
      if (noise > 0.72) return shade(secondary, -0.15)
      if (noise > 0.45) return secondary
      return primary
    }
    case 'digital': {
      const block = hash01(Math.floor(x / 2), Math.floor(y / 2), seed + 3)
      if (block > 0.66) return shade(primary, 0.15)
      if (block > 0.33) return secondary
      return shade(secondary, 0.2)
    }
    case 'gradiente': {
      return mix(primary, secondary, Math.max(0, Math.min(1, (x - 2) / 22)))
    }
    case 'chamas': {
      const wave = hash01(Math.floor(x / 4), Math.floor(y / 2), seed + 11)
      return wave > 0.62 ? secondary : primary
    }
    case 'solido':
    default:
      return y % 3 === 0 ? shade(primary, -0.08) : primary
  }
}

/** Grade de cores (string | null) do ícone, antes da ampliação. */
export function renderWeaponGrid(spec: WeaponSpec): Array<string | null> {
  const mask = buildMask(spec.baseId)
  const rarity = rarityById(spec.rarity)
  const colors: Array<string | null> = Array.from({ length: LOGICAL * LOGICAL }, () => null)

  for (let y = 0; y < LOGICAL; y += 1) {
    for (let x = 0; x < LOGICAL; x += 1) {
      const code = mask[y * LOGICAL + x] ?? null
      if (!code) continue

      // Marcas de desgaste: quanto maior o float, mais lascas na pintura.
      const scratchChance = Math.max(0, spec.float - 0.15) * 0.55
      const scratched = code === 'B' && hash01(x, y, spec.seed + 29) < scratchChance

      let color: string
      if (code === 'M') {
        color = shade('#2b3038', scratched ? -0.3 : 0)
      } else if (code === 'G') {
        color = shade(spec.colors.secundaria, -0.45)
      } else if (code === 'D') {
        color = shade(patternColor(spec, x, y), -0.3)
      } else {
        color = patternColor(spec, x, y)
      }

      if (scratched) color = shade(color, -0.55)
      colors[y * LOGICAL + x] = color
    }
  }

  // Faixa de raridade embaixo da arma (separada da condição).
  for (let x = 5; x <= 26; x += 1) {
    colors[29 * LOGICAL + x] = rarity.color
  }

  // Contorno escuro ao redor da silhueta.
  const outlined = [...colors]
  for (let y = 0; y < LOGICAL; y += 1) {
    for (let x = 0; x < LOGICAL; x += 1) {
      if (colors[y * LOGICAL + x]) continue
      const near =
        colors[(y - 1) * LOGICAL + x] ||
        colors[(y + 1) * LOGICAL + x] ||
        colors[y * LOGICAL + (x - 1)] ||
        colors[y * LOGICAL + (x + 1)]
      if (near) outlined[y * LOGICAL + x] = '#0a0b0d'
    }
  }

  return outlined
}

function parseColor(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [
    Number.parseInt(clean.slice(0, 2), 16) || 0,
    Number.parseInt(clean.slice(2, 4), 16) || 0,
    Number.parseInt(clean.slice(4, 6), 16) || 0
  ]
}

/** Amplia a grade lógica sem interpolação (32, 64 ou 96 px). */
export function renderWeaponPixels(spec: WeaponSpec): {
  width: number
  height: number
  pixels: Uint8Array
} {
  const grid = renderWeaponGrid(spec)
  const size = spec.size
  const scale = size / LOGICAL
  const pixels = new Uint8Array(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const color = grid[Math.floor(y / scale) * LOGICAL + Math.floor(x / scale)] ?? null
      if (!color) continue
      const [r, g, b] = parseColor(color)
      const offset = (y * size + x) * 4
      pixels[offset] = r
      pixels[offset + 1] = g
      pixels[offset + 2] = b
      pixels[offset + 3] = 255
    }
  }

  return { width: size, height: size, pixels }
}

export function renderWeaponPng(spec: WeaponSpec): Buffer {
  const rendered = renderWeaponPixels(spec)
  return encodePng(rendered.width, rendered.height, rendered.pixels)
}

/** Pré-visualização do ícone (nada é gravado). */
export async function previewWeapon(input: WeaponSpec): Promise<WeaponPreview> {
  const spec = validateWeaponSpec(input)
  const png = renderWeaponPng(spec)
  return { icon: toDataUrl(png), width: spec.size, height: spec.size }
}

/**
 * Comparação lado a lado: a mesma arma e o mesmo padrão em todas as raridades,
 * para ver a diferença entre raridade e condição.
 */
export async function compareWeapon(input: WeaponSpec): Promise<WeaponComparison> {
  const spec = validateWeaponSpec(input)
  const size = spec.size
  const columns = RARITIES.length
  const width = size * columns
  const pixels = new Uint8Array(width * size * 4)

  RARITIES.forEach((rarity, column) => {
    const rendered = renderWeaponPixels({ ...spec, rarity: rarity.id })
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const from = (y * size + x) * 4
        const to = (y * width + column * size + x) * 4
        pixels[to] = rendered.pixels[from] ?? 0
        pixels[to + 1] = rendered.pixels[from + 1] ?? 0
        pixels[to + 2] = rendered.pixels[from + 2] ?? 0
        pixels[to + 3] = rendered.pixels[from + 3] ?? 0
      }
    }
  })

  return {
    image: toDataUrl(encodePng(width, size, pixels)),
    columns,
    width,
    height: size,
    labels: RARITIES.map((rarity) => `${rarity.label} · ${rarity.short}`)
  }
}

/* ---------------------------------------------------------------- gravação */

function uniqueFolder(parent: string, slug: string): string {
  let candidate = join(parent, slug)
  let counter = 2
  while (pathExists(candidate)) {
    candidate = join(parent, `${slug}-${counter}`)
    counter += 1
  }
  return candidate
}

/** Grava ícone, comparativo de raridades e ficha da skin. */
export async function saveWeapon(projectId: string, input: WeaponSpec): Promise<WeaponAsset> {
  const spec = validateWeaponSpec(input)
  const project = await getProject(projectId)
  if (!project.folderExists) {
    throw new Error(`A pasta do projeto não foi encontrada em "${project.path}".`)
  }

  const parent = join(project.path, FOLDER)
  ensureDir(parent)
  const folder = uniqueFolder(parent, slugify(spec.name))
  ensureDir(folder)
  const slug = folder.split(/[\\/]/).pop() ?? slugify(spec.name)

  const iconName = `${slug}_icone.png`
  writeFileSync(join(folder, iconName), renderWeaponPng(spec))

  const comparison = await compareWeapon(spec)
  const comparisonBase64 = comparison.image.split(',')[1] ?? ''
  const variationsName = `${slug}_raridades.png`
  writeFileSync(join(folder, variationsName), Buffer.from(comparisonBase64, 'base64'))

  const base = weaponBaseById(spec.baseId)
  const rarity = rarityById(spec.rarity)
  const wear = wearById(spec.wear)
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  const ficha = {
    formato: 1,
    id,
    geradoPor: 'Pixel Strike Studio',
    geradoEm: createdAt,
    nome: spec.name,
    arma: {
      id: base.id,
      nome: base.label,
      classe: base.classId,
      municao: base.ammo,
      atributos: base.stats
    },
    skin: {
      raridade: spec.rarity,
      raridadeNome: rarity.label,
      raridadeCategoria: rarity.short,
      condicao: spec.wear,
      condicaoNome: wear.label,
      float: spec.float,
      padrao: spec.pattern,
      padraoNome: PATTERN_LABELS[spec.pattern],
      cores: spec.colors,
      semente: spec.seed
    },
    tamanho: spec.size,
    arquivos: {
      icone: iconName,
      raridades: variationsName
    },
    variacoes: RARITIES.map((item) => ({
      raridade: item.id,
      nome: item.label,
      categoria: item.short,
      cor: item.color
    })),
    condicoes: WEARS.map((item) => ({
      id: item.id,
      nome: item.label,
      floatMinimo: item.min,
      floatMaximo: item.max
    }))
  }

  const jsonName = `${slug}.json`
  writeFileSync(join(folder, jsonName), `${JSON.stringify(ficha, null, 2)}\n`, 'utf8')

  const jsonPath = `${FOLDER}/${slug}/${jsonName}`
  const iconPath = `${FOLDER}/${slug}/${iconName}`
  const variationsPath = `${FOLDER}/${slug}/${variationsName}`

  const data = JSON.stringify({
    folder: `${FOLDER}/${slug}`,
    baseId: base.id,
    baseLabel: base.label,
    classId: base.classId,
    rarity: spec.rarity,
    rarityLabel: rarity.label,
    wear: spec.wear,
    wearLabel: wear.label,
    float: spec.float,
    pattern: spec.pattern,
    size: spec.size,
    seed: spec.seed,
    iconPath,
    variationsPath,
    spec
  })

  await execute(
    `INSERT INTO assets (id, project_id, kind, name, origin, relative_path, data, created_at, updated_at)
     VALUES (?, ?, 'arma', ?, 'gerado', ?, ?, ?, ?)`,
    [id, projectId, spec.name, jsonPath, data, createdAt, createdAt]
  )

  await logActivity(
    projectId,
    'arma.criada',
    `Skin "${spec.name}" (${base.label}, ${rarity.short}, ${wear.label}) gerada em ${FOLDER}/${slug}.`
  )

  return {
    id,
    projectId,
    name: spec.name,
    folder: `${FOLDER}/${slug}`,
    jsonPath,
    iconPath,
    variationsPath,
    baseId: base.id,
    baseLabel: base.label,
    classId: base.classId,
    rarity: spec.rarity,
    rarityLabel: rarity.label,
    wear: spec.wear,
    wearLabel: wear.label,
    float: spec.float,
    pattern: spec.pattern,
    size: spec.size,
    seed: spec.seed,
    createdAt,
    spec
  }
}

interface WeaponRow {
  id: string
  project_id: string
  name: string
  relative_path: string
  data: string
  created_at: string
}

function toWeaponAsset(row: WeaponRow): WeaponAsset | null {
  try {
    const parsed = JSON.parse(row.data) as {
      folder: string
      baseId: string
      baseLabel: string
      classId: WeaponAsset['classId']
      rarity: Rarity
      rarityLabel: string
      wear: Wear
      wearLabel: string
      float: number
      pattern: SkinPattern
      size: number
      seed: number
      iconPath: string
      variationsPath: string
      spec: WeaponSpec
    }
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      folder: parsed.folder,
      jsonPath: row.relative_path,
      iconPath: parsed.iconPath,
      variationsPath: parsed.variationsPath,
      baseId: parsed.baseId,
      baseLabel: parsed.baseLabel,
      classId: parsed.classId,
      rarity: parsed.rarity,
      rarityLabel: parsed.rarityLabel,
      wear: parsed.wear,
      wearLabel: parsed.wearLabel,
      float: parsed.float,
      pattern: parsed.pattern,
      size: parsed.size,
      seed: parsed.seed,
      createdAt: row.created_at,
      spec: parsed.spec
    }
  } catch {
    return null
  }
}

/** Lista as skins salvas no projeto. */
export async function listWeapons(projectId: string): Promise<WeaponAsset[]> {
  const rows = await queryAll<WeaponRow>(
    `SELECT id, project_id, name, relative_path, data, created_at
     FROM assets WHERE project_id = ? AND kind = 'arma' ORDER BY created_at DESC`,
    [projectId]
  )
  return rows.map(toWeaponAsset).filter((asset): asset is WeaponAsset => asset !== null)
}

/** Move a pasta da skin para a lixeira e remove o registro. */
export async function removeWeapon(assetId: string): Promise<void> {
  const row = await queryOne<WeaponRow>(
    'SELECT id, project_id, name, relative_path, data, created_at FROM assets WHERE id = ?',
    [assetId]
  )
  if (!row) throw new Error('Esta skin não existe mais.')

  const asset = toWeaponAsset(row)
  const project = await getProject(row.project_id)

  if (asset && project.folderExists) {
    const folder = join(project.path, asset.folder)
    if (isDirectory(folder)) {
      if (!trashDir) throw new Error('A lixeira do Studio não está configurada.')
      moveToTrash(folder, trashDir, `${timestampSlug(new Date())}_${slugify(asset.name)}`)
    }
  }

  await execute('DELETE FROM assets WHERE id = ?', [assetId])
  await logActivity(row.project_id, 'arma.removida', `Skin "${row.name}" movida para a lixeira.`)
}

/** Lê a ficha salva em disco (usada nos testes). */
export function readWeaponSheet(projectPath: string, jsonPath: string): unknown {
  return JSON.parse(readFileSync(join(projectPath, jsonPath), 'utf8'))
}

/** Lista de bases disponíveis para a interface. */
export function listWeaponBases(): typeof WEAPON_BASES {
  return WEAPON_BASES
}

/** Nome sugerido com a combinação atual. */
export function suggestedWeaponName(
  baseId: string,
  rarity: Rarity,
  wear: Wear,
  pattern: SkinPattern
): string {
  return defaultWeaponName(baseId, rarity, wear, pattern)
}

/** Interpreta a descrição da skin por palavras-chave (sem IA nesta etapa). */
export function interpretWeaponDescription(description: string): WeaponSuggestion {
  return interpretWeapon(description)
}
