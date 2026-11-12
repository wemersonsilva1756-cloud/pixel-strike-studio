import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  ItemAsset,
  ItemCategory,
  ItemPreview,
  ItemRarity,
  ItemSpec,
  ItemSuggestion
} from '../../shared/items'
import {
  ITEM_CATEGORIES,
  ITEM_CATEGORY_ATTRIBUTES,
  ITEM_CATEGORY_LABELS,
  ITEM_RARITIES,
  ITEM_ATTRIBUTE_RANGES,
  ITEM_CATEGORY_COLORS,
  describeItem,
  interpretItem,
  itemRarityById
} from '../../shared/items'
import { execute, queryAll, queryOne } from './database'
import { getProject } from './projects'
import { ensureDir, isDirectory, moveToTrash, pathExists } from './filesystem'
import { slugify, timestampSlug } from './naming'
import { encodePng } from './png'
import { shade, toDataUrl } from './sprites'
import { logActivity } from './activity'

/**
 * Itens e equipamentos (etapa 8).
 *
 * O ícone é desenhado em pixel art a partir da categoria, com as duas cores
 * escolhidas e marcas de desgaste conforme a durabilidade. A faixa colorida
 * embaixo do ícone é a raridade — ela não muda nenhum atributo.
 */

const FOLDER = 'itens'
const LOGICAL = 32
const MAX_NAME = 60

let trashDir = ''

export function configureItems(options: { trashDir: string }): void {
  trashDir = options.trashDir
}

function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
    ? value.toLowerCase()
    : fallback
}

function isCategory(value: unknown): value is ItemCategory {
  return typeof value === 'string' && ITEM_CATEGORIES.includes(value as ItemCategory)
}

function isRarity(value: unknown): value is ItemRarity {
  return typeof value === 'string' && ITEM_RARITIES.some((rarity) => rarity.id === value)
}

function clampAttribute(key: keyof typeof ITEM_ATTRIBUTE_RANGES, value: unknown): number {
  const range = ITEM_ATTRIBUTE_RANGES[key]
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return range.min
  return Math.min(range.max, Math.max(range.min, Math.round(numeric)))
}

/** Valida e normaliza o item vindo da interface. */
export function validateItemSpec(input: ItemSpec): ItemSpec {
  const name = String(input.name ?? '').trim()
  if (name.length < 2) throw new Error('O nome do item precisa ter pelo menos 2 caracteres.')
  if (name.length > MAX_NAME) {
    throw new Error(`O nome do item pode ter no máximo ${MAX_NAME} caracteres.`)
  }

  const category: ItemCategory = isCategory(input.category) ? input.category : 'colete'
  const rarity: ItemRarity = isRarity(input.rarity) ? input.rarity : 'comum'
  const fallback = ITEM_CATEGORY_COLORS[category]

  const attributes = {
    armadura: clampAttribute('armadura', input.attributes?.armadura),
    capacidade: clampAttribute('capacidade', input.attributes?.capacidade),
    cura: clampAttribute('cura', input.attributes?.cura),
    durabilidade: clampAttribute('durabilidade', input.attributes?.durabilidade),
    valor: clampAttribute('valor', input.attributes?.valor)
  }

  return {
    category,
    name,
    description: String(input.description ?? '').slice(0, 240),
    rarity,
    attributes,
    colors: {
      primaria: normalizeColor(input.colors?.primaria, fallback.primaria),
      secundaria: normalizeColor(input.colors?.secundaria, fallback.secundaria)
    },
    seed: Math.abs(Math.floor(Number(input.seed) || 1)) % 2147483647 || 1,
    size: input.size === 96 ? 96 : input.size === 32 ? 32 : 64
  }
}

/* ----------------------------------------------------------------- desenho */

type CellCode = 'B' | 'D' | 'M' | 'A'
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

function clearPixel(mask: Mask, x: number, y: number): void {
  if (x < 0 || y < 0 || x >= LOGICAL || y >= LOGICAL) return
  mask[y * LOGICAL + x] = null
}

function paintRing(
  mask: Mask,
  centerX: number,
  centerY: number,
  radius: number,
  thickness: number,
  code: CellCode
): void {
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      const distance = Math.sqrt(x * x + y * y)
      if (distance > radius || distance < radius - thickness) continue
      paintRect(mask, centerX + x, centerY + y, 1, 1, code)
    }
  }
}

/** Silhueta de cada categoria em uma grade de 32x32. */
function buildMask(category: ItemCategory): Mask {
  const mask: Mask = Array.from({ length: LOGICAL * LOGICAL }, () => null)

  switch (category) {
    case 'colete': {
      paintRect(mask, 9, 7, 14, 3, 'B')
      paintRect(mask, 10, 10, 12, 12, 'B')
      paintRect(mask, 11, 22, 10, 2, 'M')
      paintRect(mask, 13, 10, 2, 12, 'D')
      paintRect(mask, 18, 10, 2, 12, 'D')
      paintRect(mask, 15, 7, 3, 2, 'A')
      paintRect(mask, 12, 14, 8, 5, 'D')
      paintRect(mask, 14, 15, 4, 3, 'A')
      return mask
    }
    case 'capacete': {
      paintRect(mask, 10, 8, 12, 3, 'B')
      paintRect(mask, 9, 11, 14, 4, 'B')
      paintRect(mask, 10, 15, 4, 4, 'B')
      paintRect(mask, 18, 15, 4, 4, 'B')
      paintRect(mask, 13, 11, 7, 3, 'A')
      paintRect(mask, 15, 8, 3, 3, 'D')
      paintRect(mask, 14, 19, 5, 1, 'M')
      return mask
    }
    case 'mochila': {
      paintRect(mask, 9, 8, 14, 15, 'B')
      paintRect(mask, 9, 8, 14, 4, 'D')
      paintRect(mask, 12, 15, 8, 6, 'D')
      paintRect(mask, 15, 12, 3, 2, 'M')
      paintRect(mask, 6, 10, 2, 9, 'M')
      paintRect(mask, 24, 10, 2, 9, 'M')
      paintRect(mask, 14, 5, 4, 3, 'M')
      paintRect(mask, 13, 17, 6, 1, 'A')
      return mask
    }
    case 'seringa': {
      paintRect(mask, 8, 12, 12, 6, 'B')
      paintRect(mask, 9, 13, 8, 4, 'A')
      paintRect(mask, 19, 11, 3, 8, 'M')
      paintRect(mask, 21, 14, 2, 2, 'B')
      paintRect(mask, 22, 14, 7, 2, 'M')
      for (let index = 0; index < 3; index += 1) {
        paintRect(mask, 11 + index * 2, 13, 1, 1, 'M')
      }
      paintRect(mask, 8, 13, 1, 4, 'D')
      return mask
    }
    case 'kit': {
      paintRect(mask, 7, 11, 18, 12, 'B')
      paintRect(mask, 7, 11, 18, 3, 'D')
      paintRect(mask, 13, 8, 6, 3, 'M')
      paintRect(mask, 14, 9, 4, 1, 'B')
      paintRect(mask, 14, 14, 4, 7, 'A')
      paintRect(mask, 11, 16, 10, 3, 'A')
      paintRect(mask, 7, 22, 18, 1, 'M')
      return mask
    }
    case 'chave': {
      paintRing(mask, 11, 15, 6, 3, 'M')
      paintRect(mask, 17, 14, 10, 3, 'B')
      paintRect(mask, 24, 17, 2, 3, 'B')
      paintRect(mask, 20, 17, 2, 2, 'B')
      paintRect(mask, 26, 17, 2, 4, 'B')
      paintRect(mask, 18, 14, 8, 1, 'D')
      return mask
    }
    case 'especial':
    default: {
      const center = 15
      for (let index = 0; index < 8; index += 1) {
        paintRect(mask, center - index, 9 + index, 2 + index * 2, 1, 'B')
      }
      for (let index = 0; index < 8; index += 1) {
        paintRect(mask, center - 7 + index, 17 + index, 16 - index * 2, 1, 'B')
      }
      paintRect(mask, 14, 12, 4, 4, 'A')
      paintRect(mask, 15, 13, 2, 2, 'M')
      paintRect(mask, 8, 8, 1, 1, 'A')
      paintRect(mask, 24, 10, 1, 1, 'A')
      paintRect(mask, 22, 22, 1, 1, 'A')
      return mask
    }
  }
}

function hash01(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function parseColor(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [
    Number.parseInt(clean.slice(0, 2), 16) || 0,
    Number.parseInt(clean.slice(2, 4), 16) || 0,
    Number.parseInt(clean.slice(4, 6), 16) || 0
  ]
}

/** Grade de cores (string | null) do ícone antes da ampliação. */
export function renderItemGrid(spec: ItemSpec): Array<string | null> {
  const mask = buildMask(spec.category)
  const rarity = itemRarityById(spec.rarity)
  const wear = Math.max(0, 1 - spec.attributes.durabilidade / 100)
  const colors: Array<string | null> = Array.from({ length: LOGICAL * LOGICAL }, () => null)

  for (let y = 0; y < LOGICAL; y += 1) {
    for (let x = 0; x < LOGICAL; x += 1) {
      const code = mask[y * LOGICAL + x] ?? null
      if (!code) continue

      let color: string
      if (code === 'M') color = '#2b3038'
      else if (code === 'A') color = spec.colors.secundaria
      else if (code === 'D') color = shade(spec.colors.primaria, -0.32)
      else color = y % 4 === 0 ? shade(spec.colors.primaria, -0.08) : spec.colors.primaria

      // Marcas de uso proporcionais à durabilidade perdida.
      if (code !== 'A' && wear > 0 && hash01(x, y, spec.seed + 41) < wear * 0.45) {
        color = shade(color, -0.55)
      }

      colors[y * LOGICAL + x] = color
    }
  }

  // Faixa de raridade na base do ícone.
  for (let x = 4; x <= 27; x += 1) {
    colors[30 * LOGICAL + x] = rarity.color
  }

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

export function renderItemPixels(spec: ItemSpec): {
  width: number
  height: number
  pixels: Uint8Array
} {
  const grid = renderItemGrid(spec)
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

export function renderItemPng(spec: ItemSpec): Buffer {
  const rendered = renderItemPixels(spec)
  return encodePng(rendered.width, rendered.height, rendered.pixels)
}

/** Pré-visualização do ícone (nada é gravado). */
export async function previewItem(input: ItemSpec): Promise<ItemPreview> {
  const spec = validateItemSpec(input)
  return { icon: toDataUrl(renderItemPng(spec)), width: spec.size, height: spec.size }
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

/** Grava o ícone e a ficha do item. */
export async function saveItem(projectId: string, input: ItemSpec): Promise<ItemAsset> {
  const spec = validateItemSpec(input)
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
  writeFileSync(join(folder, iconName), renderItemPng(spec))

  const rarity = itemRarityById(spec.rarity)
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const relevant = ITEM_CATEGORY_ATTRIBUTES[spec.category]

  const ficha = {
    formato: 1,
    id,
    geradoPor: 'Pixel Strike Studio',
    geradoEm: createdAt,
    nome: spec.name,
    descricao: spec.description,
    categoria: spec.category,
    categoriaNome: ITEM_CATEGORY_LABELS[spec.category],
    raridade: spec.rarity,
    raridadeNome: rarity.label,
    raridadeCor: rarity.color,
    atributos: spec.attributes,
    atributosDaCategoria: relevant,
    resumo: describeItem(spec),
    cores: spec.colors,
    semente: spec.seed,
    tamanho: spec.size,
    arquivos: { icone: iconName }
  }

  const jsonName = `${slug}.json`
  writeFileSync(join(folder, jsonName), `${JSON.stringify(ficha, null, 2)}\n`, 'utf8')

  const jsonPath = `${FOLDER}/${slug}/${jsonName}`
  const iconPath = `${FOLDER}/${slug}/${iconName}`

  const data = JSON.stringify({
    folder: `${FOLDER}/${slug}`,
    category: spec.category,
    categoryLabel: ITEM_CATEGORY_LABELS[spec.category],
    rarity: spec.rarity,
    rarityLabel: rarity.label,
    attributes: spec.attributes,
    size: spec.size,
    seed: spec.seed,
    iconPath,
    spec
  })

  await execute(
    `INSERT INTO assets (id, project_id, kind, name, origin, relative_path, data, created_at, updated_at)
     VALUES (?, ?, 'item', ?, 'gerado', ?, ?, ?, ?)`,
    [id, projectId, spec.name, jsonPath, data, createdAt, createdAt]
  )

  await logActivity(
    projectId,
    'item.criado',
    `Item "${spec.name}" (${ITEM_CATEGORY_LABELS[spec.category]}, ${rarity.label}) gerado em ${FOLDER}/${slug}.`
  )

  return {
    id,
    projectId,
    name: spec.name,
    folder: `${FOLDER}/${slug}`,
    jsonPath,
    iconPath,
    category: spec.category,
    categoryLabel: ITEM_CATEGORY_LABELS[spec.category],
    rarity: spec.rarity,
    rarityLabel: rarity.label,
    attributes: spec.attributes,
    size: spec.size,
    seed: spec.seed,
    createdAt,
    spec
  }
}

interface ItemRow {
  id: string
  project_id: string
  name: string
  relative_path: string
  data: string
  created_at: string
}

function toItemAsset(row: ItemRow): ItemAsset | null {
  try {
    const parsed = JSON.parse(row.data) as {
      folder: string
      category: ItemCategory
      categoryLabel: string
      rarity: ItemRarity
      rarityLabel: string
      attributes: ItemSpec['attributes']
      size: number
      seed: number
      iconPath: string
      spec: ItemSpec
    }
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      folder: parsed.folder,
      jsonPath: row.relative_path,
      iconPath: parsed.iconPath,
      category: parsed.category,
      categoryLabel: parsed.categoryLabel,
      rarity: parsed.rarity,
      rarityLabel: parsed.rarityLabel,
      attributes: parsed.attributes,
      size: parsed.size,
      seed: parsed.seed,
      createdAt: row.created_at,
      spec: parsed.spec
    }
  } catch {
    return null
  }
}

/** Lista os itens salvos no projeto. */
export async function listItems(projectId: string): Promise<ItemAsset[]> {
  const rows = await queryAll<ItemRow>(
    `SELECT id, project_id, name, relative_path, data, created_at
     FROM assets WHERE project_id = ? AND kind = 'item' ORDER BY created_at DESC`,
    [projectId]
  )
  return rows.map(toItemAsset).filter((asset): asset is ItemAsset => asset !== null)
}

/** Move a pasta do item para a lixeira e remove o registro. */
export async function removeItem(assetId: string): Promise<void> {
  const row = await queryOne<ItemRow>(
    'SELECT id, project_id, name, relative_path, data, created_at FROM assets WHERE id = ?',
    [assetId]
  )
  if (!row) throw new Error('Este item não existe mais.')

  const asset = toItemAsset(row)
  const project = await getProject(row.project_id)

  if (asset && project.folderExists) {
    const folder = join(project.path, asset.folder)
    if (isDirectory(folder)) {
      if (!trashDir) throw new Error('A lixeira do Studio não está configurada.')
      moveToTrash(folder, trashDir, `${timestampSlug(new Date())}_${slugify(asset.name)}`)
    }
  }

  await execute('DELETE FROM assets WHERE id = ?', [assetId])
  await logActivity(row.project_id, 'item.removido', `Item "${row.name}" movido para a lixeira.`)
}

/** Interpreta a descrição do item por palavras-chave (sem IA nesta etapa). */
export function interpretItemDescription(description: string): ItemSuggestion {
  return interpretItem(description)
}
