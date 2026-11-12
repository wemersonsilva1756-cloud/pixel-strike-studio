/**
 * Itens e equipamentos (etapa 8).
 *
 * Cada item tem categoria, raridade e atributos próprios. A raridade é só uma
 * etiqueta visual (cor da faixa e da ficha) e nunca altera os atributos: um
 * colete raro continua sendo um colete com a armadura que você configurou.
 */

export type ItemCategory =
  | 'colete'
  | 'capacete'
  | 'mochila'
  | 'seringa'
  | 'kit'
  | 'chave'
  | 'especial'

export const ITEM_CATEGORIES: ItemCategory[] = [
  'colete',
  'capacete',
  'mochila',
  'seringa',
  'kit',
  'chave',
  'especial'
]

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  colete: 'Colete',
  capacete: 'Capacete',
  mochila: 'Mochila',
  seringa: 'Seringa',
  kit: 'Kit médico',
  chave: 'Chave / cartão',
  especial: 'Item especial'
}

export const ITEM_CATEGORY_HINTS: Record<ItemCategory, string> = {
  colete: 'Proteção do torso: reduz o dano recebido.',
  capacete: 'Proteção da cabeça: reduz dano crítico.',
  mochila: 'Aumenta os espaços de inventário.',
  seringa: 'Cura rápida de uso único.',
  kit: 'Cura maior, com tempo de uso.',
  chave: 'Abre portas, caixas ou cofres.',
  especial: 'Item de missão, colecionável ou troféu.'
}

export type ItemRarity = 'comum' | 'incomum' | 'raro' | 'epico' | 'lendario'

export const ITEM_RARITIES: Array<{
  id: ItemRarity
  label: string
  short: string
  color: string
  hint: string
}> = [
  { id: 'comum', label: 'Comum', short: 'Comum', color: '#94a3b8', hint: 'Item de uso diário.' },
  { id: 'incomum', label: 'Incomum', short: 'Incomum', color: '#22c55e', hint: 'Um pouco melhor que o comum.' },
  { id: 'raro', label: 'Raro', short: 'Raro', color: '#3b82f6', hint: 'Item difícil de achar.' },
  { id: 'epico', label: 'Épico', short: 'Épico', color: '#a855f7', hint: 'Item de destaque.' },
  { id: 'lendario', label: 'Lendário', short: 'Lendário', color: '#f59e0b', hint: 'Item único da temporada.' }
]

export function itemRarityById(id: string): (typeof ITEM_RARITIES)[number] {
  return ITEM_RARITIES.find((rarity) => rarity.id === id) ?? (ITEM_RARITIES[0] as (typeof ITEM_RARITIES)[number])
}

export interface ItemAttributes {
  /** Redução de dano de 0 a 100 (%). */
  armadura: number
  /** Espaços de inventário que o item adiciona. */
  capacidade: number
  /** Vida recuperada por uso. */
  cura: number
  /** Durabilidade de 0 a 100; abaixo disso o item mostra desgaste. */
  durabilidade: number
  /** Valor em créditos. */
  valor: number
}

export type ItemAttributeKey = keyof ItemAttributes

export const ITEM_ATTRIBUTE_LABELS: Record<ItemAttributeKey, string> = {
  armadura: 'Armadura (%)',
  capacidade: 'Capacidade (espaços)',
  cura: 'Cura (vida)',
  durabilidade: 'Durabilidade (%)',
  valor: 'Valor (créditos)'
}

export interface ItemAttributeRange {
  min: number
  max: number
  step: number
}

export const ITEM_ATTRIBUTE_RANGES: Record<ItemAttributeKey, ItemAttributeRange> = {
  armadura: { min: 0, max: 100, step: 1 },
  capacidade: { min: 0, max: 60, step: 1 },
  cura: { min: 0, max: 200, step: 5 },
  durabilidade: { min: 0, max: 100, step: 1 },
  valor: { min: 0, max: 100000, step: 10 }
}

/** Atributos que fazem sentido em cada categoria (os outros ficam zerados). */
export const ITEM_CATEGORY_ATTRIBUTES: Record<ItemCategory, ItemAttributeKey[]> = {
  colete: ['armadura', 'durabilidade', 'valor'],
  capacete: ['armadura', 'durabilidade', 'valor'],
  mochila: ['capacidade', 'durabilidade', 'valor'],
  seringa: ['cura', 'valor'],
  kit: ['cura', 'durabilidade', 'valor'],
  chave: ['valor'],
  especial: ['valor', 'durabilidade']
}

export const DEFAULT_ITEM_ATTRIBUTES: Record<ItemCategory, ItemAttributes> = {
  colete: { armadura: 60, capacidade: 0, cura: 0, durabilidade: 100, valor: 850 },
  capacete: { armadura: 40, capacidade: 0, cura: 0, durabilidade: 100, valor: 600 },
  mochila: { armadura: 0, capacidade: 12, cura: 0, durabilidade: 100, valor: 400 },
  seringa: { armadura: 0, capacidade: 0, cura: 40, durabilidade: 100, valor: 120 },
  kit: { armadura: 0, capacidade: 0, cura: 100, durabilidade: 100, valor: 300 },
  chave: { armadura: 0, capacidade: 0, cura: 0, durabilidade: 100, valor: 200 },
  especial: { armadura: 0, capacidade: 0, cura: 0, durabilidade: 100, valor: 5000 }
}

export const ITEM_CATEGORY_COLORS: Record<ItemCategory, { primaria: string; secundaria: string }> = {
  colete: { primaria: '#3f6212', secundaria: '#1c2a10' },
  capacete: { primaria: '#4d7c0f', secundaria: '#243013' },
  mochila: { primaria: '#92400e', secundaria: '#3f2f1d' },
  seringa: { primaria: '#e2e8f0', secundaria: '#22c55e' },
  kit: { primaria: '#f8fafc', secundaria: '#dc2626' },
  chave: { primaria: '#facc15', secundaria: '#3f3f46' },
  especial: { primaria: '#7c3aed', secundaria: '#22d3ee' }
}

export interface ItemSpec {
  category: ItemCategory
  name: string
  description: string
  rarity: ItemRarity
  attributes: ItemAttributes
  colors: { primaria: string; secundaria: string }
  seed: number
  size: 32 | 64 | 96
}

export interface ItemAsset {
  id: string
  projectId: string
  name: string
  folder: string
  jsonPath: string
  iconPath: string
  category: ItemCategory
  categoryLabel: string
  rarity: ItemRarity
  rarityLabel: string
  attributes: ItemAttributes
  size: number
  seed: number
  createdAt: string
  spec: ItemSpec
}

export interface ItemPreview {
  icon: string
  width: number
  height: number
}

export interface ItemSuggestion {
  category: ItemCategory | null
  rarity: ItemRarity | null
  attributes: Partial<ItemAttributes> | null
  matches: string[]
}

export function defaultItemSpec(category: ItemCategory = 'colete'): ItemSpec {
  return {
    category,
    name: ITEM_CATEGORY_LABELS[category],
    description: ITEM_CATEGORY_HINTS[category],
    rarity: 'comum',
    attributes: { ...DEFAULT_ITEM_ATTRIBUTES[category] },
    colors: { ...ITEM_CATEGORY_COLORS[category] },
    seed: 2024,
    size: 64
  }
}

/** Resumo legível dos atributos que importam para a categoria. */
export function describeItem(spec: ItemSpec): string {
  const parts: string[] = []
  for (const key of ITEM_CATEGORY_ATTRIBUTES[spec.category]) {
    const value = spec.attributes[key]
    if (!value) continue
    if (key === 'armadura') parts.push(`${value}% de armadura`)
    else if (key === 'capacidade') parts.push(`${value} espaços`)
    else if (key === 'cura') parts.push(`+${value} de vida`)
    else if (key === 'durabilidade') parts.push(`${value}% de durabilidade`)
    else if (key === 'valor') parts.push(`${value} créditos`)
  }
  return parts.join(' · ')
}

function clampAttribute(key: ItemAttributeKey, value: unknown): number {
  const range = ITEM_ATTRIBUTE_RANGES[key]
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return range.min
  return Math.min(range.max, Math.max(range.min, Math.round(numeric)))
}

/** Interpreta uma descrição por palavras-chave (sem IA nesta etapa). */
export function interpretItem(description: string): ItemSuggestion {
  const text = description.toLowerCase()
  const suggestion: ItemSuggestion = {
    category: null,
    rarity: null,
    attributes: null,
    matches: []
  }

  const categoryRules: Array<{ words: string[]; category: ItemCategory }> = [
    { words: ['kit', 'medkit', 'primeiros socorros'], category: 'kit' },
    { words: ['seringa', 'adrenalina', 'injeç', 'injec'], category: 'seringa' },
    { words: ['mochila', 'bolsa', 'inventário', 'inventario'], category: 'mochila' },
    { words: ['capacete', 'helmet', 'elmo'], category: 'capacete' },
    { words: ['colete', 'armadura', 'peitoral', 'kevlar'], category: 'colete' },
    { words: ['chave', 'cartão', 'cartao', 'keycard', 'cofre'], category: 'chave' },
    { words: ['especial', 'troféu', 'trofeu', 'colecion', 'lendári', 'lendari'], category: 'especial' }
  ]

  for (const rule of categoryRules) {
    const hit = rule.words.find((word) => text.includes(word))
    if (!hit) continue
    suggestion.category = rule.category
    suggestion.matches.push(hit)
    break
  }

  const rarityRules: Array<{ words: string[]; rarity: ItemRarity }> = [
    { words: ['lendári', 'lendari', 'único', 'unico'], rarity: 'lendario' },
    { words: ['épic', 'epic', 'roxo'], rarity: 'epico' },
    { words: ['raro', 'azul'], rarity: 'raro' },
    { words: ['incomum', 'verde'], rarity: 'incomum' },
    { words: ['comum', 'simples'], rarity: 'comum' }
  ]
  for (const rule of rarityRules) {
    const hit = rule.words.find((word) => text.includes(word))
    if (!hit) continue
    suggestion.rarity = rule.rarity
    suggestion.matches.push(hit)
    break
  }

  const attributes: Partial<ItemAttributes> = {}
  const numericRules: Array<{ key: ItemAttributeKey; words: string[] }> = [
    { key: 'armadura', words: ['armadura', 'proteç', 'protec'] },
    { key: 'capacidade', words: ['espaço', 'espaco', 'slot', 'capacidade'] },
    { key: 'cura', words: ['cura', 'vida', 'recuper'] },
    { key: 'durabilidade', words: ['durabilidade', 'resistência', 'resistencia'] },
    { key: 'valor', words: ['custa', 'valor', 'preço', 'preco', 'créditos', 'creditos'] }
  ]

  for (const rule of numericRules) {
    if (!rule.words.some((word) => text.includes(word))) continue
    const words = rule.words.join('|')
    // Aceita as duas ordens: “80 de armadura” e “cura 40”.
    const before = new RegExp(`(\\d+)\\s*(?:de\\s*|%\\s*)?(?:${words})`).exec(text)
    const after = new RegExp(`(?:${words})[^\\d]{0,12}(\\d+)`).exec(text)
    const match = before ?? after
    if (!match) continue
    attributes[rule.key] = clampAttribute(rule.key, Number(before ? match[1] : match[1]))
    suggestion.matches.push(match[0].trim())
  }

  if (Object.keys(attributes).length > 0) suggestion.attributes = attributes

  return suggestion
}
