import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  DropEntry,
  DropMode,
  DropSource,
  DropTableAsset,
  DropTableSpec,
  DropTableStats
} from '../../shared/drops'
import {
  DROP_LIMITS,
  DROP_SOURCES,
  chanceSum,
  describeDropTable,
  dropSourceLabel,
  dropTableStats
} from '../../shared/drops'
import { ITEM_RARITIES } from '../../shared/items'
import { execute, queryAll, queryOne } from './database'
import { getProject } from './projects'
import { ensureDir, isDirectory, moveToTrash, pathExists } from './filesystem'
import { slugify, timestampSlug } from './naming'
import { logActivity } from './activity'

/**
 * Tabelas de drops (etapa 8).
 *
 * A validação é real: nas tabelas exclusivas as chances precisam somar
 * exatamente 100%, com tolerância de 0,01 para arredondamento. Nas
 * independentes cada item é validado sozinho e a soma é só informativa.
 */

const FOLDER = 'drops'
const MAX_NAME = 60

let trashDir = ''

export function configureDrops(options: { trashDir: string }): void {
  trashDir = options.trashDir
}

function isSource(value: unknown): value is DropSource {
  return typeof value === 'string' && DROP_SOURCES.some((source) => source.id === value)
}

function isMode(value: unknown): value is DropMode {
  return value === 'exclusiva' || value === 'independente'
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, Math.round(numeric)))
}

function validateEntries(entries: unknown, mode: DropMode): DropEntry[] {
  if (!Array.isArray(entries)) throw new Error('A tabela precisa de uma lista de itens.')
  if (entries.length < DROP_LIMITS.minEntries) {
    throw new Error('Adicione pelo menos um item à tabela de drops.')
  }
  if (entries.length > DROP_LIMITS.maxEntries) {
    throw new Error(`Uma tabela pode ter no máximo ${DROP_LIMITS.maxEntries} itens.`)
  }

  return entries.map((raw, index) => {
    const entry = (raw ?? {}) as Record<string, unknown>
    const itemName = String(entry['itemName'] ?? '').trim()
    if (itemName.length < 2) {
      throw new Error(`O item ${index + 1} precisa de um nome com pelo menos 2 caracteres.`)
    }

    const chanceRaw = Number(entry['chance'])
    const chance = Number.isFinite(chanceRaw)
      ? Math.round(Math.min(DROP_LIMITS.maxChance, Math.max(DROP_LIMITS.minChance, chanceRaw)) * 100) / 100
      : 100

    const min = clampInteger(entry['min'], 1, 999, 1)
    const max = Math.max(min, clampInteger(entry['max'], 1, 999, min))
    const rarity = ITEM_RARITIES.some((item) => item.id === entry['rarity'])
      ? (entry['rarity'] as DropEntry['rarity'])
      : 'comum'

    return {
      id: typeof entry['id'] === 'string' && entry['id'] ? entry['id'] : `entrada-${index + 1}`,
      itemName,
      rarity,
      chance,
      min,
      max
    }
  })
}

/** Valida e normaliza a tabela vinda da interface. */
export function validateDropTable(input: DropTableSpec): DropTableSpec {
  const name = String(input.name ?? '').trim()
  if (name.length < 2) throw new Error('O nome da tabela precisa ter pelo menos 2 caracteres.')
  if (name.length > MAX_NAME) {
    throw new Error(`O nome da tabela pode ter no máximo ${MAX_NAME} caracteres.`)
  }

  const source: DropSource = isSource(input.source) ? input.source : 'monstro'
  const mode: DropMode = isMode(input.mode) ? input.mode : 'exclusiva'
  const rolls = clampInteger(input.rolls, DROP_LIMITS.minRolls, DROP_LIMITS.maxRolls, 1)
  const entries = validateEntries(input.entries, mode)

  if (mode === 'exclusiva') {
    const total = chanceSum(entries)
    if (Math.abs(total - 100) > 0.01) {
      throw new Error(
        `As chances exclusivas somam ${total}%. Ajuste para exatamente 100% (o botão "Distribuir 100%" faz o cálculo por você).`
      )
    }
  }

  return {
    name,
    description: String(input.description ?? '').slice(0, 240),
    source,
    mode,
    rolls,
    entries
  }
}

/** Script GDScript que sorteia a tabela dentro do jogo. */
export function buildDropScript(spec: DropTableSpec, slug: string): string {
  const items = spec.entries
    .map(
      (entry) =>
        `\t\t{"nome": ${JSON.stringify(entry.itemName)}, "chance": ${entry.chance.toFixed(2)}, ` +
        `"min": ${entry.min}, "max": ${entry.max}, "raridade": ${JSON.stringify(entry.rarity)}}`
    )
    .join(',\n')

  const independente = spec.mode === 'independente'

  return `extends RefCounted

# Tabela de drops gerada pelo Pixel Strike Studio.
# Arquivo: drops/${slug}/${slug}.gd
# Fonte: ${dropSourceLabel(spec.source)} · modo: ${spec.mode}

const NOME := ${JSON.stringify(spec.name)}
const MODO := ${JSON.stringify(spec.mode)}

const TABELA := [
${items}
]

## Sorteia a tabela e devolve uma lista de {"item", "quantidade", "raridade"}.
func sortear(rng: RandomNumberGenerator = null) -> Array:
	var gerador: RandomNumberGenerator = rng if rng != null else RandomNumberGenerator.new()
	if rng == null:
		gerador.randomize()

${
  independente
    ? `\tvar resultado: Array = []
	for item in TABELA:
		if gerador.randf() * 100.0 <= float(item["chance"]):
			resultado.append_array(_montar(item, gerador))
	return resultado`
    : `\tvar sorteio: float = gerador.randf() * 100.0
	var acumulado: float = 0.0
	var escolhido: Dictionary = {}
	for item in TABELA:
		acumulado += float(item["chance"])
		if sorteio <= acumulado:
			escolhido = item
			break
	if escolhido.is_empty():
		escolhido = TABELA[TABELA.size() - 1]
	return _montar(escolhido, gerador)`
}

func _montar(item: Dictionary, gerador: RandomNumberGenerator) -> Array:
	var quantidade: int = gerador.randi_range(int(item["min"]), int(item["max"]))
	return [{"item": item["nome"], "quantidade": quantidade, "raridade": item["raridade"]}]
`
}

function buildCsv(spec: DropTableSpec): string {
  const lines = ['item;raridade;chance;min;max']
  for (const entry of spec.entries) {
    lines.push(
      `${entry.itemName};${entry.rarity};${entry.chance.toFixed(2)};${entry.min};${entry.max}`
    )
  }
  return `${lines.join('\n')}\n`
}

export function dropTableSummaryStats(input: DropTableSpec): DropTableStats {
  return dropTableStats({
    ...input,
    rolls: clampInteger(input.rolls, DROP_LIMITS.minRolls, DROP_LIMITS.maxRolls, 1)
  })
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

/** Grava a ficha JSON, o CSV e o script GDScript da tabela. */
export async function saveDropTable(
  projectId: string,
  input: DropTableSpec
): Promise<DropTableAsset> {
  const spec = validateDropTable(input)
  const project = await getProject(projectId)
  if (!project.folderExists) {
    throw new Error(`A pasta do projeto não foi encontrada em "${project.path}".`)
  }

  const parent = join(project.path, FOLDER)
  ensureDir(parent)
  const folder = uniqueFolder(parent, slugify(spec.name))
  ensureDir(folder)
  const slug = folder.split(/[\\/]/).pop() ?? slugify(spec.name)

  const stats = dropTableStats(spec)
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  const ficha = {
    formato: 1,
    id,
    geradoPor: 'Pixel Strike Studio',
    geradoEm: createdAt,
    nome: spec.name,
    descricao: spec.description,
    fonte: spec.source,
    fonteNome: dropSourceLabel(spec.source),
    modo: spec.mode,
    aberturas: spec.rolls,
    totalChance: stats.totalChance,
    itens: spec.entries.map((entry, index) => ({
      ordem: index + 1,
      nome: entry.itemName,
      raridade: entry.rarity,
      chance: entry.chance,
      quantidadeMinima: entry.min,
      quantidadeMaxima: entry.max,
      esperadoPorAbertura: stats.entries[index]?.expected ?? 0,
      chanceAoMenosUma: stats.entries[index]?.atLeastOne ?? 0
    })),
    arquivos: { script: `${slug}.gd`, planilha: `${slug}.csv` }
  }

  const jsonName = `${slug}.json`
  const scriptName = `${slug}.gd`
  const csvName = `${slug}.csv`

  writeFileSync(join(folder, jsonName), `${JSON.stringify(ficha, null, 2)}\n`, 'utf8')
  writeFileSync(join(folder, scriptName), buildDropScript(spec, slug), 'utf8')
  writeFileSync(join(folder, csvName), buildCsv(spec), 'utf8')

  const data = JSON.stringify({
    folder: `${FOLDER}/${slug}`,
    source: spec.source,
    mode: spec.mode,
    entryCount: spec.entries.length,
    totalChance: stats.totalChance,
    jsonPath: `${FOLDER}/${slug}/${jsonName}`,
    scriptPath: `${FOLDER}/${slug}/${scriptName}`,
    csvPath: `${FOLDER}/${slug}/${csvName}`,
    spec
  })

  await execute(
    `INSERT INTO assets (id, project_id, kind, name, origin, relative_path, data, created_at, updated_at)
     VALUES (?, ?, 'drop', ?, 'gerado', ?, ?, ?, ?)`,
    [id, projectId, spec.name, `${FOLDER}/${slug}/${jsonName}`, data, createdAt, createdAt]
  )

  await logActivity(
    projectId,
    'drops.criada',
    `Tabela de drops "${spec.name}" (${spec.entries.length} itens, ${describeDropTable(spec)}) gerada em ${FOLDER}/${slug}.`
  )

  return {
    id,
    projectId,
    name: spec.name,
    folder: `${FOLDER}/${slug}`,
    jsonPath: `${FOLDER}/${slug}/${jsonName}`,
    scriptPath: `${FOLDER}/${slug}/${scriptName}`,
    csvPath: `${FOLDER}/${slug}/${csvName}`,
    source: spec.source,
    mode: spec.mode,
    entryCount: spec.entries.length,
    totalChance: stats.totalChance,
    createdAt,
    spec
  }
}

interface DropRow {
  id: string
  project_id: string
  name: string
  relative_path: string
  data: string
  created_at: string
}

function toDropAsset(row: DropRow): DropTableAsset | null {
  try {
    const parsed = JSON.parse(row.data) as {
      folder: string
      source: DropSource
      mode: DropMode
      entryCount: number
      totalChance: number
      scriptPath: string
      csvPath: string
      spec: DropTableSpec
    }
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      folder: parsed.folder,
      jsonPath: row.relative_path,
      scriptPath: parsed.scriptPath,
      csvPath: parsed.csvPath,
      source: parsed.source,
      mode: parsed.mode,
      entryCount: parsed.entryCount,
      totalChance: parsed.totalChance,
      createdAt: row.created_at,
      spec: parsed.spec
    }
  } catch {
    return null
  }
}

/** Lista as tabelas de drops do projeto. */
export async function listDropTables(projectId: string): Promise<DropTableAsset[]> {
  const rows = await queryAll<DropRow>(
    `SELECT id, project_id, name, relative_path, data, created_at
     FROM assets WHERE project_id = ? AND kind = 'drop' ORDER BY created_at DESC`,
    [projectId]
  )
  return rows.map(toDropAsset).filter((asset): asset is DropTableAsset => asset !== null)
}

/** Move a pasta da tabela para a lixeira e remove o registro. */
export async function removeDropTable(assetId: string): Promise<void> {
  const row = await queryOne<DropRow>(
    'SELECT id, project_id, name, relative_path, data, created_at FROM assets WHERE id = ?',
    [assetId]
  )
  if (!row) throw new Error('Esta tabela de drops não existe mais.')

  const asset = toDropAsset(row)
  const project = await getProject(row.project_id)

  if (asset && project.folderExists) {
    const folder = join(project.path, asset.folder)
    if (isDirectory(folder)) {
      if (!trashDir) throw new Error('A lixeira do Studio não está configurada.')
      moveToTrash(folder, trashDir, `${timestampSlug(new Date())}_${slugify(asset.name)}`)
    }
  }

  await execute('DELETE FROM assets WHERE id = ?', [assetId])
  await logActivity(row.project_id, 'drops.removida', `Tabela "${row.name}" movida para a lixeira.`)
}
