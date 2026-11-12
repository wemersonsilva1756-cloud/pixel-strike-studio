/**
 * Efeitos visuais (etapa 7).
 *
 * Cada efeito é uma animação procedural de quadros (explosão, fumaça, fogo,
 * impacto, sangue estilizado, cura e faísca) desenhada pelo Studio, sem imagens
 * externas. Determinístico pela semente.
 */

export type EffectKind =
  | 'explosao'
  | 'fumaca'
  | 'fogo'
  | 'impacto'
  | 'sangue'
  | 'cura'
  | 'faisca'

export const EFFECT_KINDS: EffectKind[] = [
  'explosao',
  'fumaca',
  'fogo',
  'impacto',
  'sangue',
  'cura',
  'faisca'
]

export const EFFECT_LABELS: Record<EffectKind, string> = {
  explosao: 'Explosão',
  fumaca: 'Fumaça',
  fogo: 'Fogo',
  impacto: 'Impacto',
  sangue: 'Sangue estilizado',
  cura: 'Cura',
  faisca: 'Faísca'
}

export const EFFECT_HINTS: Record<EffectKind, string> = {
  explosao: 'Bola de fogo que cresce e se dissolve com anel de choque.',
  fumaca: 'Nuvem de fumaça que sobe e se espalha.',
  fogo: 'Chamas que sobem do chão e diminuem.',
  impacto: 'Estouro radial curto, bom para tiros e golpes.',
  sangue: 'Gotas estilizadas que voam e caem (sem realismo).',
  cura: 'Brilho verde subindo com cruzes de luz.',
  faisca: 'Pequeno estouro de partículas, para acertos e coleta.'
}

export interface EffectPreset {
  frames: number
  fps: number
  colors: { primaria: string; secundaria: string }
}

export const EFFECT_PRESETS: Record<EffectKind, EffectPreset> = {
  explosao: { frames: 6, fps: 12, colors: { primaria: '#fbbf24', secundaria: '#b91c1c' } },
  fumaca: { frames: 8, fps: 8, colors: { primaria: '#9ca3af', secundaria: '#4b5563' } },
  fogo: { frames: 6, fps: 10, colors: { primaria: '#f97316', secundaria: '#fde047' } },
  impacto: { frames: 4, fps: 16, colors: { primaria: '#fef3c7', secundaria: '#f59e0b' } },
  sangue: { frames: 6, fps: 12, colors: { primaria: '#dc2626', secundaria: '#7f1d1d' } },
  cura: { frames: 6, fps: 8, colors: { primaria: '#34d399', secundaria: '#a7f3d0' } },
  faisca: { frames: 4, fps: 16, colors: { primaria: '#fde047', secundaria: '#f59e0b' } }
}

export interface EffectSpec {
  kind: EffectKind
  name: string
  colors: { primaria: string; secundaria: string }
  size: 32 | 64 | 96
  frames: number
  fps: number
  seed: number
}

export interface EffectAsset {
  id: string
  projectId: string
  name: string
  folder: string
  jsonPath: string
  sheetPath: string
  framesPath: string
  kind: EffectKind
  size: number
  frameCount: number
  fps: number
  durationMs: number
  createdAt: string
  spec: EffectSpec
}

export interface EffectPreview {
  frames: string[]
  sheet: string
  width: number
  height: number
  durationMs: number
}

export const MIN_EFFECT_FRAMES = 2
export const MAX_EFFECT_FRAMES = 16
export const MIN_EFFECT_FPS = 1
export const MAX_EFFECT_FPS = 30
export const EFFECT_SIZES: Array<32 | 64 | 96> = [32, 64, 96]

export function effectLabel(kind: string): string {
  return EFFECT_LABELS[kind as EffectKind] ?? 'Efeito'
}

export function defaultEffectSpec(kind: EffectKind = 'explosao'): EffectSpec {
  const preset = EFFECT_PRESETS[kind]
  return {
    kind,
    name: `${EFFECT_LABELS[kind]} sem título`,
    colors: { ...preset.colors },
    size: 64,
    frames: preset.frames,
    fps: preset.fps,
    seed: 1234
  }
}

/** Duração total em milissegundos. */
export function effectDurationMs(spec: EffectSpec): number {
  return Math.round((spec.frames / Math.max(1, spec.fps)) * 1000)
}
