/**
 * Construtor de mapas (etapa 5).
 *
 * O mapa é uma grade de tiles com uma camada de colisão, retângulos de zona
 * (área segura, PvP, inimigos, objetivo e área secreta) e pontos de spawn.
 * Tudo é determinístico: mesma semente + mesma configuração = mesmo mapa.
 */

/* ------------------------------------------------------------------ tiles */

export const TILE_KINDS = [
  'grama',
  'terra',
  'areia',
  'pedra',
  'agua',
  'parede',
  'estrada',
  'madeira'
] as const

export type TileKind = (typeof TILE_KINDS)[number]

export const TILE_LABELS: Record<TileKind, string> = {
  grama: 'Vegetação',
  terra: 'Terra',
  areia: 'Areia',
  pedra: 'Pedra',
  agua: 'Água',
  parede: 'Parede',
  estrada: 'Estrada',
  madeira: 'Madeira'
}

export const TILE_HINTS: Record<TileKind, string> = {
  grama: 'Terreno com vegetação baixa. Livre para caminhar.',
  terra: 'Chão batido, bom para trilhas.',
  areia: 'Areia clara de deserto ou praia.',
  pedra: 'Piso de pedra, usado em bases e ruínas.',
  agua: 'Bloqueia a passagem por padrão.',
  parede: 'Parede sólida: sempre bloqueia.',
  estrada: 'Asfalto ou caminho principal.',
  madeira: 'Piso de tábuas, comum em interiores.'
}

/** Tiles que bloqueiam a passagem quando aplicados (a camada de colisão pode ser editada). */
export const TILE_SOLID: Record<TileKind, boolean> = {
  grama: false,
  terra: false,
  areia: false,
  pedra: false,
  agua: true,
  parede: true,
  estrada: false,
  madeira: false
}

/* ------------------------------------------------------------------ zonas */

export type ZoneKind = 'segura' | 'pvp' | 'inimigo' | 'objetivo' | 'secreta'

export const ZONE_KINDS: ZoneKind[] = ['segura', 'pvp', 'inimigo', 'objetivo', 'secreta']

export const ZONE_LABELS: Record<ZoneKind, string> = {
  segura: 'Área segura',
  pvp: 'Área PvP',
  inimigo: 'Área de inimigos',
  objetivo: 'Objetivo',
  secreta: 'Área secreta'
}

/** Cor usada na sobreposição da grade e nas áreas exportadas para a Godot. */
export const ZONE_COLORS: Record<ZoneKind, string> = {
  segura: '#34d399',
  pvp: '#f87171',
  inimigo: '#fbbf24',
  objetivo: '#60a5fa',
  secreta: '#c084fc'
}

/* ------------------------------------------------------------------ spawns */

export type SpawnKind = 'jogador' | 'inimigo' | 'item'

export const SPAWN_KINDS: SpawnKind[] = ['jogador', 'inimigo', 'item']

export const SPAWN_LABELS: Record<SpawnKind, string> = {
  jogador: 'Jogador',
  inimigo: 'Inimigo',
  item: 'Item'
}

export const SPAWN_COLORS: Record<SpawnKind, string> = {
  jogador: '#38bdf8',
  inimigo: '#fb7185',
  item: '#facc15'
}

/* ------------------------------------------------------------------ temas */

export interface MapTheme {
  id: string
  label: string
  hint: string
  /** Cor base de cada tipo de tile neste tema. */
  tiles: Record<TileKind, string>
  /** Peso de cada tile na geração do terreno. */
  weights: Partial<Record<TileKind, number>>
}

export const MAP_THEMES: MapTheme[] = [
  {
    id: 'militar',
    label: 'Base militar',
    hint: 'Grama seca, terra batida, concreto e estradas de serviço.',
    tiles: {
      grama: '#455f38',
      terra: '#5b4a34',
      areia: '#8a7a52',
      pedra: '#5c6068',
      agua: '#2c4a63',
      parede: '#3a3f47',
      estrada: '#6b6152',
      madeira: '#5a4632'
    },
    weights: { grama: 0.48, terra: 0.22, pedra: 0.14, estrada: 0.11, agua: 0.05 }
  },
  {
    id: 'deserto',
    label: 'Deserto',
    hint: 'Dunas claras, rochas e pequenos oásis.',
    tiles: {
      grama: '#6f7f45',
      terra: '#8d6f45',
      areia: '#c2a76a',
      pedra: '#9a8b70',
      agua: '#2f6f7f',
      parede: '#8a7355',
      estrada: '#b09a6d',
      madeira: '#7a5a38'
    },
    weights: { areia: 0.55, terra: 0.2, pedra: 0.15, agua: 0.05, grama: 0.05 }
  },
  {
    id: 'neve',
    label: 'Neve',
    hint: 'Neve fofa, gelo, rocha exposta e água congelada.',
    tiles: {
      grama: '#dfe7ef',
      terra: '#9aa7b4',
      areia: '#cfd8e2',
      pedra: '#7d8794',
      agua: '#3d6f8f',
      parede: '#5d6672',
      estrada: '#8e99a6',
      madeira: '#6b533d'
    },
    weights: { grama: 0.55, pedra: 0.2, agua: 0.15, terra: 0.1 }
  },
  {
    id: 'floresta',
    label: 'Floresta',
    hint: 'Mata fechada, trilhas de terra, córregos e clareiras.',
    tiles: {
      grama: '#2f4a2c',
      terra: '#4a3a28',
      areia: '#6f6446',
      pedra: '#4f5751',
      agua: '#25455c',
      parede: '#2a3330',
      estrada: '#5c5344',
      madeira: '#5f4630'
    },
    weights: { grama: 0.62, terra: 0.16, agua: 0.12, madeira: 0.05, pedra: 0.05 }
  },
  {
    id: 'cidade',
    label: 'Cidade',
    hint: 'Ruas de asfalto, calçadas, prédios e pequenos terrenos.',
    tiles: {
      grama: '#4a5a3c',
      terra: '#5a4f42',
      areia: '#7d7466',
      pedra: '#6a6f76',
      agua: '#2b4658',
      parede: '#4a4f55',
      estrada: '#3f444a',
      madeira: '#5b4633'
    },
    weights: { estrada: 0.35, pedra: 0.3, parede: 0.15, grama: 0.12, terra: 0.08 }
  }
]

export function themeById(id: string): MapTheme {
  return MAP_THEMES.find((theme) => theme.id === id) ?? (MAP_THEMES[0] as MapTheme)
}

/** Cor de um tile no tema (usada pela grade da interface). */
export function tileColor(themeId: string, kind: TileKind | null): string {
  if (!kind) return '#0b1120'
  return themeById(themeId).tiles[kind]
}

/* ------------------------------------------------------------------ limites */

export const DEFAULT_MAP_WIDTH = 32
export const DEFAULT_MAP_HEIGHT = 20
export const DEFAULT_MAP_TILE_SIZE = 16
export const MIN_MAP_SIZE = 8
export const MAX_MAP_SIZE = 64
export const MIN_TILE_SIZE = 8
export const MAX_TILE_SIZE = 32
/** Limite de pixels por lado na imagem renderizada (evita imagens gigantes). */
export const MAX_MAP_PIXELS = 2048

/* ------------------------------------------------------------------ estruturas */

export interface MapZone {
  id: string
  kind: ZoneKind
  name: string
  x: number
  y: number
  w: number
  h: number
}

export interface MapSpawn {
  id: string
  kind: SpawnKind
  name: string
  x: number
  y: number
}

export interface MapConfig {
  name: string
  description: string
  themeId: string
  /** Largura em tiles. */
  width: number
  /** Altura em tiles. */
  height: number
  /** Tamanho de cada tile em pixels na imagem exportada. */
  tileSize: number
  seed: number
  /** Um tile por célula, na ordem das linhas (null = vazio). */
  tiles: Array<TileKind | null>
  /** Um valor por célula: true = bloqueado. */
  collision: boolean[]
  zones: MapZone[]
  spawns: MapSpawn[]
}

export interface MapDraft {
  name: string
  description: string
  themeId: string
  width: number
  height: number
  tileSize: number
  seed: number
}

export interface MapAsset {
  id: string
  projectId: string
  name: string
  folder: string
  jsonPath: string
  imagePath: string
  tilesetPath: string
  scenePath: string
  themeId: string
  width: number
  height: number
  tileSize: number
  zoneCount: number
  spawnCount: number
  solidCount: number
  createdAt: string
}

export interface MapPreview {
  image: string
  tileset: string
  width: number
  height: number
}

/* ------------------------------------------------------------------ geração */

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.round(value)))
}

/** Reconhece o tema por palavras-chave da descrição. */
export function detectTheme(description: string): string {
  const text = description.toLowerCase()
  if (/(deserto|areia|duna|oasis|oásis|seco|árido|arido)/.test(text)) return 'deserto'
  if (/(neve|gelo|inverno|frio|montanha gelada|ártic|artic)/.test(text)) return 'neve'
  if (/(floresta|selva|mata|bosque|jungla|vegeta)/.test(text)) return 'floresta'
  if (/(cidade|urbano|prédio|predio|rua|asfalto|metrópole|metropole)/.test(text)) return 'cidade'
  return 'militar'
}

/** Hash determinístico de uma célula (0 a 1). */
function hash01(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Ruído suave em uma grade de 4x4 células, usado para formar manchas de terreno. */
function smoothNoise(x: number, y: number, seed: number): number {
  const gx = x / 4
  const gy = y / 4
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const fx = gx - x0
  const fy = gy - y0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)

  const a = hash01(x0, y0, seed)
  const b = hash01(x0 + 1, y0, seed)
  const c = hash01(x0, y0 + 1, seed)
  const d = hash01(x0 + 1, y0 + 1, seed)
  const top = a + (b - a) * sx
  const bottom = c + (d - c) * sx
  return top + (bottom - top) * sy
}

function pickTile(weights: Array<{ kind: TileKind; weight: number }>, value: number): TileKind {
  const total = weights.reduce((sum, item) => sum + item.weight, 0)
  let cursor = value * total
  for (const item of weights) {
    cursor -= item.weight
    if (cursor <= 0) return item.kind
  }
  return weights[weights.length - 1]?.kind ?? 'grama'
}

export function emptyMapGrid(width: number, height: number): {
  tiles: Array<TileKind | null>
  collision: boolean[]
} {
  const total = width * height
  return { tiles: Array.from({ length: total }, () => null), collision: Array.from({ length: total }, () => false) }
}

/**
 * Propõe um mapa completo a partir de um rascunho (nome, descrição, tamanho e
 * semente). O resultado é sempre editável na tela do construtor.
 */
export function proposeMap(draft: Partial<MapDraft>): MapConfig {
  const description = (draft.description ?? '').trim()
  const theme = themeById(
    draft.themeId && draft.themeId !== 'auto' ? draft.themeId : detectTheme(description)
  )
  const width = clampInt(draft.width ?? DEFAULT_MAP_WIDTH, MIN_MAP_SIZE, MAX_MAP_SIZE)
  const height = clampInt(draft.height ?? DEFAULT_MAP_HEIGHT, MIN_MAP_SIZE, MAX_MAP_SIZE)
  const tileSize = clampInt(draft.tileSize ?? DEFAULT_MAP_TILE_SIZE, MIN_TILE_SIZE, MAX_TILE_SIZE)
  const seed = Math.abs(Math.round(draft.seed ?? 1)) || 1

  const weights = (Object.entries(theme.weights) as Array<[TileKind, number]>)
    .map(([kind, weight]) => ({ kind, weight }))
    .sort((a, b) => a.kind.localeCompare(b.kind))

  const tiles: Array<TileKind | null> = []
  const collision: boolean[] = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const patch = smoothNoise(x, y, seed) * 0.7 + hash01(x, y, seed + 17) * 0.3
      let kind = pickTile(weights, patch)

      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1
      const roadRows = Math.abs(y - Math.floor(height / 2)) <= 1
      const roadCols = Math.abs(x - Math.floor(width / 2)) <= 1
      const pondCenterX = Math.floor(width * 0.72)
      const pondCenterY = Math.floor(height * 0.3)
      const inPond =
        (x - pondCenterX) ** 2 / 9 + (y - pondCenterY) ** 2 / 4 <= 1

      if (border) kind = 'parede'
      else if (roadRows || roadCols) kind = 'estrada'
      else if (inPond && patch > 0.35) kind = 'agua'

      tiles.push(kind)
      collision.push(TILE_SOLID[kind])
    }
  }

  const clampX = (value: number, size: number): number => Math.max(0, Math.min(width - size, value))
  const clampY = (value: number, size: number): number => Math.max(0, Math.min(height - size, value))

  const safeW = Math.max(3, Math.min(8, Math.floor(width / 4)))
  const safeH = Math.max(3, Math.min(6, Math.floor(height / 3)))
  const pvpW = Math.max(4, Math.min(width - 2, Math.floor(width * 0.45)))
  const pvpH = Math.max(4, Math.min(height - 2, Math.floor(height * 0.55)))

  const zones: MapZone[] = [
    {
      id: 'zona-segura',
      kind: 'segura',
      name: ZONE_LABELS.segura,
      x: clampX(1, safeW),
      y: clampY(1, safeH),
      w: safeW,
      h: safeH
    },
    {
      id: 'zona-pvp',
      kind: 'pvp',
      name: ZONE_LABELS.pvp,
      x: clampX(Math.floor((width - pvpW) / 2), pvpW),
      y: clampY(Math.floor((height - pvpH) / 2), pvpH),
      w: pvpW,
      h: pvpH
    },
    {
      id: 'zona-inimigos',
      kind: 'inimigo',
      name: ZONE_LABELS.inimigo,
      x: clampX(width - 8, 6),
      y: clampY(height - 7, 5),
      w: Math.min(6, width - 2),
      h: Math.min(5, height - 2)
    },
    {
      id: 'zona-secreta',
      kind: 'secreta',
      name: ZONE_LABELS.secreta,
      x: clampX(width - 6, 3),
      y: clampY(2, 3),
      w: 3,
      h: 3
    },
    {
      id: 'zona-objetivo',
      kind: 'objetivo',
      name: ZONE_LABELS.objetivo,
      x: clampX(Math.floor(width / 2) - 1, 2),
      y: clampY(Math.floor(height / 2) - 1, 2),
      w: 2,
      h: 2
    }
  ]

  const spawnSpots: Array<{ kind: SpawnKind; x: number; y: number }> = [
    { kind: 'jogador', x: 3, y: 3 },
    { kind: 'jogador', x: 3, y: height - 4 },
    { kind: 'inimigo', x: width - 4, y: 4 },
    { kind: 'inimigo', x: width - 4, y: height - 5 },
    { kind: 'inimigo', x: Math.floor(width / 2) + 3, y: Math.floor(height / 2) + 2 },
    { kind: 'item', x: Math.floor(width / 2), y: Math.floor(height / 3) }
  ]

  const spawns: MapSpawn[] = []
  const counters: Record<SpawnKind, number> = { jogador: 0, inimigo: 0, item: 0 }

  for (const spot of spawnSpots) {
    const x = Math.max(1, Math.min(width - 2, spot.x))
    const y = Math.max(1, Math.min(height - 2, spot.y))
    const index = y * width + x
    // Pontos de spawn ficam sempre em piso livre.
    if (tiles[index] === 'agua' || tiles[index] === 'parede' || tiles[index] === null) {
      tiles[index] = 'pedra'
      collision[index] = false
    }
    counters[spot.kind] += 1
    spawns.push({
      id: `spawn-${spot.kind}-${counters[spot.kind]}`,
      kind: spot.kind,
      name: `${SPAWN_LABELS[spot.kind]} ${counters[spot.kind]}`,
      x,
      y
    })
  }

  return {
    name: (draft.name ?? 'Mapa sem nome').trim() || 'Mapa sem nome',
    description,
    themeId: theme.id,
    width,
    height,
    tileSize,
    seed,
    tiles,
    collision,
    zones,
    spawns
  }
}
