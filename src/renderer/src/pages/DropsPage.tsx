import {
  Calculator,
  Dices,
  Loader2,
  Plus,
  Save,
  Scale,
  Trash2,
  TriangleAlert
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DROP_LIMITS,
  DROP_MODE_HINTS,
  DROP_MODE_LABELS,
  DROP_SOURCES,
  chanceSum,
  defaultDropTable,
  dropTableStats,
  newDropEntry,
  normalizeEntries,
  type DropEntry,
  type DropMode,
  type DropSource,
  type DropTableAsset,
  type DropTableSpec
} from '@shared/drops'
import { ITEM_RARITIES, itemRarityById } from '@shared/items'
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

function percent(value: number): string {
  return `${Number(value.toFixed(2)).toString()}%`
}

export function DropsPage(): React.JSX.Element {
  const { activeProject, navigate, notify } = useApp()
  const projectId = activeProject?.id ?? null

  const [spec, setSpec] = useState<DropTableSpec>(defaultDropTable)
  const [saving, setSaving] = useState(false)
  const [tables, setTables] = useState<DropTableAsset[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<DropTableAsset | null>(null)
  const [removing, setRemoving] = useState(false)

  const stats = useMemo(() => dropTableStats(spec), [spec])
  const total = chanceSum(spec.entries)

  const loadTables = useCallback(async () => {
    if (!projectId) {
      setTables([])
      return
    }
    setListLoading(true)
    try {
      setTables(await window.studio.drops.list(projectId))
    } catch (error) {
      notify('erro', 'Não foi possível listar as tabelas', messageOf(error))
    } finally {
      setListLoading(false)
    }
  }, [projectId, notify])

  useEffect(() => {
    void loadTables()
  }, [loadTables])

  function patch(changes: Partial<DropTableSpec>): void {
    setSpec((current) => ({ ...current, ...changes }))
  }

  function updateEntry(id: string, changes: Partial<DropEntry>): void {
    setSpec((current) => ({
      ...current,
      entries: current.entries.map((entry) =>
        entry.id === id ? { ...entry, ...changes } : entry
      )
    }))
  }

  function addEntry(): void {
    setSpec((current) => {
      if (current.entries.length >= DROP_LIMITS.maxEntries) return current
      const entry = newDropEntry(current.entries.length)
      return { ...current, entries: [...current.entries, { ...entry, id: crypto.randomUUID() }] }
    })
  }

  function removeEntry(id: string): void {
    setSpec((current) => ({
      ...current,
      entries: current.entries.filter((entry) => entry.id !== id)
    }))
  }

  function distribute(): void {
    setSpec((current) => ({ ...current, entries: normalizeEntries(current.entries) }))
  }

  async function save(): Promise<void> {
    if (!projectId) return
    setSaving(true)
    try {
      const asset = await window.studio.drops.save(projectId, spec)
      notify(
        'sucesso',
        'Tabela salva',
        `${asset.scriptPath} e ${asset.csvPath} foram gravados no projeto.`
      )
      await loadTables()
    } catch (error) {
      notify('erro', 'Não foi possível salvar a tabela', messageOf(error))
    } finally {
      setSaving(false)
    }
  }

  async function confirmRemove(): Promise<void> {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await window.studio.drops.remove(removeTarget.id)
      notify('sucesso', 'Tabela removida', 'A pasta foi para a lixeira interna do Studio.')
      setRemoveTarget(null)
      await loadTables()
    } catch (error) {
      notify('erro', 'Não foi possível remover a tabela', messageOf(error))
    } finally {
      setRemoving(false)
    }
  }

  if (!activeProject) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Etapa 8"
          title="Drops e economia"
          description="Tabelas de recompensa com validação real de probabilidades."
        />
        <EmptyState
          icon={Dices}
          title="Nenhum projeto ativo"
          description="Abra ou crie um projeto para montar tabelas de drops. Cada tabela grava ficha JSON, planilha CSV e script GDScript na pasta drops/."
          action={
            <Button icon={Dices} onClick={() => navigate({ name: 'projetos' })}>
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
        eyebrow="Etapa 8"
        title="Drops e economia"
        description="Nas tabelas exclusivas as chances precisam somar exatamente 100%. Nas independentes cada item rola sozinho."
        actions={
          <Button icon={Save} loading={saving} onClick={() => void save()}>
            Salvar no projeto
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card title="Tabela" description="Nome, de onde vem e como as chances funcionam.">
            <div className="space-y-3">
              <Field label="Nome">
                <Input
                  value={spec.name}
                  maxLength={60}
                  onChange={(event) => patch({ name: event.target.value })}
                />
              </Field>
              <Field label="Descrição">
                <textarea
                  value={spec.description}
                  maxLength={240}
                  rows={2}
                  onChange={(event) => patch({ description: event.target.value })}
                  className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
                />
              </Field>
              <Field label="Fonte">
                <select
                  value={spec.source}
                  onChange={(event) => patch({ source: event.target.value as DropSource })}
                  className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
                >
                  {DROP_SOURCES.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Modo">
                <select
                  value={spec.mode}
                  onChange={(event) => patch({ mode: event.target.value as DropMode })}
                  className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
                >
                  {(Object.keys(DROP_MODE_LABELS) as DropMode[]).map((mode) => (
                    <option key={mode} value={mode}>
                      {DROP_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="text-[11px] leading-relaxed text-ink-500">
                {DROP_MODE_HINTS[spec.mode]}
              </p>
              <Field
                label="Aberturas na calculadora"
                hint={`${DROP_LIMITS.minRolls} a ${DROP_LIMITS.maxRolls}`}
              >
                <Input
                  type="number"
                  min={DROP_LIMITS.minRolls}
                  max={DROP_LIMITS.maxRolls}
                  value={spec.rolls}
                  onChange={(event) =>
                    patch({
                      rolls: Math.max(
                        DROP_LIMITS.minRolls,
                        Math.min(DROP_LIMITS.maxRolls, Number(event.target.value) || 1)
                      )
                    })
                  }
                />
              </Field>
            </div>
          </Card>

          <Card
            title="Calculadora de chances"
            description={`Resultado para ${stats.rolls} abertura(s).`}
            actions={<Calculator className="size-4 text-ink-400" aria-hidden />}
          >
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs text-ink-400">
                  <span>Total das chances</span>
                  <span className={stats.mode === 'exclusiva' && Math.abs(total - 100) > 0.01 ? 'text-amber-300' : 'text-emerald-300'}>
                    {percent(total)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-base-800">
                  <div
                    className={`h-full transition-all ${
                      Math.abs(total - 100) <= 0.01 ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, total))}%` }}
                  />
                </div>
              </div>

              <p className="text-xs text-ink-300">
                Itens esperados por abertura:{' '}
                <span className="font-medium text-ink-100">
                  {(stats.expectedItems / Math.max(1, stats.rolls)).toFixed(2)}
                </span>
              </p>

              {stats.problem ? (
                <Note tone="warning">
                  <span className="flex items-start gap-2">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {stats.problem}
                  </span>
                </Note>
              ) : (
                <Note tone="success">Tabela válida para salvar.</Note>
              )}

              {stats.mode === 'exclusiva' && Math.abs(total - 100) > 0.01 ? (
                <Button variant="secondary" size="sm" icon={Scale} onClick={distribute}>
                  Distribuir 100%
                </Button>
              ) : null}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card
            title="Itens da tabela"
            description="Nome, raridade, chance e quantidade entregue."
            actions={
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{spec.entries.length}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Plus}
                  onClick={addEntry}
                  disabled={spec.entries.length >= DROP_LIMITS.maxEntries}
                >
                  Adicionar
                </Button>
              </div>
            }
          >
            {spec.entries.length === 0 ? (
              <p className="text-xs text-ink-500">
                Nenhum item na tabela. Use “Adicionar” para incluir a primeira recompensa.
              </p>
            ) : (
              <ul className="space-y-2">
                {spec.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-xl border border-base-800 bg-base-950/40 p-2.5"
                  >
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_90px]">
                      <Input
                        value={entry.itemName}
                        maxLength={60}
                        aria-label={`Nome do item ${entry.itemName}`}
                        onChange={(event) => updateEntry(entry.id, { itemName: event.target.value })}
                      />
                      <select
                        value={entry.rarity}
                        aria-label="Raridade"
                        onChange={(event) =>
                          updateEntry(entry.id, {
                            rarity: event.target.value as DropEntry['rarity']
                          })
                        }
                        className="w-full rounded-xl border border-base-700 bg-base-950/70 px-2.5 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
                      >
                        {ITEM_RARITIES.map((rarity) => (
                          <option key={rarity.id} value={rarity.id}>
                            {rarity.label}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min={DROP_LIMITS.minChance}
                        max={DROP_LIMITS.maxChance}
                        step={0.01}
                        value={entry.chance}
                        aria-label="Chance em porcentagem"
                        onChange={(event) =>
                          updateEntry(entry.id, {
                            chance: Math.max(
                              DROP_LIMITS.minChance,
                              Math.min(DROP_LIMITS.maxChance, Number(event.target.value) || 0)
                            )
                          })
                        }
                      />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
                      <span>Quantidade</span>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={entry.min}
                        aria-label="Quantidade mínima"
                        onChange={(event) =>
                          updateEntry(entry.id, { min: Number(event.target.value) || 1 })
                        }
                        className="w-16 rounded-lg border border-base-700 bg-base-950/70 px-2 py-1 text-center text-ink-100 focus:border-accent-500 focus:outline-none"
                      />
                      <span>a</span>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={entry.max}
                        aria-label="Quantidade máxima"
                        onChange={(event) =>
                          updateEntry(entry.id, {
                            max: Math.max(
                              entry.min,
                              Number(event.target.value) || entry.min
                            )
                          })
                        }
                        className="w-16 rounded-lg border border-base-700 bg-base-950/70 px-2 py-1 text-center text-ink-100 focus:border-accent-500 focus:outline-none"
                      />

                      <span
                        className="ml-1 rounded px-1.5 py-0.5"
                        style={{
                          backgroundColor: `${itemRarityById(entry.rarity).color}22`,
                          color: itemRarityById(entry.rarity).color
                        }}
                      >
                        {itemRarityById(entry.rarity).label}
                      </span>

                      <span className="ml-auto">
                        {stats.entries.find((item) => item.id === entry.id)?.expected.toFixed(2) ??
                          '0,00'}{' '}
                        esperados ·{' '}
                        {percent(
                          (stats.entries.find((item) => item.id === entry.id)?.atLeastOne ?? 0) *
                            100
                        )}{' '}
                        de sair ao menos 1
                      </span>

                      <button
                        type="button"
                        onClick={() => removeEntry(entry.id)}
                        className="rounded-lg border border-base-700 p-1 text-ink-400 transition-colors hover:border-red-500/50 hover:text-red-300"
                        aria-label={`Remover ${entry.itemName}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Tabelas salvas"
            description="Cada tabela grava ficha JSON, planilha CSV e script GDScript na pasta drops/."
            actions={
              listLoading ? (
                <Loader2 className="size-4 animate-spin text-ink-400" aria-hidden />
              ) : (
                <Badge tone="neutral">{tables.length}</Badge>
              )
            }
          >
            {tables.length === 0 ? (
              <p className="text-xs text-ink-500">
                Nenhuma tabela salva ainda. Use “Salvar no projeto” para gravar a primeira.
              </p>
            ) : (
              <ul className="space-y-2">
                {tables.map((asset) => (
                  <li
                    key={asset.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-base-800 bg-base-950/40 p-2.5"
                  >
                    <div className="grid size-10 place-items-center rounded-lg border border-base-700 bg-base-950">
                      <Dices className="size-4 text-accent-300" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-100">{asset.name}</p>
                      <p className="mt-0.5 text-[11px] text-ink-500">
                        {asset.entryCount} itens ·{' '}
                        {asset.mode === 'exclusiva' ? 'exclusiva' : 'independente'} ·{' '}
                        {percent(asset.totalChance)} · {formatDateTime(asset.createdAt)}
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
        title="Remover esta tabela?"
        description="A pasta da tabela vai para a lixeira interna do Studio."
        confirmLabel="Remover tabela"
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
