import type {
  AssistantApplyResult,
  AssistantCreated,
  AssistantPlan,
  AssistantPlanRequest,
  AssistantPlanStep,
  CreationKind
} from '../../shared/ai'
import { AI_LIMITS, CREATION_KIND_LABELS } from '../../shared/ai'
import type { DropTableSpec } from '../../shared/drops'
import { describeDropTable, normalizeEntries } from '../../shared/drops'
import type { EffectSpec } from '../../shared/effects'
import { EFFECT_LABELS } from '../../shared/effects'
import type { ItemSpec } from '../../shared/items'
import { describeItem, defaultItemSpec, ITEM_CATEGORY_LABELS } from '../../shared/items'
import type { SkillSpec } from '../../shared/skills'
import { defaultSkillSpec, describeSkillParams, SKILL_KIND_LABELS } from '../../shared/skills'
import type { WeaponSpec } from '../../shared/weapons'
import { rarityById, weaponBaseById } from '../../shared/weapons'
import { generateText } from './ai'
import { getProject } from './projects'
import { validateItemSpec, saveItem } from './items'
import { validateDropTable, saveDropTable } from './drops'
import { validateEffectSpec, saveEffect } from './effects'
import { validateSkillSpec, saveSkill } from './skills'
import { validateWeaponSpec, saveWeapon } from './weapons'

/**
 * Assistente de criações (etapa 9).
 *
 * O pedido em português vai para o provedor de IA escolhido, que devolve um
 * plano em JSON. Cada criação é validada pelos mesmos geradores das etapas 3 a
 * 8 antes de aparecer na prévia — o que você vê é exatamente o que será salvo.
 * Nada é gravado sem a confirmação explícita.
 */

const KINDS: CreationKind[] = ['item', 'drops', 'efeito', 'habilidade', 'arma']

function isKind(value: unknown): value is CreationKind {
  return typeof value === 'string' && KINDS.includes(value as CreationKind)
}

const SYSTEM_PROMPT = `Você é o assistente do Pixel Strike Studio, um estúdio de jogos 2D em pixel art.
Responda SEMPRE com um único objeto JSON, sem texto fora do JSON, neste formato:

{"resumo": "uma frase explicando o plano", "criacoes": [{"tipo": "item", "especificacao": { ... }}]}

Tipos permitidos e campos de cada especificação (todos opcionais exceto o nome):
- "item": {"name": "Colete Tático", "category": "colete|capacete|mochila|seringa|kit|chave|especial", "description": "...", "rarity": "comum|incomum|raro|epico|lendario", "attributes": {"armadura": 0-100, "capacidade": 0-60, "cura": 0-200, "durabilidade": 0-100, "valor": 0-100000}}
- "drops": {"name": "...", "description": "...", "source": "monstro|caixa|missao|evento", "mode": "exclusiva|independente", "rolls": 1-20, "entries": [{"itemName": "...", "rarity": "comum|incomum|raro|epico|lendario", "chance": 0.01-100, "min": 1-999, "max": 1-999}]}
- "efeito": {"name": "...", "kind": "explosao|fumaca|fogo|impacto|sangue|cura|faisca", "colors": {"primaria": "#rrggbb", "secundaria": "#rrggbb"}, "size": 32|64|96, "frames": 2-16, "fps": 1-30}
- "habilidade": {"name": "...", "description": "...", "kind": "area|projetil|cura|escudo|mobilidade|utilitaria", "effectKind": "explosao|fumaca|fogo|impacto|sangue|cura|faisca", "params": {"dano": 0-500, "alcance": 0-1200, "raio": 4-400, "duracao": 0.1-30, "recarga": 0.1-120, "custo": 0-200, "velocidade": 0-2000}}
- "arma": {"name": "...", "baseId": "ak47|m4a4|awp|desert-eagle|glock|usp-s|mp5|p90|faca", "rarity": "azul|roxo|rosa|vermelho|dourado|bluegem", "wear": "nova|pouco-usada|testada|desgastada|bem-desgastada", "pattern": "solido|listras|camuflado|digital|gradiente|chamas", "colors": {"primaria": "#rrggbb", "secundaria": "#rrggbb"}}

Crie no máximo 6 itens por resposta. Use português do Brasil em todos os nomes e descrições.
Nas tabelas exclusivas, faça as chances somarem 100.`

interface RawCreation {
  tipo?: unknown
  especificacao?: unknown
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function nameOf(raw: Record<string, unknown>, fallback: string): string {
  const name = typeof raw['name'] === 'string' ? raw['name'].trim() : ''
  return name || fallback
}

interface BuiltStep {
  spec: ItemSpec | DropTableSpec | EffectSpec | SkillSpec | WeaponSpec
  name: string
  summary: string
}

/** Valida e normaliza uma criação usando o gerador correspondente. */
function buildStep(kind: CreationKind, rawInput: unknown): BuiltStep {
  const raw = asRecord(rawInput)

  if (kind === 'item') {
    const base = defaultItemSpec()
    const spec = validateItemSpec({
      ...base,
      ...raw,
      name: nameOf(raw, base.name),
      category: raw['category'] ?? base.category,
      attributes: { ...base.attributes, ...asRecord(raw['attributes']) }
    } as ItemSpec)
    return {
      spec,
      name: spec.name,
      summary: `${ITEM_CATEGORY_LABELS[spec.category]} · ${spec.rarity} · ${describeItem(spec) || 'sem atributos'}`
    }
  }

  if (kind === 'drops') {
    const rawEntries = Array.isArray(raw['entries']) ? raw['entries'] : []
    const baseEntries = rawEntries.map((entry, index) => {
      const item = asRecord(entry)
      return {
        id: `entrada-${index + 1}`,
        itemName: String(item['itemName'] ?? item['nome'] ?? `Item ${index + 1}`),
        rarity:
          typeof item['rarity'] === 'string'
            ? (item['rarity'] as DropTableSpec['entries'][number]['rarity'])
            : 'comum',
        chance: Number(item['chance'] ?? 10),
        min: Number(item['min'] ?? 1),
        max: Number(item['max'] ?? 1)
      }
    })

    const mode = raw['mode'] === 'independente' ? 'independente' : 'exclusiva'
    // Nas tabelas exclusivas as chances são reajustadas para 100% antes da validação.
    const entries =
      mode === 'exclusiva' && baseEntries.length > 0 ? normalizeEntries(baseEntries) : baseEntries

    const spec = validateDropTable({
      name: nameOf(raw, 'Tabela de drops'),
      description: typeof raw['description'] === 'string' ? raw['description'] : '',
      source: raw['source'] ?? 'monstro',
      mode,
      rolls: Number(raw['rolls'] ?? 1),
      entries
    } as DropTableSpec)

    return {
      spec,
      name: spec.name,
      summary: describeDropTable(spec) + (mode === 'exclusiva' ? ' · chances reajustadas para 100%' : '')
    }
  }

  if (kind === 'efeito') {
    const colors = asRecord(raw['colors'])
    const spec = validateEffectSpec({
      kind: raw['kind'] ?? 'explosao',
      name: nameOf(raw, 'Efeito'),
      colors: {
        primaria: typeof colors['primaria'] === 'string' ? colors['primaria'] : '#fbbf24',
        secundaria: typeof colors['secundaria'] === 'string' ? colors['secundaria'] : '#b91c1c'
      },
      size: raw['size'] ?? 64,
      frames: raw['frames'] ?? 6,
      fps: raw['fps'] ?? 12,
      seed: raw['seed'] ?? Math.floor(Math.random() * 100000) + 1
    } as EffectSpec)
    return {
      spec,
      name: spec.name,
      summary: `${EFFECT_LABELS[spec.kind]} · ${spec.frames} quadros · ${spec.fps} FPS · ${spec.size} px`
    }
  }

  if (kind === 'habilidade') {
    const base = defaultSkillSpec()
    const colors = asRecord(raw['colors'])
    const spec = validateSkillSpec({
      ...base,
      ...raw,
      name: nameOf(raw, base.name),
      effectKind: raw['effectKind'] ?? base.effectKind,
      params: { ...base.params, ...asRecord(raw['params']) },
      colors: {
        primaria:
          typeof colors['primaria'] === 'string' ? colors['primaria'] : base.colors.primaria,
        secundaria:
          typeof colors['secundaria'] === 'string' ? colors['secundaria'] : base.colors.secundaria
      },
      seed: raw['seed'] ?? base.seed
    } as SkillSpec)
    return {
      spec,
      name: spec.name,
      summary: `${SKILL_KIND_LABELS[spec.kind]} · ${describeSkillParams(spec)}`
    }
  }

  const spec = validateWeaponSpec({
    baseId: typeof raw['baseId'] === 'string' ? raw['baseId'] : 'ak47',
    name: nameOf(raw, 'Skin'),
    rarity: raw['rarity'] ?? 'azul',
    wear: raw['wear'] ?? 'nova',
    float: raw['float'] ?? 0.05,
    pattern: raw['pattern'] ?? 'solido',
    colors: asRecord(raw['colors']),
    seed: raw['seed'] ?? 1234,
    size: raw['size'] ?? 64
  } as unknown as WeaponSpec)

  return {
    spec,
    name: spec.name,
    summary: `${weaponBaseById(spec.baseId).label} · ${rarityById(spec.rarity).label} · ${spec.pattern}`
  }
}

/** Interpreta o pedido e devolve o plano — ainda sem gravar nada. */
export async function planCreations(input: AssistantPlanRequest): Promise<AssistantPlan> {
  const request = String(input.request ?? '').trim()
  if (request.length < 4) throw new Error('Descreva o que você quer criar com pelo menos 4 caracteres.')
  if (request.length > AI_LIMITS.maxPrompt) {
    throw new Error(`O pedido pode ter no máximo ${AI_LIMITS.maxPrompt} caracteres.`)
  }

  const project = await getProject(input.projectId)
  if (!project.folderExists) {
    throw new Error(`A pasta do projeto não foi encontrada em "${project.path}".`)
  }

  const result = await generateText({
    prompt: `Projeto: ${project.name}\nPedido do usuário: ${request}`,
    system: SYSTEM_PROMPT,
    provider: input.provider,
    json: true,
    maxTokens: 2200
  })

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(result.text) as Record<string, unknown>
  } catch {
    throw new Error(
      'A IA não devolveu um JSON válido. Tente escrever o pedido de outro jeito.'
    )
  }

  const rawList = Array.isArray(parsed['criacoes'])
    ? parsed['criacoes']
    : Array.isArray(parsed['itens'])
      ? parsed['itens']
      : []

  if (rawList.length === 0) {
    throw new Error('A IA não propôs nenhuma criação. Tente descrever o que você quer com mais detalhes.')
  }
  if (rawList.length > 6) {
    throw new Error('A IA propôs mais de 6 criações. Peça menos coisas por vez.')
  }

  const steps: AssistantPlanStep[] = rawList.map((entry) => {
    const creation = asRecord(entry) as RawCreation
    const kind: CreationKind = isKind(creation.tipo) ? creation.tipo : 'item'
    const rawSpec = asRecord(creation.especificacao)

    try {
      const built = buildStep(kind, rawSpec)
      return {
        kind,
        name: built.name,
        summary: built.summary,
        payload: built.spec,
        problem: null
      }
    } catch (error) {
      const name = nameOf(rawSpec, `Criação sem nome`)
      return {
        kind,
        name,
        summary: `${CREATION_KIND_LABELS[kind]} · especificação incompleta`,
        payload: rawSpec,
        problem: error instanceof Error ? error.message : 'A especificação não passou na validação.'
      }
    }
  })

  const valid = steps.filter((step) => step.problem === null).length
  if (valid === 0) {
    const first = steps[0]?.problem ?? 'Nenhuma criação válida.'
    throw new Error(`A IA propôs apenas criações inválidas: ${first}`)
  }

  return {
    id: crypto.randomUUID(),
    request,
    summary:
      typeof parsed['resumo'] === 'string' && parsed['resumo'].trim()
        ? parsed['resumo'].trim()
        : `Plano com ${steps.length} criação(ões).`,
    steps,
    provider: result.provider,
    model: result.model,
    createdAt: new Date().toISOString()
  }
}

/** Cria de verdade o que está no plano, usando os geradores já testados. */
export async function applyPlan(
  projectId: string,
  plan: AssistantPlan
): Promise<AssistantApplyResult> {
  const created: AssistantCreated[] = []
  const skipped: Array<{ name: string; reason: string }> = []

  for (const step of plan.steps) {
    if (step.problem) {
      skipped.push({ name: step.name, reason: step.problem })
      continue
    }

    try {
      if (step.kind === 'item') {
        const asset = await saveItem(projectId, step.payload as ItemSpec)
        created.push({ kind: step.kind, name: asset.name, path: asset.iconPath })
      } else if (step.kind === 'drops') {
        const asset = await saveDropTable(projectId, step.payload as DropTableSpec)
        created.push({ kind: step.kind, name: asset.name, path: asset.scriptPath })
      } else if (step.kind === 'efeito') {
        const asset = await saveEffect(projectId, step.payload as EffectSpec)
        created.push({ kind: step.kind, name: asset.name, path: asset.sheetPath })
      } else if (step.kind === 'habilidade') {
        const asset = await saveSkill(projectId, step.payload as SkillSpec)
        created.push({ kind: step.kind, name: asset.name, path: asset.scriptPath })
      } else {
        const asset = await saveWeapon(projectId, step.payload as WeaponSpec)
        created.push({ kind: step.kind, name: asset.name, path: asset.iconPath })
      }
    } catch (error) {
      skipped.push({
        name: step.name,
        reason: error instanceof Error ? error.message : 'Não foi possível salvar.'
      })
    }
  }

  return { created, skipped }
}
