import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  MapAsset,
  MapConfig,
  MapDraft,
  MapPreview,
  MapSpawn,
  MapZone,
  SpawnKind,
  TileKind,
  ZoneKind
} from '../../shared/maps'
import {
  MAX_MAP_PIXELS,
  MAX_MAP_SIZE,
  MAX_TILE_SIZE,
  MIN_MAP_SIZE,
  MIN_TILE_SIZE,
  SPAWN_KINDS,
  TILE_KINDS,
  TILE_SOLID,
  ZONE_KINDS,
  proposeMap,
  themeById
} from '../../shared/maps'
import { execute, queryAll, queryOne } from './database'
import { getProject } from './projects'
import { ensureDir, isDirectory, moveToTrash, pathExists } from './filesystem'
import { slugify, timestampSlug } from './naming'
import { encodePng } from './png'
import { toDataUrl } from './sprites'
import { logActivity } from './activity'

/**
 * Construtor de mapas (etapa 5).
 *
 * O mapa é gravado como imagem (mapa.png), atlas de tiles (tileset.png), dados
 * completos (mapa.json), um script GDScript que monta o TileMapLayer com
 * colisões, áreas e spawns (mapa.gd) e uma cena pronta (mapa.tscn).
 */

const FOLDER = 'mapas'
const MAX_NAME = 60
const MAX_ZONES = 40
const MAX_SPAWNS = 60

let trashDir = ''

export function configureMaps(options: { trashDir: string }): void {
  trashDir = options.trashDir
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.round(value)))
}

function isTileKind(value: unknown): value is TileKind {
  return typeof value === 'string' && (TILE_KINDS as readonly string[]).includes(value)
}

function isZoneKind(value: unknown): value is ZoneKind {
  return typeof value === 'string' && (ZONE_KINDS as readonly string[]).includes(value)
}

function isSpawnKind(value: unknown): value is SpawnKind {
  return typeof value === 'string' && (SPAWN_KINDS as readonly string[]).includes(value)
}

/** Valida e normaliza o mapa vindo da interface. */
export function validateMapConfig(input: MapConfig): MapConfig {
  const name = String(input.name ?? '').trim()
  if (name.length < 2) throw new Error('O nome do mapa precisa ter pelo menos 2 caracteres.')
  if (name.length > MAX_NAME) {
    throw new Error(`O nome do mapa pode ter no máximo ${MAX_NAME} caracteres.`)
  }

  const width = clampInt(input.width, MIN_MAP_SIZE, MAX_MAP_SIZE)
  const height = clampInt(input.height, MIN_MAP_SIZE, MAX_MAP_SIZE)
  if (width !== Math.round(input.width) || height !== Math.round(input.height)) {
    throw new Error(
      `O mapa precisa ter entre ${MIN_MAP_SIZE} e ${MAX_MAP_SIZE} tiles em cada lado.`
    )
  }

  const tileSize = clampInt(input.tileSize, MIN_TILE_SIZE, MAX_TILE_SIZE)
  if (width * tileSize > MAX_MAP_PIXELS || height * tileSize > MAX_MAP_PIXELS) {
    throw new Error(
      `A imagem do mapa passaria de ${MAX_MAP_PIXELS} pixels. Reduza o tamanho dos tiles ou do mapa.`
    )
  }

  const total = width * height
  const tiles = Array.from({ length: total }, (_, index) => {
    const value = input.tiles?.[index]
    return isTileKind(value) ? value : null
  })
  const collision = Array.from({ length: total }, (_, index) => {
    const tile = tiles[index] ?? null
    if (tile === 'parede' || tile === 'agua') return true
    return Boolean(input.collision?.[index])
  })

  const zones: MapZone[] = (Array.isArray(input.zones) ? input.zones : [])
    .slice(0, MAX_ZONES)
    .map((zone, index) => {
      const zoneWidth = clampInt(zone?.w ?? 1, 1, width)
      const zoneHeight = clampInt(zone?.h ?? 1, 1, height)
      return {
        id: String(zone?.id ?? `zona-${index + 1}`).slice(0, 60),
        kind: isZoneKind(zone?.kind) ? zone.kind : 'segura',
        name: String(zone?.name ?? 'Zona').trim().slice(0, 40) || 'Zona',
        x: clampInt(zone?.x ?? 0, 0, width - zoneWidth),
        y: clampInt(zone?.y ?? 0, 0, height - zoneHeight),
        w: zoneWidth,
        h: zoneHeight
      }
    })

  const spawns: MapSpawn[] = (Array.isArray(input.spawns) ? input.spawns : [])
    .slice(0, MAX_SPAWNS)
    .map((spawn, index) => ({
      id: String(spawn?.id ?? `spawn-${index + 1}`).slice(0, 60),
      kind: isSpawnKind(spawn?.kind) ? spawn.kind : 'jogador',
      name: String(spawn?.name ?? 'Spawn').trim().slice(0, 40) || 'Spawn',
      x: clampInt(spawn?.x ?? 0, 0, width - 1),
      y: clampInt(spawn?.y ?? 0, 0, height - 1)
    }))

  return {
    name,
    description: String(input.description ?? '').slice(0, 400),
    themeId: themeById(String(input.themeId ?? 'militar')).id,
    width,
    height,
    tileSize,
    seed: Math.abs(Math.round(Number(input.seed) || 1)) || 1,
    tiles,
    collision,
    zones,
    spawns
  }
}

/* ------------------------------------------------------------- desenho */

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [
    Number.parseInt(clean.slice(0, 2), 16) || 0,
    Number.parseInt(clean.slice(2, 4), 16) || 0,
    Number.parseInt(clean.slice(4, 6), 16) || 0
  ]
}

function shade(hex: string, factor: number): [number, number, number] {
  const [r, g, b] = parseHex(hex)
  return [
    Math.max(0, Math.min(255, Math.round(r * factor))),
    Math.max(0, Math.min(255, Math.round(g * factor))),
    Math.max(0, Math.min(255, Math.round(b * factor)))
  ]
}

function hash01(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

interface Surface {
  width: number
  height: number
  pixels: Uint8Array
}

function put(surface: Surface, x: number, y: number, color: [number, number, number]): void {
  if (x < 0 || y < 0 || x >= surface.width || y >= surface.height) return
  const offset = (y * surface.width + x) * 4
  surface.pixels[offset] = color[0]
  surface.pixels[offset + 1] = color[1]
  surface.pixels[offset + 2] = color[2]
  surface.pixels[offset + 3] = 255
}

function fillRect(
  surface: Surface,
  x: number,
  y: number,
  width: number,
  height: number,
  color: [number, number, number]
): void {
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      put(surface, x + column, y + row, color)
    }
  }
}

/**
 * Desenha um tile na superfície. O detalhe é determinístico pela posição da
 * célula, então o mesmo mapa sempre gera exatamente a mesma imagem.
 */
function paintTile(
  surface: Surface,
  originX: number,
  originY: number,
  size: number,
  kind: TileKind,
  baseHex: string,
  tx: number,
  ty: number,
  seed: number
): void {
  const base = parseHex(baseHex)
  const light = shade(baseHex, 1.18)
  const dark = shade(baseHex, 0.82)

  fillRect(surface, originX, originY, size, size, base)

  switch (kind) {
    case 'grama': {
      for (let index = 0; index < 4; index += 1) {
        const x = originX + Math.floor(hash01(tx, ty, seed + index) * (size - 2))
        const y = originY + Math.floor(hash01(ty, tx, seed + index + 9) * (size - 2))
        put(surface, x, y, dark)
        put(surface, x + 1, y, light)
      }
      break
    }
    case 'terra': {
      const speckles = Math.max(3, Math.floor(size / 4))
      for (let index = 0; index < speckles; index += 1) {
        const x = originX + Math.floor(hash01(tx + index, ty, seed) * size)
        const y = originY + Math.floor(hash01(tx, ty + index, seed + 3) * size)
        put(surface, x, y, index % 2 === 0 ? dark : light)
      }
      break
    }
    case 'areia': {
      for (let index = 0; index < size; index += 1) {
        const x = originX + Math.floor(hash01(tx, ty + index, seed + 5) * size)
        const y = originY + Math.floor(hash01(tx + index, ty, seed + 7) * size)
        put(surface, x, y, light)
      }
      break
    }
    case 'pedra': {
      const half = Math.max(2, Math.floor(size / 2))
      for (let row = 0; row < size; row += half) {
        fillRect(surface, originX, originY + row, size, 1, dark)
      }
      for (let column = 0; column < size; column += half) {
        fillRect(surface, originX + column, originY, 1, size, dark)
      }
      put(surface, originX + 1, originY + 1, light)
      break
    }
    case 'agua': {
      for (let row = 2; row < size; row += Math.max(3, Math.floor(size / 3))) {
        for (let column = 0; column < size; column += 1) {
          if ((column + tx + ty) % 6 < 3) continue
          put(surface, originX + column, originY + row, light)
        }
      }
      break
    }
    case 'parede': {
      const half = Math.max(3, Math.floor(size / 2))
      for (let row = 0; row < size; row += half) {
        fillRect(surface, originX, originY + row, size, 1, dark)
        const offset = (row / half) % 2 === 0 ? 0 : Math.floor(half / 2)
        for (let column = offset; column < size; column += half) {
          fillRect(surface, originX + column, originY + row, 1, Math.min(half, size - row), dark)
        }
      }
      put(surface, originX + 1, originY + 1, light)
      break
    }
    case 'estrada': {
      const center = Math.floor(size / 2)
      for (let column = 0; column < size; column += 2) {
        put(surface, originX + column, originY + center, light)
      }
      for (let index = 0; index < Math.max(2, Math.floor(size / 6)); index += 1) {
        const x = originX + Math.floor(hash01(tx, ty, seed + index) * size)
        const y = originY + Math.floor(hash01(ty, tx, seed + index + 4) * size)
        put(surface, x, y, dark)
      }
      break
    }
    case 'madeira': {
      const plank = Math.max(3, Math.floor(size / 2))
      for (let column = 0; column < size; column += plank) {
        fillRect(surface, originX + column, originY, 1, size, dark)
      }
      for (let row = 0; row < size; row += plank) {
        fillRect(surface, originX, originY + row, size, 1, light)
      }
      break
    }
    default:
      break
  }
}

/** Renderiza o mapa inteiro em pixels RGBA. */
export function renderMapPixels(config: MapConfig): Surface {
  const width = config.width * config.tileSize
  const height = config.height * config.tileSize
  const surface: Surface = { width, height, pixels: new Uint8Array(width * height * 4) }
  const theme = themeById(config.themeId)

  for (let y = 0; y < config.height; y += 1) {
    for (let x = 0; x < config.width; x += 1) {
      const kind = config.tiles[y * config.width + x]
      if (!kind) continue
      paintTile(
        surface,
        x * config.tileSize,
        y * config.tileSize,
        config.tileSize,
        kind,
        theme.tiles[kind],
        x,
        y,
        config.seed
      )
    }
  }

  return surface
}

/** Atlas horizontal com um tile de cada tipo (usado pelo TileSet da Godot). */
export function renderTilesetPixels(config: MapConfig): Surface {
  const size = config.tileSize
  const width = size * TILE_KINDS.length
  const surface: Surface = { width, height: size, pixels: new Uint8Array(width * size * 4) }
  const theme = themeById(config.themeId)

  TILE_KINDS.forEach((kind, index) => {
    paintTile(surface, index * size, 0, size, kind, theme.tiles[kind], index, 0, 7)
  })

  return surface
}

/** Pré-visualização: imagem do mapa + atlas de tiles, sem gravar nada. */
export async function previewMap(input: MapConfig): Promise<MapPreview> {
  const config = validateMapConfig(input)
  const map = renderMapPixels(config)
  const tileset = renderTilesetPixels(config)

  return {
    image: toDataUrl(encodePng(map.width, map.height, map.pixels)),
    tileset: toDataUrl(encodePng(tileset.width, tileset.height, tileset.pixels)),
    width: map.width,
    height: map.height
  }
}

/** Propõe um mapa a partir da descrição (determinístico pela semente). */
export function proposeMapConfig(draft: Partial<MapDraft>): MapConfig {
  return proposeMap(draft)
}

/* ------------------------------------------------------- blocos de colisão */

export interface CollisionBlock {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Junta células bloqueadas em retângulos por linha: menos nós na Godot e
 * colisão idêntica à grade.
 */
export function buildCollisionBlocks(config: MapConfig): CollisionBlock[] {
  const blocks: CollisionBlock[] = []

  for (let y = 0; y < config.height; y += 1) {
    let start = -1
    for (let x = 0; x <= config.width; x += 1) {
      const blocked = x < config.width && config.collision[y * config.width + x] === true
      if (blocked && start === -1) start = x
      if (!blocked && start !== -1) {
        blocks.push({ x: start, y, w: x - start, h: 1 })
        start = -1
      }
    }
  }

  return blocks
}

/* ------------------------------------------------- exportação para a Godot */

function mapJson(config: MapConfig, slug: string): string {
  const data = {
    formato: 1,
    geradoPor: 'Pixel Strike Studio',
    geradoEm: new Date().toISOString(),
    nome: config.name,
    descricao: config.description,
    tema: config.themeId,
    semente: config.seed,
    largura: config.width,
    altura: config.height,
    tamanhoTile: config.tileSize,
    ordemTiles: TILE_KINDS,
    tiles: config.tiles.map((tile) => tile ?? ''),
    colisao: config.collision.map((blocked) => (blocked ? 1 : 0)),
    blocos: buildCollisionBlocks(config),
    zonas: config.zones.map((zone) => ({
      tipo: zone.kind,
      nome: zone.name,
      x: zone.x,
      y: zone.y,
      w: zone.w,
      h: zone.h
    })),
    spawns: config.spawns.map((spawn) => ({
      tipo: spawn.kind,
      nome: spawn.name,
      x: spawn.x,
      y: spawn.y
    })),
    arquivos: {
      imagem: 'mapa.png',
      atlas: 'tileset.png',
      cena: `${slug}.tscn`,
      script: `${slug}.gd`
    }
  }

  return `${JSON.stringify(data, null, 2)}\n`
}

/** Script GDScript que monta o TileMapLayer, colisões, áreas e spawns. */
function mapScript(slug: string): string {
  return `extends Node2D

## Gerado automaticamente pelo Pixel Strike Studio.
##
## Monta o TileMapLayer do terreno, as colisões, as áreas (zonas) e os pontos de
## spawn a partir de mapa.json. Pode ser editado à vontade: o Studio sempre mostra
## a prévia antes de substituir e guarda uma cópia do arquivo anterior.

const CAMINHO_MAPA: String = "res://pixel_strike/recursos/${FOLDER}/${slug}/mapa.json"
const CAMINHO_ATLAS: String = "res://pixel_strike/recursos/${FOLDER}/${slug}/tileset.png"


func _ready() -> void:
	var dados := _ler_mapa()
	if dados.is_empty():
		return

	var tamanho: int = int(dados.get("tamanhoTile", 16))
	var largura: int = int(dados.get("largura", 0))
	var altura: int = int(dados.get("altura", 0))

	var camada := _criar_camada(dados, tamanho, largura, altura)
	if camada != null:
		_montar_colisoes(dados, tamanho)
		_montar_zonas(dados, tamanho)
		_montar_spawns(dados, tamanho)

	print("[Pixel Strike] Mapa carregado: ", dados.get("nome", ""))


func _ler_mapa() -> Dictionary:
	if not FileAccess.file_exists(CAMINHO_MAPA):
		push_warning("[Pixel Strike] mapa.json não encontrado: " + CAMINHO_MAPA)
		return {}

	var texto := FileAccess.get_file_as_string(CAMINHO_MAPA)
	var dados: Variant = JSON.parse_string(texto)
	if typeof(dados) != TYPE_DICTIONARY:
		push_error("[Pixel Strike] mapa.json inválido.")
		return {}
	return dados


func _criar_camada(dados: Dictionary, tamanho: int, largura: int, altura: int) -> TileMapLayer:
	var atlas := load(CAMINHO_ATLAS) as Texture2D
	if atlas == null:
		push_error("[Pixel Strike] Atlas não encontrado: " + CAMINHO_ATLAS)
		return null

	var ordem: Array = dados.get("ordemTiles", [])
	var tileset := TileSet.new()
	tileset.tile_size = Vector2i(tamanho, tamanho)

	var fonte := TileSetAtlasSource.new()
	fonte.texture = atlas
	fonte.texture_region_size = Vector2i(tamanho, tamanho)
	for indice in range(ordem.size()):
		fonte.create_tile(Vector2i(indice, 0))
	tileset.add_source(fonte, 0)

	var camada := TileMapLayer.new()
	camada.name = "Terreno"
	camada.tile_set = tileset
	add_child(camada)

	var tiles: Array = dados.get("tiles", [])
	for y in range(altura):
		for x in range(largura):
			var posicao: int = y * largura + x
			if posicao >= tiles.size():
				continue
			var nome: String = String(tiles[posicao])
			if nome.is_empty():
				continue
			var indice: int = ordem.find(nome)
			if indice < 0:
				continue
			camada.set_cell(Vector2i(x, y), 0, Vector2i(indice, 0))

	return camada


func _montar_colisoes(dados: Dictionary, tamanho: int) -> void:
	var corpo := StaticBody2D.new()
	corpo.name = "Colisoes"
	corpo.collision_layer = 1
	add_child(corpo)

	for bloco in dados.get("blocos", []):
		var forma := CollisionShape2D.new()
		var retangulo := RectangleShape2D.new()
		retangulo.size = Vector2(float(bloco.get("w", 1)) * tamanho, float(bloco.get("h", 1)) * tamanho)
		forma.shape = retangulo
		forma.position = Vector2(
			float(bloco.get("x", 0)) * tamanho + retangulo.size.x * 0.5,
			float(bloco.get("y", 0)) * tamanho + retangulo.size.y * 0.5
		)
		corpo.add_child(forma)


func _montar_zonas(dados: Dictionary, tamanho: int) -> void:
	var grupo := Node2D.new()
	grupo.name = "Zonas"
	add_child(grupo)

	for zona in dados.get("zonas", []):
		var area := Area2D.new()
		area.name = String(zona.get("nome", "Zona")).replace(" ", "_")
		area.set_meta("tipo", String(zona.get("tipo", "")))

		var forma := CollisionShape2D.new()
		var retangulo := RectangleShape2D.new()
		retangulo.size = Vector2(float(zona.get("w", 1)) * tamanho, float(zona.get("h", 1)) * tamanho)
		forma.shape = retangulo
		forma.position = Vector2(
			float(zona.get("x", 0)) * tamanho + retangulo.size.x * 0.5,
			float(zona.get("y", 0)) * tamanho + retangulo.size.y * 0.5
		)
		area.add_child(forma)
		grupo.add_child(area)


func _montar_spawns(dados: Dictionary, tamanho: int) -> void:
	var grupo := Node2D.new()
	grupo.name = "Spawns"
	add_child(grupo)

	for spawn in dados.get("spawns", []):
		var marcador := Marker2D.new()
		marcador.name = String(spawn.get("nome", "Spawn")).replace(" ", "_")
		marcador.set_meta("tipo", String(spawn.get("tipo", "")))
		marcador.position = Vector2(
			float(spawn.get("x", 0)) * tamanho + tamanho * 0.5,
			float(spawn.get("y", 0)) * tamanho + tamanho * 0.5
		)
		grupo.add_child(marcador)
`
}

function mapScene(slug: string): string {
  return `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://pixel_strike/recursos/${FOLDER}/${slug}/${slug}.gd" id="1_mapa"]

[node name="Mapa" type="Node2D"]
script = ExtResource("1_mapa")
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

/** Grava o mapa (imagem, atlas, dados, script e cena) na pasta mapas/. */
export async function saveMap(projectId: string, input: MapConfig): Promise<MapAsset> {
  const config = validateMapConfig(input)
  const project = await getProject(projectId)
  if (!project.folderExists) {
    throw new Error(`A pasta do projeto não foi encontrada em "${project.path}".`)
  }

  const parent = join(project.path, FOLDER)
  ensureDir(parent)
  const folder = uniqueFolder(parent, slugify(config.name))
  ensureDir(folder)
  const slug = folder.split(/[\\/]/).pop() ?? slugify(config.name)

  const map = renderMapPixels(config)
  const tileset = renderTilesetPixels(config)

  writeFileSync(join(folder, 'mapa.png'), encodePng(map.width, map.height, map.pixels))
  writeFileSync(join(folder, 'tileset.png'), encodePng(tileset.width, tileset.height, tileset.pixels))
  writeFileSync(join(folder, 'mapa.json'), mapJson(config, slug), 'utf8')
  writeFileSync(join(folder, `${slug}.gd`), mapScript(slug), 'utf8')
  writeFileSync(join(folder, `${slug}.tscn`), mapScene(slug), 'utf8')

  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const jsonPath = `${FOLDER}/${slug}/mapa.json`
  const solidCount = config.collision.filter(Boolean).length

  const data = JSON.stringify({
    folder: `${FOLDER}/${slug}`,
    themeId: config.themeId,
    width: config.width,
    height: config.height,
    tileSize: config.tileSize,
    zoneCount: config.zones.length,
    spawnCount: config.spawns.length,
    solidCount,
    imagePath: `${FOLDER}/${slug}/mapa.png`,
    tilesetPath: `${FOLDER}/${slug}/tileset.png`,
    scenePath: `${FOLDER}/${slug}/${slug}.tscn`
  })

  await execute(
    `INSERT INTO assets (id, project_id, kind, name, origin, relative_path, data, created_at, updated_at)
     VALUES (?, ?, 'mapa', ?, 'gerado', ?, ?, ?, ?)`,
    [id, projectId, config.name, jsonPath, data, createdAt, createdAt]
  )

  await logActivity(
    projectId,
    'mapa.criado',
    `Mapa "${config.name}" (${config.width}x${config.height}, tema ${config.themeId}) gerado em ${FOLDER}/${slug}.`
  )

  return {
    id,
    projectId,
    name: config.name,
    folder: `${FOLDER}/${slug}`,
    jsonPath,
    imagePath: `${FOLDER}/${slug}/mapa.png`,
    tilesetPath: `${FOLDER}/${slug}/tileset.png`,
    scenePath: `${FOLDER}/${slug}/${slug}.tscn`,
    themeId: config.themeId,
    width: config.width,
    height: config.height,
    tileSize: config.tileSize,
    zoneCount: config.zones.length,
    spawnCount: config.spawns.length,
    solidCount,
    createdAt
  }
}

interface MapRow {
  id: string
  project_id: string
  name: string
  relative_path: string
  data: string
  created_at: string
}

function toMapAsset(row: MapRow): MapAsset | null {
  try {
    const parsed = JSON.parse(row.data) as {
      folder: string
      themeId: string
      width: number
      height: number
      tileSize: number
      zoneCount: number
      spawnCount: number
      solidCount: number
      imagePath: string
      tilesetPath: string
      scenePath: string
    }
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      folder: parsed.folder,
      jsonPath: row.relative_path,
      imagePath: parsed.imagePath,
      tilesetPath: parsed.tilesetPath,
      scenePath: parsed.scenePath,
      themeId: parsed.themeId,
      width: parsed.width,
      height: parsed.height,
      tileSize: parsed.tileSize,
      zoneCount: parsed.zoneCount,
      spawnCount: parsed.spawnCount,
      solidCount: parsed.solidCount,
      createdAt: row.created_at
    }
  } catch {
    return null
  }
}

/** Lista os mapas salvos no projeto. */
export async function listMaps(projectId: string): Promise<MapAsset[]> {
  const rows = await queryAll<MapRow>(
    `SELECT id, project_id, name, relative_path, data, created_at
     FROM assets WHERE project_id = ? AND kind = 'mapa' ORDER BY created_at DESC`,
    [projectId]
  )
  return rows.map(toMapAsset).filter((asset): asset is MapAsset => asset !== null)
}

/** Lê o mapa salvo de volta para a tela (para continuar editando). */
export async function loadMap(assetId: string): Promise<MapConfig> {
  const row = await queryOne<MapRow>(
    'SELECT id, project_id, name, relative_path, data, created_at FROM assets WHERE id = ?',
    [assetId]
  )
  if (!row) throw new Error('Este mapa não existe mais no projeto.')

  const project = await getProject(row.project_id)
  const filePath = join(project.path, row.relative_path)
  if (!pathExists(filePath)) {
    throw new Error('O arquivo mapa.json deste mapa não foi encontrado na pasta do projeto.')
  }

  let parsed: {
    nome?: string
    descricao?: string
    tema?: string
    semente?: number
    largura: number
    altura: number
    tamanhoTile: number
    tiles: string[]
    colisao: number[]
    zonas: Array<{ tipo: string; nome: string; x: number; y: number; w: number; h: number }>
    spawns: Array<{ tipo: string; nome: string; x: number; y: number }>
  }

  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8')) as typeof parsed
  } catch {
    throw new Error('O arquivo mapa.json deste mapa está corrompido.')
  }

  return validateMapConfig({
    name: parsed.nome ?? row.name,
    description: parsed.descricao ?? '',
    themeId: parsed.tema ?? 'militar',
    width: parsed.largura,
    height: parsed.altura,
    tileSize: parsed.tamanhoTile,
    seed: parsed.semente ?? 1,
    tiles: parsed.tiles.map((tile) => (isTileKind(tile) ? tile : null)),
    collision: parsed.colisao.map((value) => value === 1),
    zones: parsed.zonas.map((zone, index) => ({
      id: `zona-${index + 1}`,
      kind: isZoneKind(zone.tipo) ? zone.tipo : 'segura',
      name: zone.nome,
      x: zone.x,
      y: zone.y,
      w: zone.w,
      h: zone.h
    })),
    spawns: parsed.spawns.map((spawn, index) => ({
      id: `spawn-${index + 1}`,
      kind: isSpawnKind(spawn.tipo) ? spawn.tipo : 'jogador',
      name: spawn.nome,
      x: spawn.x,
      y: spawn.y
    }))
  })
}

/** Move a pasta do mapa para a lixeira e remove o registro. */
export async function removeMap(assetId: string): Promise<void> {
  const row = await queryOne<MapRow>(
    'SELECT id, project_id, name, relative_path, data, created_at FROM assets WHERE id = ?',
    [assetId]
  )
  if (!row) throw new Error('Este mapa não existe mais.')

  const asset = toMapAsset(row)
  const project = await getProject(row.project_id)

  if (asset && project.folderExists) {
    const folder = join(project.path, asset.folder)
    if (isDirectory(folder)) {
      if (!trashDir) throw new Error('A lixeira do Studio não está configurada.')
      moveToTrash(folder, trashDir, `${timestampSlug(new Date())}_${slugify(asset.name)}`)
    }
  }

  await execute('DELETE FROM assets WHERE id = ?', [assetId])
  await logActivity(row.project_id, 'mapa.removido', `Mapa "${row.name}" movido para a lixeira.`)
}
