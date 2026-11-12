/**
 * Central de IA e assistente (etapa 9).
 *
 * As chaves **nunca** saem do processo principal: a interface só sabe se um
 * provedor está configurado. Toda chamada é feita pelo processo principal com
 * fetch nativo e tempo limite, e nenhum resultado é inventado — se não houver
 * chave ou conexão, o Studio diz exatamente isso.
 */

export type AiProviderId = 'openai' | 'anthropic' | 'openrouter'

export type AiCapability = 'texto' | 'codigo' | 'imagem' | 'audio'

export const AI_CAPABILITY_LABELS: Record<AiCapability, string> = {
  texto: 'Texto',
  codigo: 'Código',
  imagem: 'Imagem',
  audio: 'Áudio (voz)'
}

export interface AiProviderDefinition {
  id: AiProviderId
  label: string
  baseUrl: string
  docsUrl: string
  capabilities: AiCapability[]
  defaultModel: string
  imageModel: string
  audioModel: string
  defaultVoice: string
}

export const AI_PROVIDERS: AiProviderDefinition[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    docsUrl: 'https://platform.openai.com/api-keys',
    capabilities: ['texto', 'codigo', 'imagem', 'audio'],
    defaultModel: 'gpt-4o-mini',
    imageModel: 'gpt-image-1',
    audioModel: 'gpt-4o-mini-tts',
    defaultVoice: 'alloy'
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com/v1',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    capabilities: ['texto', 'codigo'],
    defaultModel: 'claude-sonnet-4-5',
    imageModel: '',
    audioModel: '',
    defaultVoice: ''
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    docsUrl: 'https://openrouter.ai/keys',
    capabilities: ['texto', 'codigo'],
    defaultModel: 'openai/gpt-4o-mini',
    imageModel: '',
    audioModel: '',
    defaultVoice: ''
  }
]

export function aiProviderById(id: string): AiProviderDefinition {
  return AI_PROVIDERS.find((provider) => provider.id === id) ?? (AI_PROVIDERS[0] as AiProviderDefinition)
}

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === 'string' && AI_PROVIDERS.some((provider) => provider.id === value)
}

export interface AiProviderState {
  id: AiProviderId
  label: string
  capabilities: AiCapability[]
  configured: boolean
  model: string
  imageModel: string
  audioModel: string
  voice: string
  keySavedAt: string | null
  docsUrl: string
}

export interface AiProvidersView {
  /** Verdadeiro quando o sistema operacional oferece criptografia disponível. */
  secureStorage: boolean
  providers: AiProviderState[]
  /** Provedor usado quando a interface não escolhe um. */
  preferred: AiProviderId | null
}

export interface AiTestResult {
  ok: boolean
  message: string
  latencyMs: number
  provider: AiProviderId
  model: string
}

export interface AiTextResult {
  text: string
  provider: AiProviderId
  model: string
}

export interface AiCodeResult {
  code: string
  explanation: string
  provider: AiProviderId
  model: string
  relativePath: string | null
}

export interface AiImageResult {
  relativePath: string
  dataUrl: string
  provider: AiProviderId
  model: string
  prompt: string
}

export interface AiAudioResult {
  relativePath: string
  provider: AiProviderId
  model: string
  bytes: number
}

export const AI_IMAGE_SIZES = ['1024x1024', '1024x1536', '1536x1024'] as const
export type AiImageSize = (typeof AI_IMAGE_SIZES)[number]

export const AI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const

export const AI_LIMITS = {
  maxPrompt: 2000,
  maxKeyLength: 400,
  maxText: 8000
} as const

export interface SaveAiProviderInput {
  provider: AiProviderId
  /** Chave em texto puro: só atravessa o IPC uma vez e é cifrada no processo principal. */
  key?: string | null
  model?: string
  imageModel?: string
  audioModel?: string
  voice?: string
}

export interface AiFileEntry {
  relativePath: string
  name: string
  kind: 'imagem' | 'codigo' | 'audio'
  bytes: number
  createdAt: string
}

/* ------------------------------------------------------------- assistente */

export type CreationKind = 'item' | 'drops' | 'efeito' | 'habilidade' | 'arma'

export const CREATION_KIND_LABELS: Record<CreationKind, string> = {
  item: 'Item',
  drops: 'Tabela de drops',
  efeito: 'Efeito',
  habilidade: 'Habilidade',
  arma: 'Arma'
}

export interface AssistantPlanStep {
  kind: CreationKind
  name: string
  /** Uma linha explicando o que será criado. */
  summary: string
  /** Especificação já normalizada pelo gerador correspondente. */
  payload: unknown
  /** Preenchido quando a especificação não passou na validação. */
  problem: string | null
}

export interface AssistantPlan {
  id: string
  request: string
  summary: string
  steps: AssistantPlanStep[]
  provider: AiProviderId
  model: string
  createdAt: string
}

export interface AssistantCreated {
  kind: CreationKind
  name: string
  path: string
}

export interface AssistantApplyResult {
  created: AssistantCreated[]
  skipped: Array<{ name: string; reason: string }>
}

export interface AssistantPlanRequest {
  projectId: string
  request: string
  provider?: AiProviderId
}
