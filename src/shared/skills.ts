/**
 * Skills e habilidades (etapa 7).
 *
 * Cada habilidade combina parâmetros de jogo (dano, alcance, raio, duração,
 * recarga, custo e velocidade) com um efeito visual da biblioteca da etapa 7.
 * A descrição é interpretada por palavras-chave — não há IA nesta etapa.
 */

import type { EffectKind } from './effects'
import { EFFECT_PRESETS } from './effects'

export type SkillKind = 'area' | 'projetil' | 'cura' | 'escudo' | 'mobilidade' | 'utilitaria'

export const SKILL_KINDS: SkillKind[] = [
  'area',
  'projetil',
  'cura',
  'escudo',
  'mobilidade',
  'utilitaria'
]

export const SKILL_KIND_LABELS: Record<SkillKind, string> = {
  area: 'Área de efeito',
  projetil: 'Projétil',
  cura: 'Cura',
  escudo: 'Escudo',
  mobilidade: 'Mobilidade',
  utilitaria: 'Utilitária'
}

export const SKILL_KIND_HINTS: Record<SkillKind, string> = {
  area: 'Explode ou afeta todos os alvos dentro do raio.',
  projetil: 'Viaja em linha reta e causa dano no primeiro alvo.',
  cura: 'Recupera vida dos aliados dentro do raio.',
  escudo: 'Protege por um tempo, absorvendo dano.',
  mobilidade: 'Avanço rápido ou reposicionamento.',
  utilitaria: 'Fumaça, visão, controle de área ou interação.'
}

export interface SkillParams {
  dano: number
  alcance: number
  raio: number
  duracao: number
  recarga: number
  custo: number
  velocidade: number
}

export type SkillParamKey = keyof SkillParams

export const SKILL_PARAM_LABELS: Record<SkillParamKey, string> = {
  dano: 'Dano',
  alcance: 'Alcance (px)',
  raio: 'Raio / área (px)',
  duracao: 'Duração (s)',
  recarga: 'Recarga (s)',
  custo: 'Custo de energia',
  velocidade: 'Velocidade (px/s)'
}

export interface SkillParamRange {
  min: number
  max: number
  step: number
}

export const SKILL_PARAM_RANGES: Record<SkillParamKey, SkillParamRange> = {
  dano: { min: 0, max: 500, step: 1 },
  alcance: { min: 0, max: 1200, step: 10 },
  raio: { min: 4, max: 400, step: 4 },
  duracao: { min: 0.1, max: 30, step: 0.1 },
  recarga: { min: 0.1, max: 120, step: 0.1 },
  custo: { min: 0, max: 200, step: 5 },
  velocidade: { min: 0, max: 2000, step: 20 }
}

export const DEFAULT_SKILL_PARAMS: Record<SkillKind, SkillParams> = {
  area: { dano: 45, alcance: 160, raio: 64, duracao: 1.2, recarga: 8, custo: 40, velocidade: 0 },
  projetil: { dano: 30, alcance: 300, raio: 12, duracao: 0.8, recarga: 1.5, custo: 15, velocidade: 420 },
  cura: { dano: 0, alcance: 0, raio: 48, duracao: 1, recarga: 12, custo: 50, velocidade: 0 },
  escudo: { dano: 0, alcance: 0, raio: 40, duracao: 4, recarga: 15, custo: 60, velocidade: 0 },
  mobilidade: { dano: 0, alcance: 140, raio: 16, duracao: 0.4, recarga: 6, custo: 25, velocidade: 620 },
  utilitaria: { dano: 10, alcance: 120, raio: 56, duracao: 3, recarga: 10, custo: 35, velocidade: 0 }
}

export const DEFAULT_SKILL_EFFECT: Record<SkillKind, EffectKind> = {
  area: 'explosao',
  projetil: 'impacto',
  cura: 'cura',
  escudo: 'cura',
  mobilidade: 'faisca',
  utilitaria: 'fumaca'
}

export interface SkillSpec {
  name: string
  description: string
  kind: SkillKind
  effectKind: EffectKind
  params: SkillParams
  colors: { primaria: string; secundaria: string }
  seed: number
}

export interface SkillAsset {
  id: string
  projectId: string
  name: string
  folder: string
  jsonPath: string
  iconPath: string
  effectSheetPath: string
  scriptPath: string
  kind: SkillKind
  effectKind: EffectKind
  params: SkillParams
  createdAt: string
  spec: SkillSpec
}

export interface SkillSuggestion {
  kind: SkillKind | null
  effectKind: EffectKind | null
  params: Partial<SkillParams> | null
  matches: string[]
}

export function defaultSkillSpec(kind: SkillKind = 'area'): SkillSpec {
  const effectKind = DEFAULT_SKILL_EFFECT[kind]
  return {
    name: `Habilidade ${SKILL_KIND_LABELS[kind]}`,
    description: '',
    kind,
    effectKind,
    params: { ...DEFAULT_SKILL_PARAMS[kind] },
    colors: { ...EFFECT_PRESETS[effectKind].colors },
    seed: 4321
  }
}

/** Resumo legível dos parâmetros (usado em textos e fichas). */
export function describeSkillParams(spec: SkillSpec): string {
  const parts: string[] = []
  if (spec.params.dano > 0) parts.push(`${spec.params.dano} de dano`)
  if (spec.params.raio > 0) parts.push(`raio de ${spec.params.raio} px`)
  if (spec.params.alcance > 0) parts.push(`alcance de ${spec.params.alcance} px`)
  parts.push(`recarga de ${spec.params.recarga}s`)
  return parts.join(' · ')
}

/** Interpreta a descrição por palavras-chave (sem IA nesta etapa). */
export function interpretSkill(description: string): SkillSuggestion {
  const text = description.toLowerCase()
  const suggestion: SkillSuggestion = {
    kind: null,
    effectKind: null,
    params: null,
    matches: []
  }

  const rules: Array<{
    words: string[]
    kind: SkillKind
    effectKind: EffectKind
    params?: Partial<SkillParams>
  }> = [
    // O efeito tem prioridade sobre o meio de entrega: “granada de fumaça” é
    // tratada como fumaça, não como explosão.
    {
      words: ['fumaça', 'fumaca', 'cortina', 'neblina', 'smoke'],
      kind: 'utilitaria',
      effectKind: 'fumaca',
      params: { dano: 0, raio: 80, duracao: 8, recarga: 14, custo: 45 }
    },
    {
      words: ['granada', 'explos', 'bomba', 'mina'],
      kind: 'area',
      effectKind: 'explosao',
      params: { dano: 90, raio: 96, recarga: 12, custo: 60 }
    },
    {
      words: ['fogo', 'incendi', 'chama', 'napalm', 'flamejante'],
      kind: 'area',
      effectKind: 'fogo',
      params: { dano: 60, raio: 72, duracao: 4, recarga: 16, custo: 70 }
    },
    {
      words: ['cura', 'medic', 'restaur', 'curadeira'],
      kind: 'cura',
      effectKind: 'cura',
      params: { dano: 0, raio: 64, duracao: 1, recarga: 10, custo: 40 }
    },
    {
      words: ['escudo', 'proteç', 'protec', 'barreira', 'invulner'],
      kind: 'escudo',
      effectKind: 'cura',
      params: { dano: 0, raio: 48, duracao: 5, recarga: 18, custo: 70 }
    },
    {
      words: ['dash', 'investida', 'avanço', 'avanco', 'corrida', 'salto'],
      kind: 'mobilidade',
      effectKind: 'faisca',
      params: { dano: 0, alcance: 180, duracao: 0.4, recarga: 5, custo: 20, velocidade: 720 }
    },
    {
      words: ['tiro', 'projétil', 'projetil', 'bala', 'flecha', 'dardo'],
      kind: 'projetil',
      effectKind: 'impacto',
      params: { dano: 35, alcance: 360, velocidade: 520, recarga: 2, custo: 15 }
    },
    {
      words: ['sangue', 'corte', 'estilhaço', 'estilhaco', 'perfurante'],
      kind: 'projetil',
      effectKind: 'sangue',
      params: { dano: 40, alcance: 200 }
    },
    {
      words: ['faísca', 'faisca', 'curto', 'toque', 'elétric', 'electric'],
      kind: 'area',
      effectKind: 'faisca',
      params: { dano: 20, raio: 40, recarga: 3, custo: 10 }
    }
  ]

  for (const rule of rules) {
    const hit = rule.words.find((word) => text.includes(word))
    if (!hit) continue

    suggestion.matches.push(hit)
    if (!suggestion.kind) suggestion.kind = rule.kind
    if (!suggestion.effectKind) suggestion.effectKind = rule.effectKind
    if (!suggestion.params) {
      suggestion.params = { ...DEFAULT_SKILL_PARAMS[rule.kind], ...rule.params }
    }
    if (suggestion.kind && suggestion.effectKind && suggestion.params) break
  }

  return suggestion
}
