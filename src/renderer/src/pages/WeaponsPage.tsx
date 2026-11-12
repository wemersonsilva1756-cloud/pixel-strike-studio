import {
  Crosshair,
  Image as ImageIcon,
  Layers,
  Loader2,
  Palette,
  Pencil,
  Save,
  Sparkles,
  Trash2
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  RARITIES,
  SKIN_PATTERNS,
  WEAPON_BASES,
  WEAPON_CLASS_LABELS,
  WEARS,
  defaultColors,
  defaultWeaponName,
  rarityById,
  weaponBaseById,
  wearById,
  wearForFloat,
  type Rarity,
  type SkinPattern,
  type Wear,
  type WeaponAsset,
  type WeaponSpec
} from '@shared/weapons'
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

function SkinThumb({ relativePath }: { relativePath: string }): React.JSX.Element {
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

export function WeaponsPage(): React.JSX.Element {
  const { activeProject, navigate, notify } = useApp()
  const projectId = activeProject?.id ?? null

  const [baseId, setBaseId] = useState('ak47')
  const [rarity, setRarity] = useState<Rarity>('azul')
  const [wear, setWear] = useState<Wear>('nova')
  const [float, setFloat] = useState(0.05)
  const [pattern, setPattern] = useState<SkinPattern>('solido')
  const [colors, setColors] = useState(() => defaultColors('solido'))
  const [size, setSize] = useState<32 | 64 | 96>(64)
  const [seed, setSeed] = useState(1234)

  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [interpreting, setInterpreting] = useState(false)

  const [icon, setIcon] = useState<string | null>(null)
  const [comparison, setComparison] = useState<{ image: string; labels: string[] } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [weapons, setWeapons] = useState<WeaponAsset[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<WeaponAsset | null>(null)
  const [removing, setRemoving] = useState(false)

  const base = weaponBaseById(baseId)

  useEffect(() => {
    if (nameTouched) return
    setName(defaultWeaponName(baseId, rarity, wear, pattern))
  }, [nameTouched, baseId, rarity, wear, pattern])

  const spec: WeaponSpec = useMemo(
    () => ({
      baseId,
      name: name.trim() || 'Skin sem nome',
      rarity,
      wear,
      float,
      pattern,
      colors,
      seed,
      size
    }),
    [baseId, name, rarity, wear, float, pattern, colors, seed, size]
  )

  const loadWeapons = useCallback(async () => {
    if (!projectId) {
      setWeapons([])
      return
    }
    setListLoading(true)
    try {
      setWeapons(await window.studio.weapons.list(projectId))
    } catch (error) {
      notify('erro', 'Não foi possível listar as skins', messageOf(error))
    } finally {
      setListLoading(false)
    }
  }, [projectId, notify])

  useEffect(() => {
    void loadWeapons()
  }, [loadWeapons])

  const specKey = JSON.stringify(spec)

  // Ícone e comparação de raridades são desenhados pelo núcleo, não pela tela.
  useEffect(() => {
    let cancelled = false
    setPreviewLoading(true)
    const timer = window.setTimeout(() => {
      const current = JSON.parse(specKey) as WeaponSpec
      void Promise.all([
        window.studio.weapons.preview(current),
        window.studio.weapons.compare(current)
      ])
        .then(([previewResult, comparisonResult]) => {
          if (cancelled) return
          setIcon(previewResult.icon)
          setComparison({
            image: comparisonResult.image,
            labels: comparisonResult.labels
          })
          setPreviewError(null)
        })
        .catch((error: unknown) => {
          if (cancelled) return
          setIcon(null)
          setComparison(null)
          setPreviewError(messageOf(error) ?? 'Não foi possível desenhar a skin.')
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false)
        })
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [specKey])

  async function interpret(): Promise<void> {
    if (!description.trim()) {
      notify('info', 'Escreva uma descrição', 'Exemplo: “AK-47 dourada com chamas”.')
      return
    }
    setInterpreting(true)
    try {
      const suggestion = await window.studio.weapons.interpret(description)
      if (suggestion.baseId) setBaseId(suggestion.baseId)
      if (suggestion.rarity) setRarity(suggestion.rarity)
      if (suggestion.pattern) {
        setPattern(suggestion.pattern)
        setColors(suggestion.colors ?? defaultColors(suggestion.pattern))
      }
      setNameTouched(false)
      if (suggestion.matches.length === 0) {
        notify(
          'info',
          'Nenhuma palavra conhecida',
          'Tente citar a arma, a cor/raridade ou o padrão (chamas, camuflado, digital...).'
        )
      } else {
        notify(
          'sucesso',
          'Sugestão aplicada',
          `Palavras reconhecidas: ${suggestion.matches.join(', ')}. Tudo continua editável.`
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
      const asset = await window.studio.weapons.save(projectId, spec)
      notify('sucesso', 'Skin salva', `${asset.iconPath} foi gravado no projeto.`)
      await loadWeapons()
    } catch (error) {
      notify('erro', 'Não foi possível salvar a skin', messageOf(error))
    } finally {
      setSaving(false)
    }
  }

  function editSaved(asset: WeaponAsset): void {
    const saved = asset.spec
    setBaseId(saved.baseId)
    setRarity(saved.rarity)
    setWear(saved.wear)
    setFloat(saved.float)
    setPattern(saved.pattern)
    setColors(saved.colors)
    setSize(saved.size === 96 ? 96 : saved.size === 32 ? 32 : 64)
    setSeed(saved.seed)
    setName(saved.name)
    setNameTouched(true)
    notify('sucesso', 'Skin carregada', `Editando "${asset.name}". Salvar cria uma nova pasta, sem sobrescrever.`)
  }

  async function confirmRemove(): Promise<void> {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await window.studio.weapons.remove(removeTarget.id)
      notify('sucesso', 'Skin removida', 'A pasta foi para a lixeira interna do Studio.')
      setRemoveTarget(null)
      await loadWeapons()
    } catch (error) {
      notify('erro', 'Não foi possível remover a skin', messageOf(error))
    } finally {
      setRemoving(false)
    }
  }

  if (!activeProject) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Etapa 6"
          title="Armas e skins"
          description="Crie skins em pixel art sobre 9 armas base, com raridade e condição de desgaste separadas."
        />
        <EmptyState
          icon={Crosshair}
          title="Nenhum projeto ativo"
          description="Abra ou crie um projeto para criar skins. Os ícones e as fichas ficam salvos na pasta armas/ do projeto."
          action={
            <Button icon={Crosshair} onClick={() => navigate({ name: 'projetos' })}>
              Ir para meus projetos
            </Button>
          }
        />
      </div>
    )
  }

  const rarityInfo = rarityById(rarity)
  const wearInfo = wearById(wear)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Etapa 6"
        title="Armas e skins"
        description="Escolha o modelo, a raridade, a condição de desgaste e o padrão. O ícone é desenhado em pixel art pelo próprio Studio, sem interpolação."
        actions={
          <Button icon={Save} loading={saving} onClick={() => void save()}>
            Salvar no projeto
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card title="Arma" description="Modelo base que recebe a skin.">
            <div className="space-y-3">
              <Field label="Modelo">
                <select
                  value={baseId}
                  onChange={(event) => setBaseId(event.target.value)}
                  className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
                >
                  {WEAPON_BASES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label} · {WEAPON_CLASS_LABELS[item.classId]}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-ink-400">
                <p>
                  Munição: <span className="text-ink-200">{base.ammo}</span>
                </p>
                <p>
                  Classe: <span className="text-ink-200">{WEAPON_CLASS_LABELS[base.classId]}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Tamanho">
                  <select
                    value={size}
                    onChange={(event) =>
                      setSize(Number(event.target.value) === 96 ? 96 : Number(event.target.value) === 32 ? 32 : 64)
                    }
                    className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
                  >
                    <option value={32}>32 px</option>
                    <option value={64}>64 px</option>
                    <option value={96}>96 px</option>
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

              <Field label="Nome da skin" hint="Vem preenchido com a combinação atual; edite à vontade.">
                <Input
                  value={name}
                  maxLength={60}
                  onChange={(event) => {
                    setName(event.target.value)
                    setNameTouched(true)
                  }}
                />
              </Field>

              <Field label="Descrição" hint="O Studio interpreta palavras-chave — não é IA nesta etapa.">
                <Textarea
                  rows={2}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="ak-47 dourada com chamas"
                />
              </Field>
              <Button
                variant="secondary"
                size="sm"
                icon={Sparkles}
                loading={interpreting}
                onClick={() => void interpret()}
              >
                Aplicar descrição
              </Button>
            </div>
          </Card>

          <Card title="Raridade" description="Independente da condição de desgaste.">
            <div className="grid grid-cols-2 gap-1.5">
              {RARITIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.hint}
                  onClick={() => setRarity(item.id)}
                  className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[11px] transition-colors ${
                    rarity === item.id
                      ? 'border-white/40 bg-white/5 text-white'
                      : 'border-base-700 bg-base-950/40 text-ink-300 hover:border-base-600'
                  }`}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{item.label}</span>
                    <span className="block truncate text-[10px] text-ink-500">{item.short}</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card title="Condição de desgaste" description="O float decide as marcas no ícone.">
            <div className="space-y-3">
              <Field label="Condição">
                <select
                  value={wear}
                  onChange={(event) => {
                    const next = event.target.value as Wear
                    const range = wearById(next)
                    setWear(next)
                    setFloat(Number(((range.min + range.max) / 2).toFixed(3)))
                  }}
                  className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
                >
                  {WEARS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-[11px] text-ink-300">
                  <span>Float</span>
                  <span className="font-mono text-ink-400">{float.toFixed(3)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.001}
                  value={float}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    setFloat(value)
                    setWear(wearForFloat(value).id)
                  }}
                  className="w-full accent-accent-500"
                />
                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">
                  {wearInfo.label}: {wearInfo.hint} Faixa {wearInfo.min.toFixed(2)}–{wearInfo.max.toFixed(2)}.
                </p>
              </div>
            </div>
          </Card>

          <Card title="Padrão e cores" description="Seis padrões e duas cores por skin.">
            <div className="space-y-3">
              <Field label="Padrão">
                <select
                  value={pattern}
                  onChange={(event) => {
                    const next = event.target.value as SkinPattern
                    setPattern(next)
                    setColors(defaultColors(next))
                  }}
                  className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
                >
                  {SKIN_PATTERNS.map((item) => (
                    <option key={item.id} value={item.id} title={item.hint}>
                      {item.label}
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
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card
            title="Ícone da skin"
            description={`${base.label} · ${rarityInfo.label} · ${wearInfo.label} · ${size} px`}
            actions={
              previewLoading ? (
                <span className="flex items-center gap-1.5 text-[11px] text-ink-400">
                  <Loader2 className="size-3 animate-spin" aria-hidden /> desenhando
                </span>
              ) : (
                <Badge tone="neutral">{pattern}</Badge>
              )
            }
          >
            <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
              <div
                className="grid place-items-center rounded-xl border border-base-800 p-3"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, #10161f 25%, transparent 25%), linear-gradient(-45deg, #10161f 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #10161f 75%), linear-gradient(-45deg, transparent 75%, #10161f 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                  backgroundColor: '#0b1120'
                }}
              >
                {icon ? (
                  <img
                    src={icon}
                    alt="Ícone da skin"
                    className="h-40 w-40 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <div className="flex h-40 items-center gap-2 text-xs text-ink-500">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    preparando…
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: rarityInfo.color }}
                  />
                  <p className="text-sm font-medium text-ink-100">
                    {rarityInfo.label} · {rarityInfo.short}
                  </p>
                </div>
                <p className="text-xs leading-relaxed text-ink-400">{rarityInfo.hint}</p>

                <dl className="grid grid-cols-2 gap-2 text-[11px]">
                  {[
                    ['Dano', base.stats.dano],
                    ['Cadência', `${base.stats.cadencia} tiros/min`],
                    ['Precisão', base.stats.precisao],
                    ['Alcance', `${base.stats.alcance} px`]
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

                <p className="text-[11px] leading-relaxed text-ink-500">
                  O desgaste ({float.toFixed(3)}) só muda as marcas na pintura. A raridade muda a
                  faixa colorida e a etiqueta — nunca a condição.
                </p>

                {previewError && <Note tone="warning">{previewError}</Note>}
              </div>
            </div>
          </Card>

          <Card
            title="Comparação de raridades"
            description="A mesma arma, padrão e condição nas seis raridades."
            actions={<Badge tone="neutral">6 variações</Badge>}
          >
            {comparison ? (
              <>
                <div className="overflow-auto rounded-xl border border-base-800 bg-base-950/60 p-2">
                  <img
                    src={comparison.image}
                    alt="Comparação de raridades"
                    className="w-full min-w-[420px]"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px] text-ink-400 sm:grid-cols-6">
                  {comparison.labels.map((label, index) => (
                    <span key={label} className="flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: RARITIES[index]?.color ?? '#64748b' }}
                      />
                      {label}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-ink-500">Desenhando a comparação…</p>
            )}
          </Card>

          <Card
            title="Skins salvas"
            description="Cada skin grava ícone, comparativo de raridades e ficha JSON na pasta armas/."
            actions={
              listLoading ? (
                <Loader2 className="size-4 animate-spin text-ink-400" aria-hidden />
              ) : (
                <Badge tone="neutral">{weapons.length}</Badge>
              )
            }
          >
            {weapons.length === 0 ? (
              <p className="text-xs text-ink-500">
                Nenhuma skin salva ainda. Use “Salvar no projeto” para gravar a primeira.
              </p>
            ) : (
              <ul className="space-y-2">
                {weapons.map((asset) => (
                  <li
                    key={asset.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-base-800 bg-base-950/40 p-2.5"
                  >
                    <SkinThumb relativePath={asset.iconPath} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-100">{asset.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
                        <span className="flex items-center gap-1">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: rarityById(asset.rarity).color }}
                          />
                          {asset.rarityLabel}
                        </span>
                        <span>·</span>
                        <span>{asset.wearLabel}</span>
                        <span>·</span>
                        <span className="font-mono">{asset.float.toFixed(3)}</span>
                        <span>·</span>
                        <span>{asset.size} px</span>
                        <span>·</span>
                        <span>{formatDateTime(asset.createdAt)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Pencil}
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

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="flex items-center gap-2 rounded-lg border border-base-800 bg-base-950/40 px-2.5 py-1.5 text-[11px] text-ink-400">
                <Palette className="size-3.5 text-accent-300" aria-hidden /> 6 padrões
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-base-800 bg-base-950/40 px-2.5 py-1.5 text-[11px] text-ink-400">
                <Layers className="size-3.5 text-accent-300" aria-hidden /> 6 raridades separadas da
                condição
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-base-800 bg-base-950/40 px-2.5 py-1.5 text-[11px] text-ink-400">
                <Crosshair className="size-3.5 text-accent-300" aria-hidden /> 9 modelos base
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={removeTarget !== null}
        title="Remover esta skin?"
        description="A pasta da skin (ícone, comparativo e ficha) vai para a lixeira interna do Studio."
        confirmLabel="Remover skin"
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
