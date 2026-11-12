import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  AiAudioResult,
  AiCapability,
  AiCodeResult,
  AiFileEntry,
  AiImageResult,
  AiImageSize,
  AiProviderId,
  AiProvidersView,
  AiTestResult,
  AiTextResult,
  SaveAiProviderInput
} from '../../shared/ai'
import {
  AI_IMAGE_SIZES,
  AI_LIMITS,
  AI_PROVIDERS,
  AI_VOICES,
  aiProviderById
} from '../../shared/ai'
import { execute, queryOne } from './database'
import { ensureDir } from './filesystem'
import { slugify, timestampSlug } from './naming'
import { getProject } from './projects'
import { toDataUrl } from './sprites'
import { logActivity } from './activity'

/**
 * Central de provedores de IA (etapa 9).
 *
 * - A chave é cifrada pelo armazenamento seguro do sistema
 *   (`safeStorage` no Electron) antes de ir para o banco. Nunca é gravada em
 *   texto puro, nunca é devolvida para a interface e nunca entra em logs.
 * - Se o sistema não oferecer criptografia, o Studio recusa salvar a chave em
 *   vez de guardá-la de qualquer jeito.
 * - As chamadas são HTTP reais, com tempo limite e mensagens de erro em
 *   português. Sem chave ou sem conexão, a operação falha explicando o motivo.
 */

export interface SecretStore {
  available: boolean
  encrypt(value: string): string
  decrypt(cipher: string): string
}

interface AiOptions {
  secretStore?: SecretStore | null
  /** Só para testes automatizados: troca a URL base de um provedor. */
  baseUrls?: Partial<Record<AiProviderId, string>>
}

let options: AiOptions = { secretStore: null }

export function configureAi(next: AiOptions): void {
  // Mescla para que os testes possam trocar só a URL base sem perder o
  // armazenamento seguro já configurado (e vice-versa).
  options = { ...options, ...next }
}

/* ------------------------------------------------------------------ chaves */

interface KeyRow {
  provider: string
  cipher: string
  updated_at: string
}

async function readCipher(provider: AiProviderId): Promise<KeyRow | null> {
  return queryOne<KeyRow>('SELECT provider, cipher, updated_at FROM ai_keys WHERE provider = ?', [
    provider
  ])
}

function decryptKey(row: KeyRow | null): string | null {
  if (!row) return null
  if (!options.secretStore?.available) return null
  try {
    const value = options.secretStore.decrypt(row.cipher)
    return value.trim() ? value : null
  } catch {
    return null
  }
}

async function readSetting(key: string): Promise<string | null> {
  const row = await queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])
  if (!row) return null
  try {
    const parsed: unknown = JSON.parse(row.value)
    return typeof parsed === 'string' ? parsed : null
  } catch {
    return row.value
  }
}

async function writeSetting(key: string, value: string): Promise<void> {
  await execute(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, JSON.stringify(value), new Date().toISOString()]
  )
}

export async function listAiProviders(): Promise<AiProvidersView> {
  const providers = await Promise.all(
    AI_PROVIDERS.map(async (definition) => {
      const row = await readCipher(definition.id)
      const model = (await readSetting(`ai.${definition.id}.model`)) ?? definition.defaultModel
      const imageModel =
        (await readSetting(`ai.${definition.id}.imageModel`)) ?? definition.imageModel
      const audioModel =
        (await readSetting(`ai.${definition.id}.audioModel`)) ?? definition.audioModel
      const voice = (await readSetting(`ai.${definition.id}.voice`)) ?? definition.defaultVoice
      const configured = Boolean(row) && Boolean(options.secretStore?.available)

      return {
        id: definition.id,
        label: definition.label,
        capabilities: definition.capabilities,
        configured,
        model,
        imageModel,
        audioModel,
        voice: AI_VOICES.includes(voice as (typeof AI_VOICES)[number]) ? voice : definition.defaultVoice,
        keySavedAt: row ? row.updated_at : null,
        docsUrl: definition.docsUrl
      }
    })
  )

  const preferred = providers.find((provider) => provider.configured)?.id ?? null
  return { secureStorage: Boolean(options.secretStore?.available), providers, preferred }
}

export async function saveAiProvider(input: SaveAiProviderInput): Promise<AiProvidersView> {
  const definition = aiProviderById(input.provider)

  if (typeof input.key === 'string' && input.key.trim()) {
    const key = input.key.trim()
    if (key.length < 12) throw new Error('A chave parece curta demais. Confira e cole novamente.')
    if (key.length > AI_LIMITS.maxKeyLength) throw new Error('A chave é longa demais.')

    if (!options.secretStore?.available) {
      throw new Error(
        'O armazenamento seguro do sistema não está disponível nesta máquina, então a chave não foi salva. Nada foi gravado em texto puro.'
      )
    }

    const cipher = options.secretStore.encrypt(key)
    await execute(
      `INSERT INTO ai_keys (provider, cipher, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(provider) DO UPDATE SET cipher = excluded.cipher, updated_at = excluded.updated_at`,
      [definition.id, cipher, new Date().toISOString()]
    )
    await logActivity(null, 'ia.chave', `Chave de ${definition.label} salva com criptografia do sistema.`)
  }

  if (input.model !== undefined) {
    const model = String(input.model).trim()
    if (model.length > 80) throw new Error('O nome do modelo é longo demais.')
    await writeSetting(`ai.${definition.id}.model`, model || definition.defaultModel)
  }
  if (input.imageModel !== undefined) {
    await writeSetting(`ai.${definition.id}.imageModel`, String(input.imageModel).trim())
  }
  if (input.audioModel !== undefined) {
    await writeSetting(`ai.${definition.id}.audioModel`, String(input.audioModel).trim())
  }
  if (input.voice !== undefined) {
    const voice = String(input.voice).trim()
    await writeSetting(
      `ai.${definition.id}.voice`,
      AI_VOICES.includes(voice as (typeof AI_VOICES)[number]) ? voice : definition.defaultVoice
    )
  }

  return listAiProviders()
}

export async function removeAiKey(provider: AiProviderId): Promise<AiProvidersView> {
  const definition = aiProviderById(provider)
  await execute('DELETE FROM ai_keys WHERE provider = ?', [definition.id])
  await logActivity(null, 'ia.chave.removida', `Chave de ${definition.label} removida.`)
  return listAiProviders()
}

/* ------------------------------------------------------------------- HTTP */

function baseUrl(provider: AiProviderId): string {
  return options.baseUrls?.[provider] ?? aiProviderById(provider).baseUrl
}

interface ProviderTarget {
  provider: AiProviderId
  definition: ReturnType<typeof aiProviderById>
  key: string
  model: string
  imageModel: string
  audioModel: string
  voice: string
}

async function targetFor(
  provider: AiProviderId | undefined,
  capability: AiCapability
): Promise<ProviderTarget> {
  const view = await listAiProviders()
  const chosen =
    (provider ? view.providers.find((item) => item.id === provider) : undefined) ??
    view.providers.find((item) => item.configured)

  if (!chosen) {
    throw new Error(
      provider
        ? 'Este provedor ainda não está configurado. Abra a central de IA, cole a chave e salve.'
        : 'Nenhum provedor de IA está configurado. Abra a central de IA, cole a chave de um provedor e salve.'
    )
  }
  if (!chosen.capabilities.includes(capability)) {
    throw new Error(`${chosen.label} não oferece ${capability}. Escolha outro provedor.`)
  }

  const row = await readCipher(chosen.id)
  const key = decryptKey(row)
  if (!key) {
    throw new Error('A chave salva não pôde ser aberta pelo armazenamento seguro do sistema. Salve a chave novamente.')
  }

  return {
    provider: chosen.id,
    definition: aiProviderById(chosen.id),
    key,
    model: chosen.model || aiProviderById(chosen.id).defaultModel,
    imageModel: chosen.imageModel || aiProviderById(chosen.id).imageModel,
    audioModel: chosen.audioModel || aiProviderById(chosen.id).audioModel,
    voice: chosen.voice || aiProviderById(chosen.id).defaultVoice
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`O provedor demorou mais de ${Math.round(timeoutMs / 1000)}s para responder.`)
    }
    throw new Error(
      'Não foi possível conectar ao provedor de IA. Confira a internet, o firewall e o endereço do serviço.'
    )
  } finally {
    clearTimeout(timer)
  }
}

function errorFromStatus(status: number, label: string, detail: string): Error {
  const clean = detail.replace(/\s+/g, ' ').slice(0, 220)
  if (status === 401 || status === 403) {
    return new Error(`${label} recusou a chave (HTTP ${status}). Confira a chave e as permissões. ${clean}`)
  }
  if (status === 404) {
    return new Error(`${label} não encontrou o modelo ou o caminho (HTTP 404). Confira o nome do modelo. ${clean}`)
  }
  if (status === 429) {
    return new Error(`${label} informou limite de uso ou créditos insuficientes (HTTP 429). ${clean}`)
  }
  if (status >= 500) {
    return new Error(`${label} está instável agora (HTTP ${status}). Tente de novo em alguns minutos.`)
  }
  return new Error(`${label} respondeu HTTP ${status}. ${clean}`)
}

/** Cada provedor tem o seu caminho de chat: a Anthropic usa /messages. */
function chatUrl(target: ProviderTarget): string {
  return target.provider === 'anthropic'
    ? `${baseUrl(target.provider)}/messages`
    : `${baseUrl(target.provider)}/chat/completions`
}

function authHeaders(target: ProviderTarget): Record<string, string> {
  if (target.provider === 'anthropic') {
    return {
      'content-type': 'application/json',
      'x-api-key': target.key,
      'anthropic-version': '2023-06-01'
    }
  }
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${target.key}`
  }
  if (target.provider === 'openrouter') {
    headers['x-title'] = 'Pixel Strike Studio'
  }
  return headers
}

/** Modelos de cada provedor têm formatos de mensagem diferentes. */
function chatPayload(
  target: ProviderTarget,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  maxTokens: number,
  json: boolean
): unknown {
  if (target.provider === 'anthropic') {
    const system = messages.find((message) => message.role === 'system')?.content ?? ''
    const rest = messages.filter((message) => message.role !== 'system')
    return {
      model: target.model,
      max_tokens: maxTokens,
      temperature: 0.4,
      system,
      messages: rest.map((message) => ({ role: message.role, content: message.content }))
    }
  }
  return {
    model: target.model,
    max_tokens: maxTokens,
    temperature: 0.4,
    messages,
    ...(json ? { response_format: { type: 'json_object' } } : {})
  }
}

function chatBodyText(provider: AiProviderId, payload: unknown): string {
  const data = payload as Record<string, unknown>

  if (provider === 'anthropic') {
    const content = data['content']
    if (!Array.isArray(content)) return ''
    return content
      .map((part) => {
        const block = part as Record<string, unknown>
        return typeof block['text'] === 'string' ? block['text'] : ''
      })
      .join('')
      .trim()
  }

  const choices = data['choices']
  if (!Array.isArray(choices) || choices.length === 0) return ''
  const first = choices[0] as Record<string, unknown>
  const message = first['message'] as Record<string, unknown> | undefined
  const content = message?.['content']
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        const block = part as Record<string, unknown>
        return typeof block['text'] === 'string' ? block['text'] : ''
      })
      .join('')
      .trim()
  }
  return ''
}

export interface ChatInput {
  prompt: string
  system?: string
  provider?: AiProviderId
  json?: boolean
  maxTokens?: number
}

/** Uma chamada real de chat, com a resposta em texto. */
export async function generateText(input: ChatInput): Promise<AiTextResult> {
  const prompt = String(input.prompt ?? '').trim()
  if (!prompt) throw new Error('Escreva o que você quer pedir para a IA.')
  if (prompt.length > AI_LIMITS.maxPrompt) {
    throw new Error(`O pedido pode ter no máximo ${AI_LIMITS.maxPrompt} caracteres.`)
  }

  const target = await targetFor(input.provider, 'texto')
  const messages: Array<{ role: 'system' | 'user'; content: string }> = []
  if (input.system) messages.push({ role: 'system', content: input.system })
  messages.push({ role: 'user', content: prompt })

  const response = await fetchWithTimeout(
    chatUrl(target),
    {
      method: 'POST',
      headers: authHeaders(target),
      body: JSON.stringify(
        chatPayload(target, messages, input.maxTokens ?? 1200, input.json === true)
      )
    },
    90_000
  )

  const text = await response.text()
  if (!response.ok) {
    throw errorFromStatus(response.status, target.definition.label, text)
  }

  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error('O provedor respondeu algo que não é JSON. Tente novamente.')
  }

  const content = chatBodyText(target.provider, payload)
  if (!content) throw new Error('O provedor respondeu vazio. Tente novamente.')

  return { text: content.slice(0, AI_LIMITS.maxText), provider: target.provider, model: target.model }
}

/** Teste real de chave/modelo: faz uma chamada mínima e mede o tempo. */
export async function testAiProvider(provider: AiProviderId): Promise<AiTestResult> {
  const started = Date.now()
  const target = await targetFor(provider, 'texto')
  const messages = [{ role: 'user' as const, content: 'Responda apenas: ok' }]

  const response = await fetchWithTimeout(
    chatUrl(target),
    {
      method: 'POST',
      headers: authHeaders(target),
      body: JSON.stringify(chatPayload(target, messages, 20, false))
    },
    30_000
  )

  const text = await response.text()
  const latencyMs = Date.now() - started

  if (!response.ok) {
    throw errorFromStatus(response.status, target.definition.label, text)
  }

  return {
    ok: true,
    message: `${target.definition.label} respondeu em ${latencyMs} ms usando ${target.model}.`,
    latencyMs,
    provider: target.provider,
    model: target.model
  }
}

/* -------------------------------------------------------------- código */

export interface CodeInput {
  prompt: string
  projectId?: string
  provider?: AiProviderId
}

const CODE_SYSTEM =
  'Você escreve código GDScript 4 para Godot 4. Responda em JSON com as chaves ' +
  '"codigo" (o script completo, pronto para colar) e "explicacao" (2 frases em português). ' +
  'Use tipagem estática, nomes em português e nada de dependências externas.'

export async function generateCode(input: CodeInput): Promise<AiCodeResult> {
  const result = await generateText({
    prompt: input.prompt,
    system: CODE_SYSTEM,
    provider: input.provider,
    json: true,
    maxTokens: 2000
  })

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(result.text) as Record<string, unknown>
  } catch {
    throw new Error(
      'A IA não devolveu o JSON esperado. Tente de novo ou descreva o script com mais detalhes.'
    )
  }

  const code = typeof parsed['codigo'] === 'string' ? parsed['codigo'] : ''
  const explanation = typeof parsed['explicacao'] === 'string' ? parsed['explicacao'] : ''
  if (!code.trim()) throw new Error('A IA respondeu sem código. Tente novamente.')

  let relativePath: string | null = null
  if (input.projectId) {
    const project = await getProject(input.projectId)
    if (!project.folderExists) {
      throw new Error(`A pasta do projeto não foi encontrada em "${project.path}".`)
    }
    const folder = join(project.path, 'ia', 'codigo')
    ensureDir(folder)
    const fileName = `${slugify(input.prompt).slice(0, 40) || 'script'}-${timestampSlug(new Date())}.gd`
    writeFileSync(join(folder, fileName), `${code}\n`, 'utf8')
    relativePath = `ia/codigo/${fileName}`
    await logActivity(input.projectId, 'ia.codigo', `Script GDScript gerado pela IA em ${relativePath}.`)
  }

  return {
    code,
    explanation: explanation || 'Código gerado pelo provedor de IA.',
    provider: result.provider,
    model: result.model,
    relativePath
  }
}

/* -------------------------------------------------------------- imagem */

export interface ImageInput {
  projectId: string
  prompt: string
  size: AiImageSize
  provider?: AiProviderId
}

export async function generateImage(input: ImageInput): Promise<AiImageResult> {
  const prompt = String(input.prompt ?? '').trim()
  if (!prompt) throw new Error('Descreva a imagem que você quer gerar.')
  if (prompt.length > AI_LIMITS.maxPrompt) {
    throw new Error(`A descrição pode ter no máximo ${AI_LIMITS.maxPrompt} caracteres.`)
  }

  const size = AI_IMAGE_SIZES.includes(input.size) ? input.size : '1024x1024'
  const target = await targetFor(input.provider, 'imagem')
  if (!target.imageModel) {
    throw new Error(`${target.definition.label} não oferece geração de imagem nesta versão.`)
  }

  const response = await fetchWithTimeout(
    `${baseUrl(target.provider)}/images/generations`,
    {
      method: 'POST',
      headers: authHeaders(target),
      body: JSON.stringify({
        model: target.imageModel,
        prompt,
        size,
        n: 1
      })
    },
    150_000
  )

  const body = await response.text()
  if (!response.ok) throw errorFromStatus(response.status, target.definition.label, body)

  let parsed: { data?: Array<{ b64_json?: string; url?: string }> }
  try {
    parsed = JSON.parse(body) as typeof parsed
  } catch {
    throw new Error('O provedor respondeu algo que não é JSON na geração de imagem.')
  }

  const item = parsed.data?.[0]
  let buffer: Buffer | null = null
  if (item?.b64_json) {
    buffer = Buffer.from(item.b64_json, 'base64')
  } else if (item?.url) {
    const download = await fetchWithTimeout(item.url, { method: 'GET' }, 60_000)
    if (!download.ok) throw new Error('A imagem foi gerada, mas não pôde ser baixada.')
    buffer = Buffer.from(await download.arrayBuffer())
  }

  if (!buffer || buffer.length === 0) {
    throw new Error('O provedor não devolveu nenhuma imagem. Tente outro pedido.')
  }

  const project = await getProject(input.projectId)
  if (!project.folderExists) {
    throw new Error(`A pasta do projeto não foi encontrada em "${project.path}".`)
  }
  const folder = join(project.path, 'ia', 'imagens')
  ensureDir(folder)
  const fileName = `${slugify(prompt).slice(0, 40) || 'imagem'}-${timestampSlug(new Date())}.png`
  writeFileSync(join(folder, fileName), buffer)

  const relativePath = `ia/imagens/${fileName}`
  await logActivity(input.projectId, 'ia.imagem', `Imagem gerada pela IA em ${relativePath}.`)

  return {
    relativePath,
    dataUrl: toDataUrl(buffer),
    provider: target.provider,
    model: target.imageModel,
    prompt
  }
}

/* --------------------------------------------------------------- áudio */

export interface AudioInput {
  projectId: string
  text: string
  provider?: AiProviderId
}

export async function generateAudio(input: AudioInput): Promise<AiAudioResult> {
  const text = String(input.text ?? '').trim()
  if (!text) throw new Error('Escreva o texto que será falado.')
  if (text.length > AI_LIMITS.maxPrompt) {
    throw new Error(`O texto pode ter no máximo ${AI_LIMITS.maxPrompt} caracteres.`)
  }

  const target = await targetFor(input.provider, 'audio')
  if (!target.audioModel) {
    throw new Error(`${target.definition.label} não oferece geração de voz nesta versão.`)
  }

  const response = await fetchWithTimeout(
    `${baseUrl(target.provider)}/audio/speech`,
    {
      method: 'POST',
      headers: authHeaders(target),
      body: JSON.stringify({
        model: target.audioModel,
        voice: target.voice,
        input: text,
        response_format: 'mp3'
      })
    },
    90_000
  )

  if (!response.ok) {
    throw errorFromStatus(response.status, target.definition.label, await response.text())
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length === 0) throw new Error('O provedor não devolveu áudio.')

  const project = await getProject(input.projectId)
  if (!project.folderExists) {
    throw new Error(`A pasta do projeto não foi encontrada em "${project.path}".`)
  }
  const folder = join(project.path, 'ia', 'audio')
  ensureDir(folder)
  const fileName = `${slugify(text).slice(0, 40) || 'voz'}-${timestampSlug(new Date())}.mp3`
  writeFileSync(join(folder, fileName), buffer)

  const relativePath = `ia/audio/${fileName}`
  await logActivity(input.projectId, 'ia.audio', `Áudio gerado pela IA em ${relativePath}.`)

  return { relativePath, provider: target.provider, model: target.audioModel, bytes: buffer.length }
}

/** Lista arquivos já gerados pela IA dentro do projeto (imagens, código e áudio). */

export async function listAiFiles(projectId: string): Promise<AiFileEntry[]> {
  const project = await getProject(projectId)
  if (!project.folderExists) return []

  const folders: Array<{ folder: string; kind: AiFileEntry['kind']; extension: string }> = [
    { folder: 'imagens', kind: 'imagem', extension: '.png' },
    { folder: 'codigo', kind: 'codigo', extension: '.gd' },
    { folder: 'audio', kind: 'audio', extension: '.mp3' }
  ]

  const entries: AiFileEntry[] = []
  for (const item of folders) {
    const directory = join(project.path, 'ia', item.folder)
    let names: string[] = []
    try {
      names = readdirSync(directory)
    } catch {
      continue
    }
    for (const name of names) {
      if (!name.toLowerCase().endsWith(item.extension)) continue
      const fullPath = join(directory, name)
      let info: ReturnType<typeof statSync>
      try {
        info = statSync(fullPath)
      } catch {
        continue
      }
      if (!info.isFile()) continue
      entries.push({
        relativePath: `ia/${item.folder}/${name}`,
        name,
        kind: item.kind,
        bytes: info.size,
        createdAt: info.mtime.toISOString()
      })
    }
  }

  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
