/**
 * Tabelas de drops e economia (etapa 8).
 *
 * Uma tabela tem um modo:
 * - **exclusiva**: as chances precisam somar exatamente 100% (uma recompensa
 *   por abertura), como em caixas.
 * - **independente**: cada item rola sozinho; a soma pode passar de 100%.
 */

import { ITEM_RARITIES, itemRarityById, type ItemRarity } from './items'

export type DropSource = 'monstro' | 'caixa' | 'missao' | 'evento'

export const DROP_SOURCES: Array<{ id: DropSource; label: string; hint: string }> = [
  { id: 'monstro', label: 'Monstro', hint: 'Recompensa ao derrotar um inimigo.' },
  { id: 'caixa', label: 'Caixa / loot box', hint: 'Abertura de caixa com uma recompensa.' },
  { id: 'missao', label: 'Missão', hint: 'Prêmio ao concluir um objetivo.' },
  { id: 'evento', label: 'Evento', hint: 'Recompensa de evento ou temporada.' }
]

export function dropSourceLabel(id: string): string {
  return DROP_SOURCES.find((source) => source.id === id)?.label ?? 'Monstro'
}

export type DropMode = 'exclusiva' | 'independente'

export const DROP_MODE_LABELS: Record<DropMode, string> = {
  exclusiva: 'Exclusiva (soma 100%)',
  independente: 'Independente (cada item rola sozinho)'
}

export const DROP_MODE_HINTS: Record<DropMode, string> = {
  exclusiva: 'Uma recompensa por abertura: as chances precisam somar exatamente 100%.',
  independente: 'Cada item tem a sua chance; a soma pode passar de 100%.'
}

export interface DropEntry {
  id: string
  itemName: string
  rarity: ItemRarity
  /** Chance em porcentagem (0,01 a 100). */
  chance: number
  /** Quantidade mínima entregue. */
  min: number
  /** Quantidade máxima entregue. */
  max: number
}

export interface DropTableSpec {
  name: string
  description: string
  source: DropSource
  mode: DropMode
  /** Quantas vezes a tabela é aberta (usada na calculadora). */
  rolls: number
  entries: DropEntry[]
}

export interface DropTableAsset {
  id: string
  projectId: string
  name: string
  folder: string
  jsonPath: string
  scriptPath: string
  csvPath: string
  source: DropSource
  mode: DropMode
  entryCount: number
  totalChance: number
  createdAt: string
  spec: DropTableSpec
}

export interface DropEntryStat {
  id: string
  itemName: string
  rarity: ItemRarity
  chance: number
  /** Quantidade média esperada na quantidade de aberturas escolhida. */
  expected: number
  /** Probabilidade (0 a 1) de sair pelo menos uma vez. */
  atLeastOne: number
  min: number
  max: number
}

export interface DropTableStats {
  totalChance: number
  expectedItems: number
  rolls: number
  mode: DropMode
  valid: boolean
  problem: string | null
  entries: DropEntryStat[]
}

export const DROP_LIMITS = {
  minEntries: 1,
  maxEntries: 20,
  minRolls: 1,
  maxRolls: 20,
  minChance: 0.01,
  maxChance: 100
} as const

export function entryId(index: number): string {
  return `entrada-${index + 1}`
}

export const DEFAULT_DROP_TABLE: DropTableSpec = {
  name: 'Loot de inimigo comum',
  description: 'Recompensas simples ao derrotar um inimigo comum.',
  source: 'monstro',
  mode: 'exclusiva',
  rolls: 1,
  entries: [
    { id: 'entrada-1', itemName: 'Seringa', rarity: 'comum', chance: 50, min: 1, max: 2 },
    { id: 'entrada-2', itemName: 'Kit médico', rarity: 'incomum', chance: 35, min: 1, max: 1 },
    { id: 'entrada-3', itemName: 'Colete', rarity: 'raro', chance: 15, min: 1, max: 1 }
  ]
}

export function defaultDropTable(): DropTableSpec {
  return {
    ...DEFAULT_DROP_TABLE,
    entries: DEFAULT_DROP_TABLE.entries.map((entry) => ({ ...entry }))
  }
}

/** Soma das chances, arredondada para duas casas. */
export function chanceSum(entries: DropEntry[]): number {
  const total = entries.reduce((sum, entry) => sum + (Number(entry.chance) || 0), 0)
  return Math.round(total * 100) / 100
}

/** Reajusta as chances para somarem exatamente 100% (modo exclusivo). */
export function normalizeEntries(entries: DropEntry[]): DropEntry[] {
  if (entries.length === 0) return []
  const total = chanceSum(entries)
  if (total <= 0) {
    const each = Math.round((100 / entries.length) * 100) / 100
    return entries.map((entry, index) => ({
      ...entry,
      chance:
        index === entries.length - 1
          ? Math.round((100 - each * (entries.length - 1)) * 100) / 100
          : each
    }))
  }

  const scaled = entries.map((entry) => ({
    ...entry,
    chance: Math.round(((Number(entry.chance) || 0) / total) * 10000) / 100
  }))

  const sum = chanceSum(scaled)
  const last = scaled[scaled.length - 1]
  if (last) {
    last.chance = Math.round((last.chance + (100 - sum)) * 100) / 100
  }
  return scaled
}

/**
 * Calculadora de chances: usa a mesma matemática que o jogo, então o número
 * mostrado na interface é o que acontece de verdade.
 */
export function dropTableStats(spec: DropTableSpec): DropTableStats {
  const rolls = Math.max(DROP_LIMITS.minRolls, Math.min(DROP_LIMITS.maxRolls, Math.round(spec.rolls) || 1))
  const totalChance = chanceSum(spec.entries)
  const entries = spec.entries.map((entry) => {
    const chance = Math.max(0, Math.min(100, Number(entry.chance) || 0))
    const probability = chance / 100
    const average = ((Number(entry.min) || 1) + (Number(entry.max) || 1)) / 2
    return {
      id: entry.id,
      itemName: entry.itemName,
      rarity: entry.rarity,
      chance,
      expected: Math.round(probability * average * rolls * 100) / 100,
      atLeastOne: Math.round((1 - (1 - probability) ** rolls) * 10000) / 10000,
      min: entry.min,
      max: entry.max
    }
  })

  const expectedItems =
    Math.round(entries.reduce((sum, entry) => sum + entry.expected, 0) * 100) / 100

  let problem: string | null = null
  if (spec.entries.length === 0) problem = 'Adicione pelo menos um item à tabela.'
  else if (spec.mode === 'exclusiva' && Math.abs(totalChance - 100) > 0.01) {
    problem = `As chances exclusivas somam ${totalChance}% — ajuste para exatamente 100%.`
  }

  return {
    totalChance,
    expectedItems,
    rolls,
    mode: spec.mode,
    valid: problem === null,
    problem,
    entries
  }
}

/** Resumo legível usado em fichas e mensagens. */
export function describeDropTable(spec: DropTableSpec): string {
  const stats = dropTableStats(spec)
  return `${spec.entries.length} itens · ${dropSourceLabel(spec.source)} · ${
    spec.mode === 'exclusiva' ? 'exclusiva' : 'independente'
  } · ${stats.totalChance}% no total`
}

/** Uma entrada nova com id único para a próxima posição. */
export function newDropEntry(index: number): DropEntry {
  return {
    id: entryId(index),
    itemName: `Item ${index + 1}`,
    rarity: ITEM_RARITIES[0]?.id ?? 'comum',
    chance: 10,
    min: 1,
    max: 1
  }
}

export function rarityColor(id: string): string {
  return itemRarityById(id).color
}
