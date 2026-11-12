import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EffectKind, EffectPreview, EffectSpec } from '../../shared/effects'
import { EFFECT_KINDS, EFFECT_PRESETS } from '../../shared/effects'
import type {
  SkillAsset,
  SkillKind,
  SkillParams,
  SkillParamKey,
  SkillSpec,
  SkillSuggestion
} from '../../shared/skills'
import {
  DEFAULT_SKILL_EFFECT,
  DEFAULT_SKILL_PARAMS,
  SKILL_KINDS,
  SKILL_PARAM_RANGES,
  interpretSkill
} from '../../shared/skills'
import { execute, queryAll, queryOne } from './database'
import { getProject } from './projects'
import { ensureDir, isDirectory, moveToTrash, pathExists } from './filesystem'
import { slugify, timestampSlug } from './naming'
import { encodePng } from './png'
import { buildEffectSheet, previewEffect, renderEffectFrames } from './effects'
import { logActivity } from './activity'

/**
 * Habilidades (etapa 7).
 *
 * Cada habilidade grava um ícone, os quadros do efeito visual, a spritesheet, a
 * ficha JSON e um script GDScript que cria a área de efeito, o `AnimatedSprite2D`
 * e aplica o dano nos corpos que estiverem dentro do raio.
 */

const FOLDER = 'habilidades'
const MAX_NAME = 60
const ICON_SIZE = 64
const LOGICAL = 32

let trashDir = ''

export function configureSkills(options: { trashDir: string }): void {
  trashDir = options.trashDir
}

function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
    ? value.toLowerCase()
    : fallback
}

function clampParam(key: SkillParamKey, value: unknown, fallback: number): number {
  const range = SKILL_PARAM_RANGES[key]
  const raw = Number(value)
  const base = Number.isFinite(raw) ? raw : fallback
  const clamped = Math.max(range.min, Math.min(range.max, base))
  return key === 'dano' || key === 'raio' || key === 'alcance' || key === 'custo'
    ? Math.round(clamped)
    : Number(clamped.toFixed(2))
}

/** Valida e normaliza a habilidade vinda da interface. */
export function validateSkillSpec(input: SkillSpec): SkillSpec {
  const name = String(input.name ?? '').trim()
  if (name.length < 2) throw new Error('O nome da habilidade precisa ter pelo menos 2 caracteres.')
  if (name.length > MAX_NAME) {
    throw new Error(`O nome da habilidade pode ter no máximo ${MAX_NAME} caracteres.`)
  }

  const kind: SkillKind = SKILL_KINDS.includes(input.kind) ? input.kind : 'area'
  const effectKind: EffectKind = EFFECT_KINDS.includes(input.effectKind)
    ? input.effectKind
    : DEFAULT_SKILL_EFFECT[kind]
  const preset = EFFECT_PRESETS[effectKind]
  const defaults = DEFAULT_SKILL_PARAMS[kind]

  const params = {} as SkillParams
  for (const key of Object.keys(SKILL_PARAM_RANGES) as SkillParamKey[]) {
    params[key] = clampParam(key, input.params?.[key], defaults[key])
  }

  return {
    name,
    description: String(input.description ?? '').slice(0, 600),
    kind,
    effectKind,
    params,
    colors: {
      primaria: normalizeColor(input.colors?.primaria, preset.colors.primaria),
      secundaria: normalizeColor(input.colors?.secundaria, preset.colors.secundaria)
    },
    seed: Math.abs(Math.floor(Number(input.seed) || 1)) % 2147483647 || 1
  }
}

/* ------------------------------------------------------------------ ícone */

type IconGrid = Array<string | null>

function paint(grid: IconGrid, x: number, y: number, color: string): void {
  if (x < 0 || y < 0 || x >= LOGICAL || y >= LOGICAL) return
  grid[y * LOGICAL + x] = color
}

function rect(grid: IconGrid, x: number, y: number, width: number, height: number, color: string): void {
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      paint(grid, x + column, y + row, color)
    }
  }
}

/** Símbolo do tipo de habilidade: anel, projétil, cruz, escudo, chevrons ou estrela. */
export function renderSkillIconGrid(spec: SkillSpec): IconGrid {
  const grid: IconGrid = Array.from({ length: LOGICAL * LOGICAL }, () => null)
  const primary = spec.colors.primaria
  const secondary = spec.colors.secundaria
  const center = Math.floor(LOGICAL / 2)

  switch (spec.kind) {
    case 'area': {
      for (let radius = 12; radius >= 4; radius -= 4) {
        for (let step = 0; step < 96; step += 1) {
          const angle = (step / 96) * Math.PI * 2
          paint(
            grid,
            Math.round(center + Math.cos(angle) * radius),
            Math.round(center + Math.sin(angle) * radius),
            radius === 12 ? secondary : primary
          )
        }
      }
      rect(grid, center - 1, center - 1, 3, 3, primary)
      break
    }
    case 'projetil': {
      rect(grid, 6, center - 1, 14, 3, primary)
      for (let step = 0; step < 7; step += 1) {
        rect(grid, 18 + step, center - 1 - step, 1, 3 + step * 2, secondary)
      }
      rect(grid, 8, center - 3, 3, 1, secondary)
      rect(grid, 8, center + 3, 3, 1, secondary)
      break
    }
    case 'cura': {
      rect(grid, center - 2, 8, 5, 17, primary)
      rect(grid, 8, center - 2, 17, 5, primary)
      rect(grid, center - 1, 10, 3, 13, secondary)
      rect(grid, 10, center - 1, 13, 3, secondary)
      break
    }
    case 'escudo': {
      for (let y = 7; y < 24; y += 1) {
        const shrink = y > 18 ? (y - 18) * 1.4 : 0
        const halfWidth = 8 - shrink
        for (let x = center - halfWidth; x <= center + halfWidth; x += 1) {
          const edge = Math.abs(x - center) > halfWidth - 1 || y === 7
          paint(grid, Math.round(x), y, edge ? secondary : primary)
        }
      }
      rect(grid, center - 1, 11, 3, 8, secondary)
      break
    }
    case 'mobilidade': {
      for (let chevron = 0; chevron < 3; chevron += 1) {
        const originX = 8 + chevron * 7
        for (let step = 0; step < 8; step += 1) {
          rect(grid, originX + step, center - 8 + step, 2, 2, primary)
          rect(grid, originX + step, center + 6 - step, 2, 2, secondary)
        }
      }
      break
    }
    case 'utilitaria':
    default: {
      for (let y = 8; y < 24; y += 1) {
        for (let x = 8; x < 24; x += 1) {
          const dx = Math.abs(x - center)
          const dy = Math.abs(y - center)
          if (dx + dy <= 2) paint(grid, x, y, secondary)
          else if (dx + dy === 7) paint(grid, x, y, primary)
          else if (dx + dy === 8 && (x + y) % 2 === 0) paint(grid, x, y, primary)
        }
      }
      break
    }
  }

  // Contorno escuro.
  const outlined = [...grid]
  for (let y = 0; y < LOGICAL; y += 1) {
    for (let x = 0; x < LOGICAL; x += 1) {
      if (grid[y * LOGICAL + x]) continue
      const near =
        grid[(y - 1) * LOGICAL + x] ||
        grid[(y + 1) * LOGICAL + x] ||
        grid[y * LOGICAL + (x - 1)] ||
        grid[y * LOGICAL + (x + 1)]
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

export function renderSkillIconPng(spec: SkillSpec): Buffer {
  const grid = renderSkillIconGrid(spec)
  const scale = ICON_SIZE / LOGICAL
  const pixels = new Uint8Array(ICON_SIZE * ICON_SIZE * 4)

  for (let y = 0; y < ICON_SIZE; y += 1) {
    for (let x = 0; x < ICON_SIZE; x += 1) {
      const color = grid[Math.floor(y / scale) * LOGICAL + Math.floor(x / scale)] ?? null
      if (!color) continue
      const [r, g, b] = parseColor(color)
      const offset = (y * ICON_SIZE + x) * 4
      pixels[offset] = r
      pixels[offset + 1] = g
      pixels[offset + 2] = b
      pixels[offset + 3] = 255
    }
  }

  return encodePng(ICON_SIZE, ICON_SIZE, pixels)
}

/** Efeito visual derivado da habilidade. */
export function effectSpecForSkill(spec: SkillSpec): EffectSpec {
  const preset = EFFECT_PRESETS[spec.effectKind]
  return {
    kind: spec.effectKind,
    name: `${spec.name} · efeito`,
    colors: spec.colors,
    size: 64,
    frames: preset.frames,
    fps: preset.fps,
    seed: spec.seed
  }
}

export interface SkillPreview {
  icon: string
  effect: EffectPreview
}

function dataUrl(png: Buffer): string {
  return `data:image/png;base64,${png.toString('base64')}`
}

/** Prévia da habilidade: ícone + animação do efeito, sem gravar nada. */
export async function previewSkill(input: SkillSpec): Promise<SkillPreview> {
  const spec = validateSkillSpec(input)
  const effect = await previewEffect(effectSpecForSkill(spec))
  return { icon: dataUrl(renderSkillIconPng(spec)), effect }
}

export function interpretSkillDescription(description: string): SkillSuggestion {
  return interpretSkill(description)
}

/* -------------------------------------------------------------- GDScript */

export function buildSkillScript(spec: SkillSpec, slug: string): string {
  const params = {
    dano: spec.params.dano,
    alcance: spec.params.alcance,
    raio: spec.params.raio,
    duracao: spec.params.duracao,
    recarga: spec.params.recarga,
    custo: spec.params.custo,
    velocidade: spec.params.velocidade,
    fps: EFFECT_PRESETS[spec.effectKind].fps,
    quadros: EFFECT_PRESETS[spec.effectKind].frames,
    tamanhoQuadro: 64
  }

  return `extends Node

## ${spec.name} - gerado pelo Pixel Strike Studio.
##
## COMO USAR
## 1. Copie este arquivo e a pasta do efeito (efeito_sheet.png) para o projeto Godot.
## 2. Adicione este script como nó filho do seu jogador (ou use como autoload).
## 3. Chame: \$Habilidade.usar(self, get_global_mouse_position())

const EFEITO_SHEET: String = "res://pixel_strike/recursos/${FOLDER}/${slug}/efeito_sheet.png"

const PARAMETROS: Dictionary = ${JSON.stringify(params, null, 2)}

var tempo_restante: float = 0.0


func _process(delta: float) -> void:
	if tempo_restante > 0.0:
		tempo_restante = max(0.0, tempo_restante - delta)


func disponivel() -> bool:
	return tempo_restante <= 0.0


## Usa a habilidade a partir de uma origem, mirando em uma posição do mundo.
func usar(origem: Node2D, alvo: Vector2) -> void:
	if not disponivel():
		return
	tempo_restante = float(PARAMETROS.get("recarga", 1.0))

	var efeito := _criar_efeito()
	origem.add_child(efeito)
	efeito.global_position = alvo

	var area := Area2D.new()
	area.name = "AreaHabilidade"
	var forma := CollisionShape2D.new()
	var circulo := CircleShape2D.new()
	circulo.radius = float(PARAMETROS.get("raio", 64))
	forma.shape = circulo
	area.add_child(forma)
	origem.add_child(area)
	area.global_position = alvo
	area.body_entered.connect(_ao_entrar)

	var duracao: float = float(PARAMETROS.get("duracao", 1.0))
	var temporizador := get_tree().create_timer(max(duracao, 0.2))
	temporizador.timeout.connect(func() -> void:
		if is_instance_valid(area):
			area.queue_free()
		if is_instance_valid(efeito):
			efeito.queue_free()
	)


func _ao_entrar(corpo: Node2D) -> void:
	if corpo.has_method("receber_dano"):
		corpo.receber_dano(int(PARAMETROS.get("dano", 0)))


func _criar_efeito() -> AnimatedSprite2D:
	var textura: Texture2D = load(EFEITO_SHEET)
	var quadros := SpriteFrames.new()
	quadros.add_animation("padrao")
	quadros.set_animation_speed("padrao", float(PARAMETROS.get("fps", 12)))
	quadros.set_animation_loop("padrao", false)

	var lado: int = int(PARAMETROS.get("tamanhoQuadro", 64))
	for indice in range(int(PARAMETROS.get("quadros", 6))):
		var pedaco := AtlasTexture.new()
		pedaco.atlas = textura
		pedaco.region = Rect2(indice * lado, 0, lado, lado)
		quadros.add_frame("padrao", pedaco)

	var sprite := AnimatedSprite2D.new()
	sprite.name = "Efeito"
	sprite.sprite_frames = quadros
	sprite.play("padrao")
	return sprite
`
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

export async function saveSkill(projectId: string, input: SkillSpec): Promise<SkillAsset> {
  const spec = validateSkillSpec(input)
  const project = await getProject(projectId)
  if (!project.folderExists) {
    throw new Error(`A pasta do projeto não foi encontrada em "${project.path}".`)
  }

  const parent = join(project.path, FOLDER)
  ensureDir(parent)
  const folder = uniqueFolder(parent, slugify(spec.name))
  ensureDir(folder)
  const slug = folder.split(/[\\/]/).pop() ?? slugify(spec.name)

  const effect = effectSpecForSkill(spec)
  const frames = renderEffectFrames(effect)
  const sheet = buildEffectSheet(frames)

  writeFileSync(join(folder, `${slug}_icone.png`), renderSkillIconPng(spec))
  frames.forEach((frame, index) => {
    writeFileSync(join(folder, `efeito_${String(index + 1).padStart(2, '0')}.png`), frame.png)
  })
  writeFileSync(join(folder, 'efeito_sheet.png'), sheet.png)
  writeFileSync(join(folder, `${slug}.gd`), buildSkillScript(spec, slug), 'utf8')

  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const jsonName = `${slug}.json`

  const ficha = {
    formato: 1,
    id,
    geradoPor: 'Pixel Strike Studio',
    geradoEm: createdAt,
    nome: spec.name,
    descricao: spec.description,
    tipo: spec.kind,
    parametros: {
      dano: spec.params.dano,
      alcance: spec.params.alcance,
      raio: spec.params.raio,
      duracao: spec.params.duracao,
      recarga: spec.params.recarga,
      custo: spec.params.custo,
      velocidade: spec.params.velocidade
    },
    efeito: {
      tipo: spec.effectKind,
      quadros: frames.length,
      fps: effect.fps,
      cores: spec.colors,
      folha: 'efeito_sheet.png',
      colunas: sheet.columns,
      largura: sheet.width,
      altura: sheet.height
    },
    semente: spec.seed,
    arquivos: {
      icone: `${slug}_icone.png`,
      script: `${slug}.gd`,
      folha: 'efeito_sheet.png'
    }
  }

  writeFileSync(join(folder, jsonName), `${JSON.stringify(ficha, null, 2)}\n`, 'utf8')

  const jsonPath = `${FOLDER}/${slug}/${jsonName}`
  const iconPath = `${FOLDER}/${slug}/${slug}_icone.png`
  const effectSheetPath = `${FOLDER}/${slug}/efeito_sheet.png`
  const scriptPath = `${FOLDER}/${slug}/${slug}.gd`

  const data = JSON.stringify({
    folder: `${FOLDER}/${slug}`,
    kind: spec.kind,
    effectKind: spec.effectKind,
    params: spec.params,
    iconPath,
    effectSheetPath,
    scriptPath,
    spec
  })

  await execute(
    `INSERT INTO assets (id, project_id, kind, name, origin, relative_path, data, created_at, updated_at)
     VALUES (?, ?, 'habilidade', ?, 'gerado', ?, ?, ?, ?)`,
    [id, projectId, spec.name, jsonPath, data, createdAt, createdAt]
  )

  await logActivity(
    projectId,
    'habilidade.criada',
    `Habilidade "${spec.name}" (${spec.kind}, efeito ${spec.effectKind}) gerada em ${FOLDER}/${slug}.`
  )

  return {
    id,
    projectId,
    name: spec.name,
    folder: `${FOLDER}/${slug}`,
    jsonPath,
    iconPath,
    effectSheetPath,
    scriptPath,
    kind: spec.kind,
    effectKind: spec.effectKind,
    params: spec.params,
    createdAt,
    spec
  }
}

interface SkillRow {
  id: string
  project_id: string
  name: string
  relative_path: string
  data: string
  created_at: string
}

function toSkillAsset(row: SkillRow): SkillAsset | null {
  try {
    const parsed = JSON.parse(row.data) as {
      folder: string
      kind: SkillKind
      effectKind: EffectKind
      params: SkillParams
      iconPath: string
      effectSheetPath: string
      scriptPath: string
      spec: SkillSpec
    }
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      folder: parsed.folder,
      jsonPath: row.relative_path,
      iconPath: parsed.iconPath,
      effectSheetPath: parsed.effectSheetPath,
      scriptPath: parsed.scriptPath,
      kind: parsed.kind,
      effectKind: parsed.effectKind,
      params: parsed.params,
      createdAt: row.created_at,
      spec: parsed.spec
    }
  } catch {
    return null
  }
}

export async function listSkills(projectId: string): Promise<SkillAsset[]> {
  const rows = await queryAll<SkillRow>(
    `SELECT id, project_id, name, relative_path, data, created_at
     FROM assets WHERE project_id = ? AND kind = 'habilidade' ORDER BY created_at DESC`,
    [projectId]
  )
  return rows.map(toSkillAsset).filter((asset): asset is SkillAsset => asset !== null)
}

export async function removeSkill(assetId: string): Promise<void> {
  const row = await queryOne<SkillRow>(
    'SELECT id, project_id, name, relative_path, data, created_at FROM assets WHERE id = ?',
    [assetId]
  )
  if (!row) throw new Error('Esta habilidade não existe mais.')

  const asset = toSkillAsset(row)
  const project = await getProject(row.project_id)

  if (asset && project.folderExists) {
    const folder = join(project.path, asset.folder)
    if (isDirectory(folder)) {
      if (!trashDir) throw new Error('A lixeira do Studio não está configurada.')
      moveToTrash(folder, trashDir, `${timestampSlug(new Date())}_${slugify(asset.name)}`)
    }
  }

  await execute('DELETE FROM assets WHERE id = ?', [assetId])
  await logActivity(row.project_id, 'habilidade.removida', `Habilidade "${row.name}" movida para a lixeira.`)
}

