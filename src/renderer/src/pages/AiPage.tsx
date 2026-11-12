import {
  Bot,
  Braces,
  CheckCircle2,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Mic,
  Play,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  Wand2
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  AI_CAPABILITY_LABELS,
  AI_IMAGE_SIZES,
  AI_VOICES,
  CREATION_KIND_LABELS,
  type AiCodeResult,
  type AiFileEntry,
  type AiImageResult,
  type AiImageSize,
  type AiProviderId,
  type AiProvidersView,
  type AssistantApplyResult,
  type AssistantPlan
} from '@shared/ai'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Note,
  PageHeader
} from '../components/ui'
import { formatBytes, formatDateTime } from '../lib/format'
import { useApp } from '../state/store'

function messageOf(error: unknown): string | undefined {
  return error instanceof Error && error.message ? error.message : undefined
}

interface ProviderDraft {
  key: string
  model: string
  imageModel: string
  audioModel: string
  voice: string
}

export function AiPage(): React.JSX.Element {
  const { activeProject, navigate, notify } = useApp()
  const projectId = activeProject?.id ?? null

  const [providers, setProviders] = useState<AiProvidersView | null>(null)
  const [drafts, setDrafts] = useState<Record<string, ProviderDraft>>({})
  const [savingId, setSavingId] = useState<AiProviderId | null>(null)
  const [testingId, setTestingId] = useState<AiProviderId | null>(null)

  const [request, setRequest] = useState('')
  const [plan, setPlan] = useState<AssistantPlan | null>(null)
  const [planning, setPlanning] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState<AssistantApplyResult | null>(null)

  const [codePrompt, setCodePrompt] = useState('')
  const [codeResult, setCodeResult] = useState<AiCodeResult | null>(null)
  const [codeLoading, setCodeLoading] = useState(false)

  const [imagePrompt, setImagePrompt] = useState('')
  const [imageSize, setImageSize] = useState<AiImageSize>('1024x1024')
  const [imageResult, setImageResult] = useState<AiImageResult | null>(null)
  const [imageLoading, setImageLoading] = useState(false)

  const [audioText, setAudioText] = useState('')
  const [audioPath, setAudioPath] = useState<string | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)

  const [files, setFiles] = useState<AiFileEntry[]>([])

  const loadFiles = useCallback(async () => {
    if (!projectId) {
      setFiles([])
      return
    }
    try {
      setFiles(await window.studio.ai.files(projectId))
    } catch {
      setFiles([])
    }
  }, [projectId])

  const loadProviders = useCallback(async () => {
    try {
      const view = await window.studio.ai.providers()
      setProviders(view)
      setDrafts((current) => {
        const next: Record<string, ProviderDraft> = {}
        for (const provider of view.providers) {
          next[provider.id] = current[provider.id] ?? {
            key: '',
            model: provider.model,
            imageModel: provider.imageModel,
            audioModel: provider.audioModel,
            voice: provider.voice
          }
        }
        return next
      })
    } catch (error) {
      notify('erro', 'Não foi possível ler a central de IA', messageOf(error))
    }
  }, [notify])

  useEffect(() => {
    void loadProviders()
    void loadFiles()
  }, [loadProviders, loadFiles])

  function patchDraft(id: AiProviderId, changes: Partial<ProviderDraft>): void {
    setDrafts((current) => {
      const existing = current[id] ?? {
        key: '',
        model: '',
        imageModel: '',
        audioModel: '',
        voice: ''
      }
      return { ...current, [id]: { ...existing, ...changes } }
    })
  }

  async function saveProvider(id: AiProviderId): Promise<void> {
    const draft = drafts[id]
    if (!draft) return
    setSavingId(id)
    try {
      const view = await window.studio.ai.saveProvider({
        provider: id,
        key: draft.key.trim() ? draft.key : null,
        model: draft.model,
        imageModel: draft.imageModel,
        audioModel: draft.audioModel,
        voice: draft.voice
      })
      setProviders(view)
      patchDraft(id, { key: '' })
      notify('sucesso', 'Provedor atualizado', draft.key.trim() ? 'A chave foi cifrada e guardada pelo sistema.' : 'As preferências foram salvas.')
    } catch (error) {
      notify('erro', 'Não foi possível salvar o provedor', messageOf(error))
    } finally {
      setSavingId(null)
    }
  }

  async function testProvider(id: AiProviderId): Promise<void> {
    setTestingId(id)
    try {
      const result = await window.studio.ai.test(id)
      notify('sucesso', 'Chave funcionando', result.message)
    } catch (error) {
      notify('erro', 'O teste falhou', messageOf(error))
    } finally {
      setTestingId(null)
    }
  }

  async function removeKey(id: AiProviderId): Promise<void> {
    try {
      setProviders(await window.studio.ai.removeKey(id))
      notify('sucesso', 'Chave removida', 'A chave salva foi apagada do banco de dados.')
    } catch (error) {
      notify('erro', 'Não foi possível remover a chave', messageOf(error))
    }
  }

  async function prepare(): Promise<void> {
    if (!projectId) return
    setPlanning(true)
    setApplied(null)
    try {
      const result = await window.studio.assistant.plan(projectId, request)
      setPlan(result)
      notify('info', 'Plano preparado', 'Confira abaixo o que será criado antes de confirmar.')
    } catch (error) {
      setPlan(null)
      notify('erro', 'Não foi possível preparar o plano', messageOf(error))
    } finally {
      setPlanning(false)
    }
  }

  async function confirmPlan(): Promise<void> {
    if (!projectId || !plan) return
    setApplying(true)
    try {
      const result = await window.studio.assistant.apply(projectId, plan)
      setApplied(result)
      setPlan(null)
      notify(
        'sucesso',
        `${result.created.length} criação(ões) salva(s)`,
        result.skipped.length > 0
          ? `${result.skipped.length} item(ns) não passaram na validação e foram ignorados.`
          : 'Tudo foi gravado nas pastas do projeto.'
      )
      await loadFiles()
    } catch (error) {
      notify('erro', 'Não foi possível criar', messageOf(error))
    } finally {
      setApplying(false)
    }
  }

  async function runCode(): Promise<void> {
    if (!projectId) return
    setCodeLoading(true)
    try {
      const result = await window.studio.ai.code(projectId, codePrompt)
      setCodeResult(result)
      await loadFiles()
      notify('sucesso', 'Script gerado', result.relativePath ? `Salvo em ${result.relativePath}.` : 'Confira o código abaixo.')
    } catch (error) {
      notify('erro', 'A geração de código falhou', messageOf(error))
    } finally {
      setCodeLoading(false)
    }
  }

  async function runImage(): Promise<void> {
    if (!projectId) return
    setImageLoading(true)
    try {
      const result = await window.studio.ai.image(projectId, imagePrompt, imageSize)
      setImageResult(result)
      await loadFiles()
      notify('sucesso', 'Imagem gerada', `Salva em ${result.relativePath}.`)
    } catch (error) {
      notify('erro', 'A geração de imagem falhou', messageOf(error))
    } finally {
      setImageLoading(false)
    }
  }

  async function runAudio(): Promise<void> {
    if (!projectId) return
    setAudioLoading(true)
    try {
      const result = await window.studio.ai.audio(projectId, audioText)
      setAudioPath(result.relativePath)
      await loadFiles()
      notify('sucesso', 'Áudio gerado', `Salvo em ${result.relativePath} (${formatBytes(result.bytes)}).`)
    } catch (error) {
      notify('erro', 'A geração de áudio falhou', messageOf(error))
    } finally {
      setAudioLoading(false)
    }
  }

  if (!activeProject) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Etapa 9"
          title="Assistente de IA"
          description="Provedores com chave própria, plano de criações com prévia e geração de código, imagem e voz."
        />
        <EmptyState
          icon={Bot}
          title="Nenhum projeto ativo"
          description="Abra ou crie um projeto para usar o assistente. As chaves ficam guardadas no Studio, cifradas pelo sistema."
          action={
            <Button icon={Bot} onClick={() => navigate({ name: 'projetos' })}>
              Ir para meus projetos
            </Button>
          }
        />
      </div>
    )
  }

  const configured = providers?.providers.filter((provider) => provider.configured) ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Etapa 9"
        title="Assistente de IA"
        description="Você usa a sua própria chave. Ela é cifrada pelo armazenamento seguro do sistema, nunca volta para a tela e nunca é mostrada nos logs."
        actions={
          <Badge tone={configured.length > 0 ? 'success' : 'warning'}>
            {configured.length > 0
              ? `${configured.length} provedor(es) pronto(s)`
              : 'Nenhum provedor configurado'}
          </Badge>
        }
      />

      {providers && !providers.secureStorage ? (
        <Note tone="warning">
          <span className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            O armazenamento seguro do sistema não está disponível nesta máquina. O Studio
            <strong> não salva</strong> chaves sem criptografia — nada será gravado em texto puro.
          </span>
        </Note>
      ) : null}

      <Card
        title="Provedores"
        description="Cada provedor tem a sua chave e o seu modelo. Salve, teste e remova quando quiser."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {providers?.providers.map((provider) => {
            const draft = drafts[provider.id]
            const busy = savingId === provider.id
            const testing = testingId === provider.id
            return (
              <div
                key={provider.id}
                className="space-y-3 rounded-xl border border-base-800 bg-base-950/40 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink-100">{provider.label}</p>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      {provider.capabilities.map((capability) => AI_CAPABILITY_LABELS[capability]).join(' · ')}
                    </p>
                  </div>
                  <Badge tone={provider.configured ? 'success' : 'neutral'}>
                    {provider.configured ? 'Configurado' : 'Sem chave'}
                  </Badge>
                </div>

                <Field label="Chave da API" hint={provider.configured ? 'Salva com criptografia. Cole outra para substituir.' : 'Cole a chave gerada no site do provedor.'}>
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder="••••••••"
                    value={draft?.key ?? ''}
                    onChange={(event) => patchDraft(provider.id, { key: event.target.value })}
                  />
                </Field>

                <Field label="Modelo de texto/código">
                  <Input
                    value={draft?.model ?? ''}
                    onChange={(event) => patchDraft(provider.id, { model: event.target.value })}
                  />
                </Field>

                {provider.capabilities.includes('imagem') ? (
                  <Field label="Modelo de imagem">
                    <Input
                      value={draft?.imageModel ?? ''}
                      onChange={(event) => patchDraft(provider.id, { imageModel: event.target.value })}
                    />
                  </Field>
                ) : null}

                {provider.capabilities.includes('audio') ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Modelo de voz">
                      <Input
                        value={draft?.audioModel ?? ''}
                        onChange={(event) => patchDraft(provider.id, { audioModel: event.target.value })}
                      />
                    </Field>
                    <Field label="Voz">
                      <select
                        value={draft?.voice ?? ''}
                        onChange={(event) => patchDraft(provider.id, { voice: event.target.value })}
                        className="w-full rounded-xl border border-base-700 bg-base-950/70 px-2.5 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
                      >
                        {AI_VOICES.map((voice) => (
                          <option key={voice} value={voice}>
                            {voice}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" icon={KeyRound} loading={busy} onClick={() => void saveProvider(provider.id)}>
                    Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={ShieldCheck}
                    loading={testing}
                    disabled={!provider.configured}
                    onClick={() => void testProvider(provider.id)}
                  >
                    Testar
                  </Button>
                  {provider.configured ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      onClick={() => void removeKey(provider.id)}
                    >
                      Remover chave
                    </Button>
                  ) : null}
                </div>

                {provider.keySavedAt ? (
                  <p className="text-[11px] text-ink-500">Chave salva em {formatDateTime(provider.keySavedAt)}</p>
                ) : null}
              </div>
            )
          })}
        </div>
      </Card>

      <Card
        title="Assistente de criações"
        description="Descreva o que quer criar. A IA devolve um plano; nada é gravado antes de você confirmar."
        actions={
          <Button
            icon={Wand2}
            loading={planning}
            disabled={!request.trim() || configured.length === 0}
            onClick={() => void prepare()}
          >
            Preparar plano
          </Button>
        }
      >
        <div className="space-y-3">
          <Field
            label="Pedido"
            hint="Exemplo: “crie um colete tático raro com 70% de armadura e uma tabela de drops para inimigo comum”."
          >
            <textarea
              value={request}
              maxLength={2000}
              rows={3}
              onChange={(event) => setRequest(event.target.value)}
              className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
            />
          </Field>

          {configured.length === 0 ? (
            <Note tone="info">
              Salve a chave de pelo menos um provedor acima para usar o assistente.
            </Note>
          ) : null}

          {plan ? (
            <div className="space-y-3 rounded-xl border border-accent-500/30 bg-accent-500/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink-100">{plan.summary}</p>
                <Badge tone="neutral">
                  {plan.provider} · {plan.model}
                </Badge>
              </div>

              <ul className="space-y-2">
                {plan.steps.map((step, index) => (
                  <li
                    key={`${step.kind}-${index}`}
                    className="rounded-lg border border-base-800 bg-base-950/50 p-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{CREATION_KIND_LABELS[step.kind]}</Badge>
                      <span className="text-sm text-ink-100">{step.name}</span>
                      {step.problem ? (
                        <Badge tone="danger">não será criado</Badge>
                      ) : (
                        <CheckCircle2 className="size-3.5 text-emerald-400" aria-hidden />
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-ink-400">{step.summary}</p>
                    {step.problem ? (
                      <p className="mt-1 text-[11px] text-amber-300">{step.problem}</p>
                    ) : null}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-2">
                <Button
                  icon={Sparkles}
                  loading={applying}
                  disabled={plan.steps.every((step) => step.problem !== null)}
                  onClick={() => void confirmPlan()}
                >
                  Criar no projeto
                </Button>
                <Button variant="ghost" onClick={() => setPlan(null)}>
                  Descartar plano
                </Button>
              </div>
            </div>
          ) : null}

          {applied ? (
            <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="text-sm font-medium text-ink-100">Criado agora</p>
              <ul className="space-y-1 text-[11px] text-ink-300">
                {applied.created.map((item) => (
                  <li key={item.path}>
                    {CREATION_KIND_LABELS[item.kind]} · {item.name} · <code>{item.path}</code>
                  </li>
                ))}
                {applied.skipped.map((item) => (
                  <li key={item.name} className="text-amber-300">
                    Ignorado: {item.name} — {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Código GDScript" description="Gera um script e salva em ia/codigo/.">
          <div className="space-y-3">
            <textarea
              value={codePrompt}
              maxLength={2000}
              rows={3}
              placeholder="Ex.: script de porta que só abre com a chave dourada"
              onChange={(event) => setCodePrompt(event.target.value)}
              className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
            />
            <Button
              size="sm"
              icon={Braces}
              loading={codeLoading}
              disabled={!codePrompt.trim() || configured.length === 0 || !projectId}
              onClick={() => void runCode()}
            >
              Gerar script
            </Button>
            {codeResult ? (
              <div className="space-y-2">
                <p className="text-[11px] text-ink-400">{codeResult.explanation}</p>
                <pre className="max-h-52 overflow-auto rounded-lg border border-base-800 bg-base-950 p-2 text-[11px] leading-relaxed text-ink-200">
                  {codeResult.code}
                </pre>
                {codeResult.relativePath ? (
                  <p className="text-[11px] text-ink-500">Salvo em {codeResult.relativePath}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>

        <Card title="Imagem" description="Gera uma imagem e salva em ia/imagens/.">
          <div className="space-y-3">
            <textarea
              value={imagePrompt}
              maxLength={2000}
              rows={3}
              placeholder="Ex.: soldado em pixel art, fundo transparente"
              onChange={(event) => setImagePrompt(event.target.value)}
              className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
            />
            <select
              value={imageSize}
              onChange={(event) => setImageSize(event.target.value as AiImageSize)}
              className="w-full rounded-xl border border-base-700 bg-base-950/70 px-2.5 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
              aria-label="Tamanho da imagem"
            >
              {AI_IMAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              icon={ImageIcon}
              loading={imageLoading}
              disabled={!imagePrompt.trim() || configured.length === 0 || !projectId}
              onClick={() => void runImage()}
            >
              Gerar imagem
            </Button>
            {imageResult ? (
              <div className="space-y-2">
                <img
                  src={imageResult.dataUrl}
                  alt="Imagem gerada"
                  className="w-full rounded-lg border border-base-800"
                />
                <p className="text-[11px] text-ink-500">Salva em {imageResult.relativePath}</p>
              </div>
            ) : null}
          </div>
        </Card>

        <Card title="Áudio (voz)" description="Gera uma narração MP3 em ia/audio/ (OpenAI).">
          <div className="space-y-3">
            <textarea
              value={audioText}
              maxLength={2000}
              rows={3}
              placeholder="Ex.: bem-vindo ao Pixel Strike"
              onChange={(event) => setAudioText(event.target.value)}
              className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
            />
            <Button
              size="sm"
              icon={Mic}
              loading={audioLoading}
              disabled={!audioText.trim() || configured.length === 0 || !projectId}
              onClick={() => void runAudio()}
            >
              Gerar voz
            </Button>
            {audioPath ? (
              <p className="text-[11px] text-ink-400">
                <Play className="mr-1 inline size-3" aria-hidden />
                {audioPath}
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      <Card
        title="Arquivos gerados pela IA"
        description="Tudo fica dentro do projeto, na pasta ia/, e entra na exportação para a Godot."
        actions={<Badge tone="neutral">{files.length}</Badge>}
      >
        {files.length === 0 ? (
          <p className="text-xs text-ink-500">
            Nada gerado ainda. Códigos, imagens e áudios aparecem aqui depois de criados.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {files.map((file) => (
              <li
                key={file.relativePath}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-base-800 bg-base-950/40 px-2.5 py-1.5 text-[11px] text-ink-300"
              >
                <Badge tone="neutral">{file.kind}</Badge>
                <code className="flex-1 truncate">{file.relativePath}</code>
                <span className="text-ink-500">{formatBytes(file.bytes)}</span>
                <span className="text-ink-600">{formatDateTime(file.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {configured.length > 0 ? (
        <p className="flex items-center gap-1.5 text-[11px] text-ink-500">
          <Loader2 className="hidden" aria-hidden />
          Cada geração usa créditos da sua conta no provedor escolhido.
        </p>
      ) : null}
    </div>
  )
}
