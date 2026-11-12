import { Image as ImageIcon, Loader2, Package, Save, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ITEM_ATTRIBUTE_LABELS,
  ITEM_ATTRIBUTE_RANGES,
  ITEM_CATEGORIES,
  ITEM_CATEGORY_ATTRIBUTES,
  ITEM_CATEGORY_COLORS,
  ITEM_CATEGORY_HINTS,
  ITEM_CATEGORY_LABELS,
  ITEM_RARITIES,
  DEFAULT_ITEM_ATTRIBUTES,
  describeItem,
  defaultItemSpec,
  type ItemAsset,
  type ItemAttributeKey,
  type ItemCategory,
  type ItemRarity,
  type ItemSpec
} from '@shared/items'
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

function ItemThumb({ relativePath }: { relativePath: string }): React.JSX.Element {
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

export function ItemsPage(): React.JSX.Element {
  const { activeProject, navigate, notify } = useApp()
  const projectId = activeProject?.id ?? null

  const [category, setCategory] = useState<ItemCategory>('colete')
  const [name, setName] = useState(defaultItemSpec('colete').name)
  const [nameTouched, setNameTouched] = useState(false)
  const [description, setDescription] = useState(defaultItemSpec('colete').description)
  const [rarity, setRarity] = useState<ItemRarity>('comum')
  const [attributes, setAttributes] = useState(defaultItemSpec('colete').attributes)
  const [colors, setColors] = useState({ ...ITEM_CATEGORY_COLORS.colete })
  const [seed, setSeed] = useState(2024)
  const [size, setSize] = useState<32 | 64 | 96>(64)

  const [icon, setIcon] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<ItemAsset[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<ItemAsset | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (nameTouched) return
    setName(ITEM_CATEGORY_LABELS[category])
  }, [category, nameTouched])

  const spec: ItemSpec = useMemo(
    () => ({
      category,
      name: name.trim() || ITEM_CATEGORY_LABELS[category],
      description,
      rarity,
      attributes,
      colors,
      seed,
      size
    }),
    [category, name, description, rarity, attributes, colors, seed, size]
  )

  const specKey = JSON.stringify(spec)

  useEffect(() => {
    let cancelled = false
    setPreviewLoading(true)
    const timer = window.setTimeout(() => {
      void window.studio.items
        .preview(JSON.parse(specKey) as ItemSpec)
        .then((result) => {
          if (cancelled) return
          setIcon(result.icon)
          setPreviewError(null)
        })
        .catch((error: unknown) => {
          if (cancelled) return
          setIcon(null)
          setPreviewError(messageOf(error) ?? 'Não foi possível desenhar o ícone.')
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false)
        })
    }, 260)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [specKey])

  const loadItems = useCallback(async () => {
    if (!projectId) {
      setItems([])
      return
    }
    setListLoading(true)
    try {
      setItems(await window.studio.items.list(projectId))
    } catch (error) {
      notify('erro', 'Não foi possível listar os itens', messageOf(error))
    } finally {
      setListLoading(false)
    }
  }, [projectId, notify])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  function chooseCategory(next: ItemCategory): void {
    setCategory(next)
    setAttributes({ ...DEFAULT_ITEM_ATTRIBUTES[next] })
    setColors({ ...ITEM_CATEGORY_COLORS[next] })
    setDescription(ITEM_CATEGORY_HINTS[next])
    setNameTouched(false)
  }

  function setAttribute(key: ItemAttributeKey, value: number): void {
    const range = ITEM_ATTRIBUTE_RANGES[key]
    setAttributes((current) => ({
      ...current,
      [key]: Math.max(range.min, Math.min(range.max, Math.round(value) || 0))
    }))
  }

  async function interpret(): Promise<void> {
    try {
      const suggestion = await window.studio.items.interpret(description)
      if (!suggestion.category && !suggestion.rarity && !suggestion.attributes) {
        notify(
          'info',
          'Nenhuma pista encontrada',
          'Descreva o item com palavras como “colete de 60 de armadura” ou “seringa que cura 40”.'
        )
        return
      }

      if (suggestion.category) chooseCategory(suggestion.category)
      if (suggestion.rarity) setRarity(suggestion.rarity)
      if (suggestion.attributes) {
        setAttributes((current) => ({ ...current, ...suggestion.attributes }))
      }
      notify(
        'sucesso',
        'Descrição aplicada',
        suggestion.matches.length > 0
          ? `Reconhecido: ${suggestion.matches.join(', ')}. Ajuste o que quiser.`
          : 'Os campos foram preenchidos pela descrição.'
      )
    } catch (error) {
      notify('erro', 'Não foi possível interpretar a descrição', messageOf(error))
    }
  }

  async function save(): Promise<void> {
    if (!projectId) return
    setSaving(true)
    try {
      const asset = await window.studio.items.save(projectId, spec)
      notify('sucesso', 'Item salvo', `${asset.iconPath} foi gravado no projeto.`)
      await loadItems()
    } catch (error) {
      notify('erro', 'Não foi possível salvar o item', messageOf(error))
    } finally {
      setSaving(false)
    }
  }

  async function confirmRemove(): Promise<void> {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await window.studio.items.remove(removeTarget.id)
      notify('sucesso', 'Item removido', 'A pasta foi para a lixeira interna do Studio.')
      setRemoveTarget(null)
      await loadItems()
    } catch (error) {
      notify('erro', 'Não foi possível remover o item', messageOf(error))
    } finally {
      setRemoving(false)
    }
  }

  if (!activeProject) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Etapa 8"
          title="Itens e equipamentos"
          description="Coletes, capacetes, mochilas, seringas, kits médicos, chaves e itens especiais."
        />
        <EmptyState
          icon={Package}
          title="Nenhum projeto ativo"
          description="Abra ou crie um projeto para gerar itens. Cada item grava o ícone PNG e a ficha JSON na pasta itens/."
          action={
            <Button icon={Package} onClick={() => navigate({ name: 'projetos' })}>
              Ir para meus projetos
            </Button>
          }
        />
      </div>
    )
  }

  const relevant = ITEM_CATEGORY_ATTRIBUTES[category]
  const rarityInfo = ITEM_RARITIES.find((item) => item.id === rarity) ?? ITEM_RARITIES[0]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Etapa 8"
        title="Itens e equipamentos"
        description="O ícone é desenhado em pixel art a partir da categoria. A raridade é só a faixa colorida — quem define o item são os atributos."
        actions={
          <Button icon={Save} loading={saving} onClick={() => void save()}>
            Salvar no projeto
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card title="Categoria" description="Sete tipos de item para o seu jogo.">
            <div className="grid grid-cols-2 gap-1.5">
              {ITEM_CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => chooseCategory(item)}
                  className={`rounded-xl border px-2.5 py-2 text-left text-[11px] transition-colors ${
                    category === item
                      ? 'border-accent-500/60 bg-accent-500/15 text-accent-100'
                      : 'border-base-700 bg-base-950/40 text-ink-300 hover:border-base-600'
                  }`}
                >
                  {ITEM_CATEGORY_LABELS[item]}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
              {ITEM_CATEGORY_HINTS[category]}
            </p>
          </Card>

          <Card title="Identificação" description="Nome, raridade e descrição.">
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

              <Field label="Descrição" hint="Descreva e use “Aplicar descrição” para preencher.">
                <textarea
                  value={description}
                  maxLength={240}
                  rows={3}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
                />
              </Field>

              <Button
                variant="secondary"
                size="sm"
                icon={Sparkles}
                onClick={() => void interpret()}
              >
                Aplicar descrição
              </Button>

              <Field label="Raridade">
                <select
                  value={rarity}
                  onChange={(event) => setRarity(event.target.value as ItemRarity)}
                  className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
                >
                  {ITEM_RARITIES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="text-[11px] text-ink-500">{rarityInfo?.hint}</p>
            </div>
          </Card>

          <Card title="Atributos" description={`Só os que valem para ${ITEM_CATEGORY_LABELS[category].toLowerCase()}.`}>
            <div className="space-y-3">
              {relevant.map((key) => (
                <Field
                  key={key}
                  label={ITEM_ATTRIBUTE_LABELS[key]}
                  hint={`${ITEM_ATTRIBUTE_RANGES[key].min} a ${ITEM_ATTRIBUTE_RANGES[key].max}`}
                >
                  <Input
                    type="number"
                    min={ITEM_ATTRIBUTE_RANGES[key].min}
                    max={ITEM_ATTRIBUTE_RANGES[key].max}
                    step={ITEM_ATTRIBUTE_RANGES[key].step}
                    value={attributes[key]}
                    onChange={(event) => setAttribute(key, Number(event.target.value))}
                  />
                </Field>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Cor principal">
                  <input
                    type="color"
                    value={colors.primaria}
                    onChange={(event) => setColors({ ...colors, primaria: event.target.value })}
                    className="h-9 w-full cursor-pointer rounded-lg border border-base-700 bg-base-950"
                    aria-label="Cor principal"
                  />
                </Field>
                <Field label="Cor secundária">
                  <input
                    type="color"
                    value={colors.secundaria}
                    onChange={(event) => setColors({ ...colors, secundaria: event.target.value })}
                    className="h-9 w-full cursor-pointer rounded-lg border border-base-700 bg-base-950"
                    aria-label="Cor secundária"
                  />
                </Field>
                <Field label="Tamanho">
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
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card
            title="Prévia do ícone"
            description="O mesmo desenho que será gravado no projeto."
            actions={
              previewLoading ? (
                <Loader2 className="size-4 animate-spin text-ink-400" aria-hidden />
              ) : (
                <Badge tone="neutral">{size} px</Badge>
              )
            }
          >
            <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
              <div className="grid place-items-center rounded-xl border border-base-800 bg-base-950/70 p-3">
                {icon ? (
                  <img
                    src={icon}
                    alt="Ícone do item"
                    className="h-40 w-40 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <div className="flex h-40 items-center gap-2 text-xs text-ink-500">
                    <ImageIcon className="size-4" aria-hidden />
                    {previewError ? 'sem prévia' : 'preparando…'}
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs text-ink-400">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink-100">{spec.name}</span>
                  <Badge tone="neutral">{rarityInfo?.label}</Badge>
                </div>
                <p>{describeItem(spec)}</p>
                <p className="text-ink-500">
                  {ITEM_CATEGORY_LABELS[category]} · {size} px · semente {seed}
                </p>
                <p className="text-[11px] leading-relaxed text-ink-500">
                  Arquivos gerados: <code>itens/{'{nome}'}/{'{nome}'}_icone.png</code> e a ficha{' '}
                  <code>{'{nome}'}.json</code> com categoria, raridade e atributos.
                </p>
                {previewError && <Note tone="warning">{previewError}</Note>}
              </div>
            </div>
          </Card>

          <Card
            title="Itens salvos"
            description="Cada item grava ícone PNG e ficha JSON na pasta itens/."
            actions={
              listLoading ? (
                <Loader2 className="size-4 animate-spin text-ink-400" aria-hidden />
              ) : (
                <Badge tone="neutral">{items.length}</Badge>
              )
            }
          >
            {items.length === 0 ? (
              <p className="text-xs text-ink-500">
                Nenhum item salvo ainda. Use “Salvar no projeto” para gravar o primeiro.
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((asset) => (
                  <li
                    key={asset.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-base-800 bg-base-950/40 p-2.5"
                  >
                    <ItemThumb relativePath={asset.iconPath} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-100">{asset.name}</p>
                      <p className="mt-0.5 text-[11px] text-ink-500">
                        {asset.categoryLabel} · {asset.rarityLabel} ·{' '}
                        {describeItem(asset.spec) || 'sem atributos'} ·{' '}
                        {formatDateTime(asset.createdAt)}
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
        title="Remover este item?"
        description="A pasta do item vai para a lixeira interna do Studio."
        confirmLabel="Remover item"
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
