import {
  Code2,
  Image as ImageIcon,
  Loader2,
  Pause,
  Play,
  Save,
  Sparkles,
  Trash2,
  Wand2
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { EFFECT_KINDS, EFFECT_LABELS, type EffectPreview } from '@shared/effects'
import {
  DEFAULT_SKILL_EFFECT,
  DEFAULT_SKILL_PARAMS,
  SKILL_KINDS,
  SKILL_KIND_HINTS,
  SKILL_KIND_LABELS,
  SKILL_PARAM_LABELS,
  SKILL_PARAM_RANGES,
  describeSkillParams,
  type SkillAsset,
  type SkillKind,
  type SkillParamKey,
  type SkillParams,
  type SkillSpec
} from '@shared/skills'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Note,
  PageHeader,
  Textarea
} from '../components/ui'
import { formatDateTime } from '../lib/format'
import { useApp } from '../state/store'

function messageOf(error: unknown): string | undefined {
  return error instanceof Error && error.message ? error.message : undefined
}

function SkillThumb({ relativePath }: { relativePath: string }): React.JSX.Element {
  const { activeProject } = useApp()
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!activeProject) return undefined
    void window.studio.files
      .preview(activeProject.id, relativePath)
      .then((preview) => {
        if (!cancelled) setSrc(preview.dataUrl)
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })
    return () => {
      cancelled = true
    }
  }, [activeProject, relativePath])

  return (
    <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-lg border border-base-700 bg-base-950">
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      ) : (
        <ImageIcon className="size-4 text-ink-600" aria-hidden />
      )}
    </div>
  )
}

export function SkillsPage(): React.JSX.Element {
  const { activeProject, navigate, notify } = useApp()
  const projectId = activeProject?.id ?? null

  const [kind, setKind] = useState<SkillKind>('area')
  const [effectKind, setEffectKind] = useState<SkillSpec['effectKind']>('explosao')
  const [params, setParams] = useState<SkillParams>({ ...DEFAULT_SKILL_PARAMS.area })
  const [name, setName] = useState('Habilidade Área de efeito')
  const [nameTouched, setNameTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [seed, setSeed] = useState(4321)
  const [colors, setColors] = useState({ primaria: '#fbbf24', secundaria: '#b91c1c' })
  const [interpreting, setInterpreting] = useState(false)

  const [icon, setIcon] = useState<string | null>(null)
  const [effect, setEffect] = useState<EffectPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(true)
  const [current, setCurrent] = useState(0)

  const [saving, setSaving] = useState(false)
  const [skills, setSkills] = useState<SkillAsset[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<SkillAsset | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (nameTouched) return
    setName(`Habilidade ${SKILL_KIND_LABELS[kind]}`)
  }, [nameTouched, kind])

  const spec: SkillSpec = useMemo(
    () => ({
      name: name.trim() || 'Habilidade sem nome',
      description,
      kind,
      effectKind,
      params,
      colors,
      seed
    }),
    [name, description, kind, effectKind, params, colors, seed]
  )

  const specKey = JSON.stringify(spec)

  useEffect(() => {
    let cancelled = false
    setPreviewLoading(true)
    const timer = window.setTimeout(() => {
      void window.studio.skills
        .preview(JSON.parse(specKey) as SkillSpec)
        .then((result) => {
          if (cancelled) return
          setIcon(result.icon)
          setEffect(result.effect)
          setPreviewError(null)
          setCurrent(0)
        })
        .catch((error: unknown) => {
          if (cancelled) return
          setIcon(null)
          setEffect(null)
          setPreviewError(messageOf(error) ?? 'Não foi possível desenhar a habilidade.')
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false)
        })
    }, 320)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [specKey])

  useEffect(() => {
    if (!playing || !effect || effect.frames.length === 0) return undefined
    const interval = window.setInterval(() => {
      setCurrent((value) => (value + 1) % effect.frames.length)
    }, Math.max(40, Math.round(1000 / Math.max(1, Math.round((effect.durationMs || 1000) / effect.frames.length)))))
    return () => window.clearInterval(interval)
  }, [playing, effect])

  const loadSkills = useCallback(async () => {
    if (!projectId) {
      setSkills([])
      return
    }
    setListLoading(true)
    try {
      setSkills(await window.studio.skills.list(projectId))
    } catch (error) {
      notify('erro', 'Não foi possível listar as habilidades', messageOf(error))
    } finally {
      setListLoading(false)
    }
  }, [projectId, notify])

  useEffect(() => {
    void loadSkills()
  }, [loadSkills])

  function chooseKind(next: SkillKind): void {
    setKind(next)
    setEffectKind(DEFAULT_SKILL_EFFECT[next])
    setParams({ ...DEFAULT_SKILL_PARAMS[next] })
    setNameTouched(false)
  }

  async function interpret(): Promise<void> {
    if (!description.trim()) {
      notify('info', 'Escreva uma descrição', 'Exemplo: “granada de fumaça que dura 8 segundos”.')
      return
    }
    setInterpreting(true)
    try {
      const suggestion = await window.studio.skills.interpret(description)
      if (suggestion.kind) {
        setKind(suggestion.kind)
        setEffectKind(suggestion.effectKind ?? DEFAULT_SKILL_EFFECT[suggestion.kind])
        setParams({
          ...DEFAULT_SKILL_PARAMS[suggestion.kind],
          ...(suggestion.params ?? {})
        })
        setNameTouched(false)
      }
      if (suggestion.matches.length === 0) {
        notify(
          'info',
          'Nenhuma palavra conhecida',
          'Tente citar o efeito: explosão, fumaça, fogo, cura, escudo, dash, tiro...'
        )
      } else {
        notify(
          'sucesso',
          'Sugestão aplicada',
          `Palavras reconhecidas: ${suggestion.matches.join(', ')}. Ajuste os valores como quiser.`
        )
      }
    } catch (error) {
      notify('erro', 'Não foi possível interpretar', messageOf(error))
    } finally {
      setInterpreting(false)
    }
  }

  async function save(): Promise<void> {
    if (!projectId) return
    setSaving(true)
    try {
      const asset = await window.studio.skills.save(projectId, spec)
      notify('sucesso', 'Habilidade salva', `${asset.scriptPath} foi gravado no projeto.`)
      await loadSkills()
    } catch (error) {
      notify('erro', 'Não foi possível salvar a habilidade', messageOf(error))
    } finally {
      setSaving(false)
    }
  }

  function editSaved(asset: SkillAsset): void {
    const saved = asset.spec
    setKind(saved.kind)
    setEffectKind(saved.effectKind)
    setParams({ ...saved.params })
    setColors({ ...saved.colors })
    setSeed(saved.seed)
    setName(saved.name)
    setDescription(saved.description)
    setNameTouched(true)
    notify('sucesso', 'Habilidade carregada', `Editando "${asset.name}". Salvar cria uma nova pasta.`)
  }

  async function confirmRemove(): Promise<void> {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await window.studio.skills.remove(removeTarget.id)
      notify('sucesso', 'Habilidade removida', 'A pasta foi para a lixeira interna do Studio.')
      setRemoveTarget(null)
      await loadSkills()
    } catch (error) {
      notify('erro', 'Não foi possível remover a habilidade', messageOf(error))
    } finally {
      setRemoving(false)
    }
  }

  if (!activeProject) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Etapa 7"
          title="Skills e habilidades"
          description="Parâmetros de jogo, efeito visual e script pronto para a Godot 4."
        />
        <EmptyState
          icon={Sparkles}
          title="Nenhum projeto ativo"
          description="Abra ou crie um projeto para criar habilidades. Cada uma grava ícone, quadros do efeito, spritesheet, ficha e script."
          action={
            <Button icon={Sparkles} onClick={() => navigate({ name: 'projetos' })}>
              Ir para meus projetos
            </Button>
          }
        />
      </div>
    )
  }

  const currentFrame = effect?.frames[current] ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Etapa 7"
        title="Skills e habilidades"
        description="Cada habilidade combina dano, alcance, raio, duração, recarga, custo e velocidade com um efeito visual. O Studio também gera o script da Godot."
        actions={
          <Button icon={Save} loading={saving} onClick={() => void save()}>
            Salvar no projeto
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card title="Habilidade" description="Nome, tipo e descrição.">
            <div className="space-y-3">
              <Field label="Nome">
                <Input
                  value={name}
                  maxLength={60}
                  onChange={(event) => {
                    setName(event.target.value)
                    setNameTouched(true)
                  }}
                />
              </Field>

              <div className="grid grid-cols-3 gap-1.5">
                {SKILL_KINDS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    title={SKILL_KIND_HINTS[item]}
                    onClick={() => chooseKind(item)}
                    className={`rounded-lg border px-1.5 py-2 text-[11px] leading-tight transition-colors ${
                      kind === item
                        ? 'border-accent-500/60 bg-accent-500/15 text-accent-100'
                        : 'border-base-700 bg-base-950/40 text-ink-300 hover:border-base-600'
                    }`}
                  >
                    {SKILL_KIND_LABELS[item]}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-ink-500">{SKILL_KIND_HINTS[kind]}</p>

              <Field label="Descrição" hint="Palavras-chave sugerem tipo e parâmetros — não é IA nesta etapa.">
                <Textarea
                  rows={2}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="granada de fumaça que dura 8 segundos"
                />
              </Field>
              <Button
                variant="secondary"
                size="sm"
                icon={Wand2}
                loading={interpreting}
                onClick={() => void interpret()}
              >
                Aplicar descrição
              </Button>
            </div>
          </Card>

          <Card title="Parâmetros" description="Valores usados no script da Godot.">
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(SKILL_PARAM_LABELS) as SkillParamKey[]).map((key) => {
                const range = SKILL_PARAM_RANGES[key]
                return (
                  <Field key={key} label={SKILL_PARAM_LABELS[key]}>
                    <Input
                      type="number"
                      min={range.min}
                      max={range.max}
                      step={range.step}
                      value={params[key]}
                      onChange={(event) =>
                        setParams({
                          ...params,
                          [key]: Math.max(
                            range.min,
                            Math.min(range.max, Number(event.target.value) || range.min)
                          )
                        })
                      }
                    />
                  </Field>
                )
              })}
            </div>
          </Card>

          <Card title="Efeito e cores" description="O efeito visual da habilidade.">
            <div className="space-y-3">
              <Field label="Efeito">
                <select
                  value={effectKind}
                  onChange={(event) => setEffectKind(event.target.value as SkillSpec['effectKind'])}
                  className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
                >
                  {EFFECT_KINDS.map((item) => (
                    <option key={item} value={item}>
                      {EFFECT_LABELS[item]}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Cor principal">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colors.primaria}
                      onChange={(event) => setColors({ ...colors, primaria: event.target.value })}
                      className="h-9 w-10 cursor-pointer rounded-lg border border-base-700 bg-base-950"
                      aria-label="Cor principal"
                    />
                    <Input
                      value={colors.primaria}
                      onChange={(event) => setColors({ ...colors, primaria: event.target.value })}
                    />
                  </div>
                </Field>
                <Field label="Cor secundária">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colors.secundaria}
                      onChange={(event) => setColors({ ...colors, secundaria: event.target.value })}
                      className="h-9 w-10 cursor-pointer rounded-lg border border-base-700 bg-base-950"
                      aria-label="Cor secundária"
                    />
                    <Input
                      value={colors.secundaria}
                      onChange={(event) => setColors({ ...colors, secundaria: event.target.value })}
                    />
                  </div>
                </Field>
              </div>

              <Field label="Semente">
                <Input
                  type="number"
                  value={seed}
                  onChange={(event) => setSeed(Math.abs(Number(event.target.value) || 1))}
                />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card
            title="Prévia"
            description={describeSkillParams(spec)}
            actions={
              <div className="flex items-center gap-2">
                {previewLoading && (
                  <Loader2 className="size-3.5 animate-spin text-ink-400" aria-hidden />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  icon={playing ? Pause : Play}
                  onClick={() => setPlaying(!playing)}
                >
                  {playing ? 'Pausar' : 'Tocar'}
                </Button>
              </div>
            }
          >
            <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
              <div className="space-y-3">
                <div className="grid place-items-center rounded-xl border border-base-800 bg-base-950/70 p-3">
                  {icon ? (
                    <img
                      src={icon}
                      alt="Ícone da habilidade"
                      className="h-24 w-24 object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <div className="h-24" />
                  )}
                </div>
                <div className="grid h-32 place-items-center rounded-xl border border-base-800 bg-base-950/70 p-2">
                  {currentFrame ? (
                    <img
                      src={currentFrame}
                      alt="Efeito da habilidade"
                      className="h-28 w-28 object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <span className="text-[11px] text-ink-500">sem efeito</span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {(effect?.frames ?? []).map((frame, index) => (
                    <button
                      key={`${index}-${frame.slice(-12)}`}
                      type="button"
                      onClick={() => {
                        setPlaying(false)
                        setCurrent(index)
                      }}
                      className={`rounded-md border p-1 transition-colors ${
                        current === index
                          ? 'border-accent-400 bg-accent-500/10'
                          : 'border-base-800 hover:border-base-600'
                      }`}
                      aria-label={`Quadro ${index + 1}`}
                    >
                      <img
                        src={frame}
                        alt=""
                        className="size-8"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </button>
                  ))}
                </div>

                <dl className="grid grid-cols-2 gap-2 text-[11px]">
                  {[
                    ['Dano', params.dano],
                    ['Raio', `${params.raio} px`],
                    ['Alcance', `${params.alcance} px`],
                    ['Duração', `${params.duracao}s`],
                    ['Recarga', `${params.recarga}s`],
                    ['Custo', params.custo]
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-lg border border-base-800 bg-base-950/40 px-2.5 py-1.5"
                    >
                      <dt className="text-ink-500">{label}</dt>
                      <dd className="text-ink-100">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="flex items-start gap-2 rounded-xl border border-base-800 bg-base-950/40 px-3 py-2 text-[11px] leading-relaxed text-ink-400">
                  <Code2 className="mt-0.5 size-3.5 shrink-0 text-accent-300" aria-hidden />
                  <span>
                    Ao salvar, o Studio grava <code className="text-accent-200">.gd</code> com{' '}
                    <code className="text-accent-200">usar(origem, alvo)</code>, área de dano,
                    efeito animado e recarga.
                  </span>
                </div>

                {previewError && <Note tone="warning">{previewError}</Note>}
              </div>
            </div>
          </Card>

          <Card
            title="Habilidades salvas"
            description="Ícone, quadros do efeito, spritesheet, ficha JSON e script GDScript na pasta habilidades/."
            actions={
              listLoading ? (
                <Loader2 className="size-4 animate-spin text-ink-400" aria-hidden />
              ) : (
                <Badge tone="neutral">{skills.length}</Badge>
              )
            }
          >
            {skills.length === 0 ? (
              <p className="text-xs text-ink-500">
                Nenhuma habilidade salva ainda. Use “Salvar no projeto” para gravar a primeira.
              </p>
            ) : (
              <ul className="space-y-2">
                {skills.map((asset) => (
                  <li
                    key={asset.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-base-800 bg-base-950/40 p-2.5"
                  >
                    <SkillThumb relativePath={asset.iconPath} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-100">{asset.name}</p>
                      <p className="mt-0.5 text-[11px] text-ink-500">
                        {SKILL_KIND_LABELS[asset.kind]} · efeito {EFFECT_LABELS[asset.effectKind]} ·{' '}
                        {asset.params.dano} dano · recarga {asset.params.recarga}s ·{' '}
                        {formatDateTime(asset.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Wand2}
                        onClick={() => editSaved(asset)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={() => setRemoveTarget(asset)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={removeTarget !== null}
        title="Remover esta habilidade?"
        description="A pasta da habilidade vai para a lixeira interna do Studio."
        confirmLabel="Remover habilidade"
        tone="danger"
        loading={removing}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoveTarget(null)}
      >
        <p className="text-sm text-ink-200">{removeTarget?.name}</p>
      </ConfirmDialog>
    </div>
  )
}
