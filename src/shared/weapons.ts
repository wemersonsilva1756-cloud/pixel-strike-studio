/**
 * Armas e skins (etapa 6).
 *
 * Raridade e condição de desgaste são **campos separados**: a raridade diz o
 * quão rara a skin é (azul, roxo, rosa, vermelho, dourado, Blue Gem) e a
 * condição diz o quanto a arma está gasta (float de 0 a 1). Nenhuma das duas
 * altera a outra.
 */

export type WeaponClass = 'rifle' | 'sniper' | 'pistola' | 'smg' | 'faca'

export const WEAPON_CLASSES: WeaponClass[] = ['rifle', 'sniper', 'pistola', 'smg', 'faca']

export const WEAPON_CLASS_LABELS: Record<WeaponClass, string> = {
  rifle: 'Fuzil',
  sniper: 'Sniper',
  pistola: 'Pistola',
  smg: 'Submetralhadora',
  faca: 'Faca'
}

export interface WeaponStats {
  dano: number
  cadencia: number
  precisao: number
  alcance: number
}

export interface WeaponBase {
  id: string
  label: string
  classId: WeaponClass
  ammo: string
  description: string
  stats: WeaponStats
}

export const WEAPON_BASES: WeaponBase[] = [
  {
    id: 'ak47',
    label: 'AK-47',
    classId: 'rifle',
    ammo: '7,62 mm',
    description: 'Fuzil pesado, dano alto e recuo forte.',
    stats: { dano: 36, cadencia: 600, precisao: 79, alcance: 220 }
  },
  {
    id: 'm4a4',
    label: 'M4A4',
    classId: 'rifle',
    ammo: '5,56 mm',
    description: 'Fuzil equilibrado, fácil de controlar.',
    stats: { dano: 33, cadencia: 666, precisao: 88, alcance: 210 }
  },
  {
    id: 'awp',
    label: 'AWP',
    classId: 'sniper',
    ammo: '.338',
    description: 'Sniper de tiro único com luneta.',
    stats: { dano: 115, cadencia: 41, precisao: 97, alcance: 300 }
  },
  {
    id: 'desert-eagle',
    label: 'Desert Eagle',
    classId: 'pistola',
    ammo: '.50 AE',
    description: 'Pistola pesada, dois tiros certeiros.',
    stats: { dano: 63, cadencia: 267, precisao: 93, alcance: 160 }
  },
  {
    id: 'glock',
    label: 'Glock-18',
    classId: 'pistola',
    ammo: '9 mm',
    description: 'Pistola leve de reserva, cadência alta.',
    stats: { dano: 30, cadencia: 400, precisao: 80, alcance: 130 }
  },
  {
    id: 'usp-s',
    label: 'USP-S',
    classId: 'pistola',
    ammo: '.45 ACP',
    description: 'Pistola silenciada e precisa.',
    stats: { dano: 35, cadencia: 352, precisao: 92, alcance: 150 }
  },
  {
    id: 'mp5',
    label: 'MP5-SD',
    classId: 'smg',
    ammo: '9 mm',
    description: 'Submetralhadora silenciada, controle fácil.',
    stats: { dano: 27, cadencia: 750, precisao: 85, alcance: 120 }
  },
  {
    id: 'p90',
    label: 'P90',
    classId: 'smg',
    ammo: '5,7 mm',
    description: 'Submetralhadora com carregador grande.',
    stats: { dano: 26, cadencia: 857, precisao: 80, alcance: 110 }
  },
  {
    id: 'faca',
    label: 'Faca',
    classId: 'faca',
    ammo: '—',
    description: 'Corpo a corpo: dano alto de perto.',
    stats: { dano: 55, cadencia: 120, precisao: 0, alcance: 32 }
  }
]

export function weaponBaseById(id: string): WeaponBase {
  return WEAPON_BASES.find((base) => base.id === id) ?? (WEAPON_BASES[0] as WeaponBase)
}

/* ---------------------------------------------------------------- raridade */

export type Rarity = 'azul' | 'roxo' | 'rosa' | 'vermelho' | 'dourado' | 'bluegem'

export const RARITIES: Array<{ id: Rarity; label: string; short: string; color: string; hint: string }> = [
  { id: 'azul', label: 'Azul', short: 'Comum', color: '#4b69ff', hint: 'Skin comum de mercado.' },
  { id: 'roxo', label: 'Roxo', short: 'Raro', color: '#8847ff', hint: 'Skin rara.' },
  { id: 'rosa', label: 'Rosa', short: 'Muito raro', color: '#d32ce6', hint: 'Skin muito rara.' },
  { id: 'vermelho', label: 'Vermelho', short: 'Raro especial', color: '#eb4b4b', hint: 'Skin de coleção especial.' },
  { id: 'dourado', label: 'Dourado', short: 'Contrabando', color: '#ffd700', hint: 'Item de contrabando, fora das caixas.' },
  { id: 'bluegem', label: 'Blue Gem', short: 'Padrão lendário', color: '#22d3ee', hint: 'Padrão raro de fábrica (case hardened).' }
]

export function rarityById(id: string): (typeof RARITIES)[number] {
  return RARITIES.find((rarity) => rarity.id === id) ?? (RARITIES[0] as (typeof RARITIES)[number])
}

/* --------------------------------------------------------------- condição */

export type Wear = 'nova' | 'pouco-usada' | 'testada' | 'desgastada' | 'bem-desgastada'

export const WEARS: Array<{ id: Wear; label: string; min: number; max: number; hint: string }> = [
  { id: 'nova', label: 'Nova de fábrica', min: 0, max: 0.07, hint: 'Sem marcas de uso.' },
  { id: 'pouco-usada', label: 'Pouco usada', min: 0.07, max: 0.15, hint: 'Poucas marcas.' },
  { id: 'testada', label: 'Testada em combate', min: 0.15, max: 0.38, hint: 'Marcas visíveis de uso.' },
  { id: 'desgastada', label: 'Desgastada', min: 0.38, max: 0.45, hint: 'Pintura bem riscada.' },
  { id: 'bem-desgastada', label: 'Bem desgastada', min: 0.45, max: 1, hint: 'Pintura quase toda gasta.' }
]

export function wearById(id: string): (typeof WEARS)[number] {
  return WEARS.find((wear) => wear.id === id) ?? (WEARS[0] as (typeof WEARS)[number])
}

/** Condição correspondente a um float. */
export function wearForFloat(value: number): (typeof WEARS)[number] {
  const float = Math.max(0, Math.min(1, value))
  return WEARS.find((wear) => float >= wear.min && float < wear.max) ?? (WEARS[WEARS.length - 1] as (typeof WEARS)[number])
}

/* ---------------------------------------------------------------- padrões */

export type SkinPattern = 'solido' | 'listras' | 'camuflado' | 'digital' | 'gradiente' | 'chamas'

export const SKIN_PATTERNS: Array<{ id: SkinPattern; label: string; hint: string }> = [
  { id: 'solido', label: 'Cor sólida', hint: 'Uma cor uniforme com leve sombreado.' },
  { id: 'listras', label: 'Listras', hint: 'Faixas diagonais entre as duas cores.' },
  { id: 'camuflado', label: 'Camuflado', hint: 'Manchas irregulares em três tons.' },
  { id: 'digital', label: 'Digital', hint: 'Blocos pequenos, estilo camuflagem digital.' },
  { id: 'gradiente', label: 'Gradiente', hint: 'Transição suave entre as duas cores.' },
  { id: 'chamas', label: 'Chamas', hint: 'Chamas estilizadas na cor secundária.' }
]

export const PATTERN_LABELS: Record<SkinPattern, string> = {
  solido: 'Cor sólida',
  listras: 'Listras',
  camuflado: 'Camuflado',
  digital: 'Digital',
  gradiente: 'Gradiente',
  chamas: 'Chamas'
}

/* ------------------------------------------------------------------- tipos */

export interface WeaponSpec {
  baseId: string
  name: string
  rarity: Rarity
  wear: Wear
  /** Desgaste de 0 (impecável) a 1 (destruída). Sempre dentro da faixa da condição. */
  float: number
  pattern: SkinPattern
  /** Cor principal e cor secundária da skin. */
  colors: { primaria: string; secundaria: string }
  seed: number
  size: 32 | 64 | 96
}

export interface WeaponAsset {
  id: string
  projectId: string
  name: string
  folder: string
  jsonPath: string
  iconPath: string
  variationsPath: string
  baseId: string
  baseLabel: string
  classId: WeaponClass
  rarity: Rarity
  rarityLabel: string
  wear: Wear
  wearLabel: string
  float: number
  pattern: SkinPattern
  size: number
  seed: number
  createdAt: string
  spec: WeaponSpec
}

export interface WeaponPreview {
  icon: string
  width: number
  height: number
}

export interface WeaponComparison {
  image: string
  columns: number
  width: number
  height: number
  labels: string[]
}

export interface WeaponSuggestion {
  baseId: string | null
  rarity: Rarity | null
  pattern: SkinPattern | null
  colors: { primaria: string; secundaria: string } | null
  matches: string[]
}

/* ---------------------------------------------------------------- padrões de cor */

const PATTERN_COLORS: Record<SkinPattern, { primaria: string; secundaria: string }> = {
  solido: { primaria: '#3b82f6', secundaria: '#1e293b' },
  listras: { primaria: '#f97316', secundaria: '#111827' },
  camuflado: { primaria: '#4d7c0f', secundaria: '#3f2f1d' },
  digital: { primaria: '#0ea5e9', secundaria: '#0f172a' },
  gradiente: { primaria: '#a855f7', secundaria: '#22d3ee' },
  chamas: { primaria: '#dc2626', secundaria: '#facc15' }
}

export function defaultColors(pattern: SkinPattern): { primaria: string; secundaria: string } {
  const colors = PATTERN_COLORS[pattern]
  return { ...colors }
}

/** Nome sugerido para a skin (o usuário pode trocar). */
export function defaultWeaponName(baseId: string, rarity: Rarity, wear: Wear, pattern: SkinPattern): string {
  const base = weaponBaseById(baseId)
  return `${base.label} ${PATTERN_LABELS[pattern]} · ${rarityById(rarity).short} (${wearById(wear).label})`
}

export function defaultWeaponSpec(baseId = 'ak47'): WeaponSpec {
  return {
    baseId,
    name: defaultWeaponName(baseId, 'azul', 'nova', 'solido'),
    rarity: 'azul',
    wear: 'nova',
    float: 0.05,
    pattern: 'solido',
    colors: defaultColors('solido'),
    seed: 1234,
    size: 64
  }
}

/* -------------------------------------------------------------- descrição */

/** Interpreta uma descrição por palavras-chave (sem IA nesta etapa). */
export function interpretWeapon(description: string): WeaponSuggestion {
  const text = description.toLowerCase()
  const suggestion: WeaponSuggestion = {
    baseId: null,
    rarity: null,
    pattern: null,
    colors: null,
    matches: []
  }

  const baseRules: Array<{ words: string[]; baseId: string }> = [
    { words: ['ak', 'ak-47', 'ak47', 'kalash'], baseId: 'ak47' },
    { words: ['m4', 'm4a4', 'carabina'], baseId: 'm4a4' },
    { words: ['awp', 'sniper', 'luneta', 'ceifadora'], baseId: 'awp' },
    { words: ['desert eagle', 'deagle', 'águia'], baseId: 'desert-eagle' },
    { words: ['glock', 'glock-18'], baseId: 'glock' },
    { words: ['usp', 'silenciada', 'silenciador'], baseId: 'usp-s' },
    { words: ['mp5', 'submetralhadora', 'smg'], baseId: 'mp5' },
    { words: ['p90'], baseId: 'p90' },
    { words: ['faca', 'punhal', 'lâmina', 'lamina'], baseId: 'faca' }
  ]

  for (const rule of baseRules) {
    const hit = rule.words.find((word) => text.includes(word))
    if (hit) {
      suggestion.baseId = rule.baseId
      suggestion.matches.push(hit)
      break
    }
  }

  const rarityRules: Array<{ words: string[]; rarity: Rarity }> = [
    { words: ['blue gem', 'bluegem', 'case hardened'], rarity: 'bluegem' },
    { words: ['dourad', 'ouro'], rarity: 'dourado' },
    { words: ['vermelh', 'sangue'], rarity: 'vermelho' },
    { words: ['rosa', 'neon'], rarity: 'rosa' },
    { words: ['roxo', 'violeta'], rarity: 'roxo' },
    { words: ['azul'], rarity: 'azul' }
  ]
  for (const rule of rarityRules) {
    const hit = rule.words.find((word) => text.includes(word))
    if (hit) {
      suggestion.rarity = rule.rarity
      suggestion.matches.push(hit)
      break
    }
  }

  const patternRules: Array<{ words: string[]; pattern: SkinPattern }> = [
    { words: ['chama', 'fogo', 'dragão', 'dragao'], pattern: 'chamas' },
    { words: ['camuflad', 'militar', 'selva'], pattern: 'camuflado' },
    { words: ['digital', 'pixel', 'hacker'], pattern: 'digital' },
    { words: ['gradiente', 'aurora', 'arco-íris', 'arco iris', 'neon'], pattern: 'gradiente' },
    { words: ['listra', 'faixa', 'zebra'], pattern: 'listras' },
    { words: ['sólid', 'solid', 'lisa', 'simples'], pattern: 'solido' }
  ]
  for (const rule of patternRules) {
    const hit = rule.words.find((word) => text.includes(word))
    if (hit) {
      suggestion.pattern = rule.pattern
      suggestion.matches.push(hit)
      break
    }
  }

  if (suggestion.pattern) suggestion.colors = defaultColors(suggestion.pattern)

  return suggestion
}
