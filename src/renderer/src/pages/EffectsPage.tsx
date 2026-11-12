import { Image as ImageIcon, Loader2, Pause, Play, PlayCircle, Save, Trash2, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  EFFECT_KINDS,
  EFFECT_LABELS,
  EFFECT_PRESETS,
  EFFECT_SIZES,
  MAX_EFFECT_FPS,
  MAX_EFFECT_FRAMES,
  MIN_EFFECT_FPS,
  MIN_EFFECT_FRAMES,
  effectDurationMs,
  type EffectAsset,
  type EffectKind,
  type EffectSpec
} from '@shared/effects'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Note,
  PageHeader
} from '../components/ui'
import { formatDateTime } from '../lib/format'
import { useApp } from '../state/store'

function messageOf(error: unknown): string | undefined {
  return error instanceof Error && error.message ? error.message : undefined
}

function EffectThumb({ relativePath }: { relativePath: string }): React.JSX.Element {
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
    <div className="grid h-14 w-20 place-items-center overflow-hidden rounded-lg border border-base-700 bg-base-950">
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

export function EffectsPage(): React.JSX.Element {
  const { activeProject, navigate, notify } = useApp()
  const projectId = activeProject?.id ?? null

  const [kind, setKind] = useState<EffectKind>('explosao')
  const [name, setName] = useState('Explosão sem título')
  const [nameTouched, setNameTouched] = useState(false)
  const [size, setSize] = useState<32 | 64 | 96>(64)
  const [frames, setFrames] = useState(EFFECT_PRESETS.explosao.frames)
  const [fps, setFps] = useState(EFFECT_PRESETS.explosao.fps)
  const [seed, setSeed] = useState(1234)
  const [colors, setColors] = useState({ ...EFFECT_PRESETS.explosao.colors })

  const [previewFrames, setPreviewFrames] = useState<string[]>([])
  const [sheet, setSheet] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(true)
  const [current, setCurrent] = useState(0)

  const [saving, setSaving] = useState(false)
  const [effects, setEffects] = useState<EffectAsset[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<EffectAsset | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (nameTouched) return
    setName(`${EFFECT_LABELS[kind]} sem título`)
  }, [nameTouched, kind])

  const spec: EffectSpec = useMemo(
    () => ({
      kind,
      name: name.trim() || 'Efeito sem título',
      colors,
      size,
      frames,
      fps,
      seed
    }),
    [kind, name, colors, size, frames, fps, seed]
  )

  const specKey = JSON.stringify(spec)

  useEffect(() => {
    let cancelled = false
    setPreviewLoading(true)
    const timer = window.setTimeout(() => {
      void window.studio.effects
        .preview(JSON.parse(specKey) as EffectSpec)
        .then((result) => {
          if (cancelled) return
          setPreviewFrames(result.frames)
          setSheet(result.sheet)
          setPreviewError(null)
          setCurrent(0)
        })
        .catch((error: unknown) => {
          if (cancelled) return
          setPreviewFrames([])
          setSheet(null)
          setPreviewError(messageOf(error) ?? 'Não foi possível desenhar o efeito.')
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

  // Reprodução automática dos quadros na velocidade do FPS.
  useEffect(() => {
    if (!playing || previewFrames.length === 0) return undefined
    const interval = window.setInterval(() => {
      setCurrent((value) => (value + 1) % previewFrames.length)
    }, Math.max(40, Math.round(1000 / Math.max(1, fps))))
    return () => window.clearInterval(interval)
  }, [playing, previewFrames.length, fps])

  const loadEffects = useCallback(async () => {
    if (!projectId) {
      setEffects([])
      return
    }
    setListLoading(true)
    try {
      setEffects(await window.studio.effects.list(projectId))
    } catch (error) {
      notify('erro', 'Não foi possível listar os efeitos', messageOf(error))
    } finally {
      setListLoading(false)
    }
  }, [projectId, notify])

  useEffect(() => {
    void loadEffects()
  }, [loadEffects])

  function chooseKind(next: EffectKind): void {
    const preset = EFFECT_PRESETS[next]
    setKind(next)
    setColors({ ...preset.colors })
    setFrames(preset.frames)
    setFps(preset.fps)
    setNameTouched(false)
  }

  async function save(): Promise<void> {
    if (!projectId) return
    setSaving(true)
    try {
      const asset = await window.studio.effects.save(projectId, spec)
      notify('sucesso', 'Efeito salvo', `${asset.sheetPath} foi gravado no projeto.`)
      await loadEffects()
    } catch (error) {
      notify('erro', 'Não foi possível salvar o efeito', messageOf(error))
    } finally {
      setSaving(false)
    }
  }

  async function confirmRemove(): Promise<void> {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await window.studio.effects.remove(removeTarget.id)
      notify('sucesso', 'Efeito removido', 'A pasta foi para a lixeira interna do Studio.')
      setRemoveTarget(null)
      await loadEffects()
    } catch (error) {
      notify('erro', 'Não foi possível remover o efeito', messageOf(error))
    } finally {
      setRemoving(false)
    }
  }

  if (!activeProject) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Etapa 7"
          title="Efeitos visuais"
          description="Explosões, fumaça, fogo, impactos, cura e faíscas desenhados quadro a quadro."
        />
        <EmptyState
          icon={Zap}
          title="Nenhum projeto ativo"
          description="Abra ou crie um projeto para gerar efeitos. Cada efeito grava quadros PNG, spritesheet e ficha JSON na pasta efeitos/."
          action={
            <Button icon={Zap} onClick={() => navigate({ name: 'projetos' })}>
              Ir para meus projetos
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Etapa 7"
        title="Efeitos visuais"
        description="Cada efeito é uma animação procedural determinística: os mesmos valores geram sempre os mesmos quadros."
        actions={
          <Button icon={Save} loading={saving} onClick={() => void save()}>
            Salvar no projeto
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card title="Tipo de efeito" description="Sete efeitos prontos para o seu jogo.">
            <div className="grid grid-cols-2 gap-1.5">
              {EFFECT_KINDS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => chooseKind(item)}
                  className={`rounded-xl border px-2.5 py-2 text-left text-[11px] transition-colors ${
                    kind === item
                      ? 'border-accent-500/60 bg-accent-500/15 text-accent-100'
                      : 'border-base-700 bg-base-950/40 text-ink-300 hover:border-base-600'
                  }`}
                >
                  {EFFECT_LABELS[item]}
                </button>
              ))}
            </div>
          </Card>

          <Card title="Animação" description="Quadros e velocidade.">
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

              <div className="grid grid-cols-2 gap-3">
                <Field label="Quadros" hint={`${MIN_EFFECT_FRAMES} a ${MAX_EFFECT_FRAMES}`}>
                  <Input
                    type="number"
                    min={MIN_EFFECT_FRAMES}
                    max={MAX_EFFECT_FRAMES}
                    value={frames}
                    onChange={(event) =>
                      setFrames(
                        Math.max(
                          MIN_EFFECT_FRAMES,
                          Math.min(MAX_EFFECT_FRAMES, Number(event.target.value) || MIN_EFFECT_FRAMES)
                        )
                      )
                    }
                  />
                </Field>
                <Field label="FPS" hint={`${MIN_EFFECT_FPS} a ${MAX_EFFECT_FPS}`}>
                  <Input
                    type="number"
                    min={MIN_EFFECT_FPS}
                    max={MAX_EFFECT_FPS}
                    value={fps}
                    onChange={(event) =>
                      setFps(
                        Math.max(
                          MIN_EFFECT_FPS,
                          Math.min(MAX_EFFECT_FPS, Number(event.target.value) || MIN_EFFECT_FPS)
                        )
                      )
                    }
                  />
                </Field>
                <Field label="Tamanho do quadro">
                  <select
                    value={size}
                    onChange={(event) =>
                      setSize(
                        Number(event.target.value) === 96
                          ? 96
                          : Number(event.target.value) === 32
                            ? 32
                            : 64
                      )
                    }
                    className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
                  >
                    {EFFECT_SIZES.map((value) => (
                      <option key={value} value={value}>
                        {value} px
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Semente">
                  <Input
                    type="number"
                    value={seed}
                    onChange={(event) => setSeed(Math.abs(Number(event.target.value) || 1))}
                  />
                </Field>
              </div>

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

              <p className="text-[11px] text-ink-500">
                Duração do ciclo: {(effectDurationMs(spec) / 1000).toFixed(2)}s
              </p>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card
            title="Prévia animada"
            description="Reprodução real dos quadros que serão gravados."
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
            <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="grid place-items-center rounded-xl border border-base-800 bg-base-950/70 p-3">
                {previewFrames[current] ? (
                  <img
                    src={previewFrames[current]}
                    alt="Quadro do efeito"
                    className="h-40 w-40 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <div className="flex h-40 items-center gap-2 text-xs text-ink-500">
                    <PlayCircle className="size-4" aria-hidden />
                    {previewError ? 'sem prévia' : 'preparando…'}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {previewFrames.map((frame, index) => (
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

                <p className="text-xs leading-relaxed text-ink-400">
                  Quadro {Math.min(current + 1, previewFrames.length)} de {previewFrames.length} ·{' '}
                  {fps} FPS · {size} px
                </p>

                {sheet && (
                  <div className="overflow-auto rounded-lg border border-base-800 bg-base-950/60 p-2">
                    <img
                      src={sheet}
                      alt="Spritesheet do efeito"
                      className="h-16 w-auto min-w-full"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                )}

                {previewError && <Note tone="warning">{previewError}</Note>}
              </div>
            </div>
          </Card>

          <Card
            title="Efeitos salvos"
            description="Cada efeito grava os quadros PNG, a spritesheet e a ficha JSON na pasta efeitos/."
            actions={
              listLoading ? (
                <Loader2 className="size-4 animate-spin text-ink-400" aria-hidden />
              ) : (
                <Badge tone="neutral">{effects.length}</Badge>
              )
            }
          >
            {effects.length === 0 ? (
              <p className="text-xs text-ink-500">
                Nenhum efeito salvo ainda. Use “Salvar no projeto” para gravar o primeiro.
              </p>
            ) : (
              <ul className="space-y-2">
                {effects.map((asset) => (
                  <li
                    key={asset.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-base-800 bg-base-950/40 p-2.5"
                  >
                    <EffectThumb relativePath={asset.sheetPath} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-100">{asset.name}</p>
                      <p className="mt-0.5 text-[11px] text-ink-500">
                        {EFFECT_LABELS[asset.kind]} · {asset.frameCount} quadros · {asset.fps} FPS ·{' '}
                        {asset.size} px · {formatDateTime(asset.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={() => setRemoveTarget(asset)}
                    >
                      Excluir
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={removeTarget !== null}
        title="Remover este efeito?"
        description="A pasta do efeito vai para a lixeira interna do Studio."
        confirmLabel="Remover efeito"
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
