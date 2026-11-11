import {
  Eraser,
  Grid3x3,
  Image as ImageIcon,
  Loader2,
  Map as MapIcon,
  MousePointerClick,
  Paintbrush,
  Pencil,
  Save,
  Shield,
  Sparkles,
  Swords,
  Trash2
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_MAP_HEIGHT,
  DEFAULT_MAP_TILE_SIZE,
  DEFAULT_MAP_WIDTH,
  MAP_THEMES,
  MAX_MAP_PIXELS,
  MAX_MAP_SIZE,
  MAX_TILE_SIZE,
  MIN_MAP_SIZE,
  MIN_TILE_SIZE,
  SPAWN_COLORS,
  SPAWN_KINDS,
  SPAWN_LABELS,
  TILE_HINTS,
  TILE_KINDS,
  TILE_LABELS,
  ZONE_COLORS,
  ZONE_KINDS,
  ZONE_LABELS,
  tileColor,
  type MapAsset,
  type MapConfig,
  type MapSpawn,
  type SpawnKind,
  type TileKind,
  type ZoneKind
} from '@shared/maps'
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

type Tool = 'terreno' | 'borracha' | 'colisao' | 'zona' | 'spawn'

type PaintMode = { tool: 'terreno'; kind: TileKind } | { tool: 'borracha' } | { tool: 'colisao'; value: boolean }

const TOOLS: Array<{ id: Tool; label: string; icon: typeof Paintbrush; hint: string }> = [
  { id: 'terreno', label: 'Pincel', icon: Paintbrush, hint: 'Pinta o tile escolhido. Arraste para pintar vários.' },
  { id: 'borracha', label: 'Borracha', icon: Eraser, hint: 'Apaga o tile e libera a colisão da célula.' },
  { id: 'colisao', label: 'Colisão', icon: Shield, hint: 'Alterna o bloqueio da célula. Arraste para marcar várias.' },
  { id: 'zona', label: 'Zona', icon: Grid3x3, hint: 'Clique e arraste para desenhar um retângulo de área.' },
  { id: 'spawn', label: 'Spawn', icon: MousePointerClick, hint: 'Clique para criar um ponto de spawn.' }
]

function messageOf(error: unknown): string | undefined {
  return error instanceof Error && error.message ? error.message : undefined
}

function createInitialMap(): MapConfig {
  const width = DEFAULT_MAP_WIDTH
  const height = DEFAULT_MAP_HEIGHT
  return {
    name: 'Mapa sem título',
    description: '',
    themeId: 'militar',
    width,
    height,
    tileSize: DEFAULT_MAP_TILE_SIZE,
    seed: 1337,
    tiles: Array.from({ length: width * height }, () => null),
    collision: Array.from({ length: width * height }, () => false),
    zones: [],
    spawns: []
  }
}

function MapThumb({ relativePath }: { relativePath: string }): React.JSX.Element {
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
    <div className="grid h-16 w-24 place-items-center overflow-hidden rounded-lg border border-base-700 bg-base-950">
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

export function MapsPage(): React.JSX.Element {
  const { activeProject, navigate, notify } = useApp()
  const projectId = activeProject?.id ?? null

  const [config, setConfig] = useState<MapConfig>(createInitialMap)
  const [themeChoice, setThemeChoice] = useState('auto')
  const [tool, setTool] = useState<Tool>('terreno')
  const [brush, setBrush] = useState<TileKind>('grama')
  const [zoneKind, setZoneKind] = useState<ZoneKind>('segura')
  const [spawnKind, setSpawnKind] = useState<SpawnKind>('jogador')
  const [showCollision, setShowCollision] = useState(true)
  const [showZones, setShowZones] = useState(true)

  const [preview, setPreview] = useState<{ image: string; tileset: string } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [maps, setMaps] = useState<MapAsset[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<MapAsset | null>(null)
  const [removing, setRemoving] = useState(false)

  const gridRef = useRef<HTMLDivElement | null>(null)
  const paintingRef = useRef(false)
  const paintModeRef = useRef<PaintMode | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const [dragRect, setDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null)

  const cellSize = useMemo(() => {
    const available = 760
    return Math.max(4, Math.min(26, Math.floor(available / Math.max(1, config.width))))
  }, [config.width])

  const loadMaps = useCallback(async () => {
    if (!projectId) {
      setMaps([])
      return
    }
    setListLoading(true)
    try {
      setMaps(await window.studio.maps.list(projectId))
    } catch (error) {
      notify('erro', 'Não foi possível listar os mapas', messageOf(error))
    } finally {
      setListLoading(false)
    }
  }, [projectId, notify])

  useEffect(() => {
    void loadMaps()
  }, [loadMaps])

  // Prévia renderizada pelo motor do Studio (mesmo desenho entregue à Godot).
  useEffect(() => {
    let cancelled = false
    setPreviewLoading(true)
    const timer = window.setTimeout(() => {
      void window.studio.maps
        .preview(config)
        .then((result) => {
          if (cancelled) return
          setPreview({ image: result.image, tileset: result.tileset })
          setPreviewError(null)
        })
        .catch((error: unknown) => {
          if (cancelled) return
          setPreview(null)
          setPreviewError(messageOf(error) ?? 'Não foi possível desenhar a prévia.')
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false)
        })
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [config])

  function updateCell(x: number, y: number, mode: PaintMode): void {
    setConfig((previous) => {
      const index = y * previous.width + x
      if (index < 0 || index >= previous.tiles.length) return previous
      const tiles = [...previous.tiles]
      const collision = [...previous.collision]

      if (mode.tool === 'terreno') {
        tiles[index] = mode.kind
        collision[index] = mode.kind === 'parede' || mode.kind === 'agua'
      } else if (mode.tool === 'borracha') {
        tiles[index] = null
        collision[index] = false
      } else {
        collision[index] = mode.value
      }

      return { ...previous, tiles, collision }
    })
  }

  function addSpawn(x: number, y: number): void {
    setConfig((previous) => {
      if (previous.spawns.some((spawn) => spawn.x === x && spawn.y === y)) return previous
      const count = previous.spawns.filter((spawn) => spawn.kind === spawnKind).length + 1
      const spawn: MapSpawn = {
        id: crypto.randomUUID(),
        kind: spawnKind,
        name: `${SPAWN_LABELS[spawnKind]} ${count}`,
        x,
        y
      }
      return { ...previous, spawns: [...previous.spawns, spawn] }
    })
  }

  function cellFromEvent(event: React.PointerEvent<HTMLDivElement>): { x: number; y: number } | null {
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return null
    const x = Math.floor((event.clientX - rect.left) / cellSize)
    const y = Math.floor((event.clientY - rect.top) / cellSize)
    if (x < 0 || y < 0 || x >= config.width || y >= config.height) return null
    return { x, y }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    const cell = cellFromEvent(event)
    if (!cell) return
    event.currentTarget.setPointerCapture(event.pointerId)
    paintingRef.current = true
    setHoverCell(cell)

    if (tool === 'zona') {
      dragStartRef.current = cell
      setDragRect({ x: cell.x, y: cell.y, w: 1, h: 1 })
      return
    }
    if (tool === 'spawn') {
      addSpawn(cell.x, cell.y)
      return
    }

    const index = cell.y * config.width + cell.x
    const mode: PaintMode =
      tool === 'colisao'
        ? { tool: 'colisao', value: !config.collision[index] }
        : tool === 'borracha'
          ? { tool: 'borracha' }
          : { tool: 'terreno', kind: brush }

    paintModeRef.current = mode
    updateCell(cell.x, cell.y, mode)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    const cell = cellFromEvent(event)
    setHoverCell(cell)
    if (!cell || !paintingRef.current) return

    const start = dragStartRef.current
    if (tool === 'zona' && start) {
      setDragRect({
        x: Math.min(start.x, cell.x),
        y: Math.min(start.y, cell.y),
        w: Math.abs(start.x - cell.x) + 1,
        h: Math.abs(start.y - cell.y) + 1
      })
      return
    }

    const mode = paintModeRef.current
    if (mode) updateCell(cell.x, cell.y, mode)
  }

  function finishStroke(): void {
    const start = dragStartRef.current
    if (tool === 'zona' && start && dragRect) {
      const count = config.zones.filter((zone) => zone.kind === zoneKind).length + 1
      setConfig((previous) => ({
        ...previous,
        zones: [
          ...previous.zones,
          {
            id: crypto.randomUUID(),
            kind: zoneKind,
            name: `${ZONE_LABELS[zoneKind]} ${count}`,
            x: dragRect.x,
            y: dragRect.y,
            w: dragRect.w,
            h: dragRect.h
          }
        ]
      }))
    }
    paintingRef.current = false
    paintModeRef.current = null
    dragStartRef.current = null
    setDragRect(null)
  }

  async function generate(): Promise<void> {
    try {
      const proposal = await window.studio.maps.propose({
        name: config.name.trim() || 'Mapa sem título',
        description: config.description,
        themeId: themeChoice,
        width: config.width,
        height: config.height,
        tileSize: config.tileSize,
        seed: config.seed
      })
      setConfig(proposal)
      setThemeChoice('auto')
      notify('sucesso', 'Proposta gerada', 'O mapa é seu: pinte, marque colisões e desenhe as áreas.')
    } catch (error) {
      notify('erro', 'Não foi possível gerar a proposta', messageOf(error))
    }
  }

  function clearGrid(): void {
    setConfig((previous) => ({
      ...previous,
      tiles: Array.from({ length: previous.width * previous.height }, () => null),
      collision: Array.from({ length: previous.width * previous.height }, () => false),
      zones: [],
      spawns: []
    }))
  }

  async function save(): Promise<void> {
    if (!projectId) return
    setSaving(true)
    try {
      const asset = await window.studio.maps.save(projectId, config)
      notify('sucesso', 'Mapa salvo', `${asset.imagePath} foi gravado no projeto.`)
      await loadMaps()
    } catch (error) {
      notify('erro', 'Não foi possível salvar o mapa', messageOf(error))
    } finally {
      setSaving(false)
    }
  }

  async function loadSaved(asset: MapAsset): Promise<void> {
    try {
      const loaded = await window.studio.maps.load(asset.id)
      setConfig(loaded)
      setThemeChoice('auto')
      notify('sucesso', 'Mapa carregado', `Editando "${asset.name}".`)
    } catch (error) {
      notify('erro', 'Não foi possível abrir o mapa', messageOf(error))
    }
  }

  async function confirmRemove(): Promise<void> {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await window.studio.maps.remove(removeTarget.id)
      notify('sucesso', 'Mapa removido', 'Os arquivos foram para a lixeira interna do Studio.')
      setRemoveTarget(null)
      await loadMaps()
    } catch (error) {
      notify('erro', 'Não foi possível remover o mapa', messageOf(error))
    } finally {
      setRemoving(false)
    }
  }

  if (!activeProject) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Etapa 5"
          title="Construtor de mapas"
          description="Pinte o terreno, defina colisões, áreas e spawns e exporte o mapa para a Godot 4."
        />
        <EmptyState
          icon={MapIcon}
          title="Nenhum projeto ativo"
          description="Abra ou crie um projeto para desenhar mapas. Tudo fica salvo dentro da pasta do projeto."
          action={
            <Button icon={MapIcon} onClick={() => navigate({ name: 'projetos' })}>
              Ir para meus projetos
            </Button>
          }
        />
      </div>
    )
  }

  const blocked = config.collision.filter(Boolean).length
  const filled = config.tiles.filter((tile) => tile !== null).length
  const total = config.width * config.height
  const theme = MAP_THEMES.find((item) => item.id === config.themeId)
  const pixelsWide = config.width * config.tileSize

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Etapa 5"
        title="Construtor de mapas"
        description="Pinte tiles, marque o que bloqueia a passagem, desenhe áreas e posicione spawns. A imagem da prévia é a mesma que a Godot recebe."
        actions={
          <>
            <Button variant="secondary" icon={Sparkles} onClick={() => void generate()}>
              Gerar proposta
            </Button>
            <Button icon={Save} loading={saving} onClick={() => void save()}>
              Salvar no projeto
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card title="Mapa" description="Nome, tema e tamanho da grade.">
            <div className="space-y-3">
              <Field label="Nome do mapa">
                <Input
                  value={config.name}
                  onChange={(event) => setConfig({ ...config, name: event.target.value })}
                  maxLength={60}
                  placeholder="Arena do deserto"
                />
              </Field>

              <Field label="Descrição" hint="A descrição orienta a proposta gerada (tema, rio, caminhos).">
                <Textarea
                  rows={2}
                  value={config.description}
                  onChange={(event) => setConfig({ ...config, description: event.target.value })}
                  placeholder="arena militar abandonada com pátio central"
                />
              </Field>

              <Field label="Tema visual">
                <select
                  value={themeChoice}
                  onChange={(event) => {
                    const value = event.target.value
                    setThemeChoice(value)
                    if (value !== 'auto') setConfig({ ...config, themeId: value })
                  }}
                  className="w-full rounded-xl border border-base-700 bg-base-950/70 px-3 py-2.5 text-sm text-ink-100 focus:border-accent-500 focus:outline-none"
                >
                  <option value="auto">Automático (pela descrição)</option>
                  {MAP_THEMES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
              {theme && <p className="text-[11px] leading-relaxed text-ink-500">{theme.hint}</p>}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Largura (tiles)">
                  <Input
                    type="number"
                    min={MIN_MAP_SIZE}
                    max={MAX_MAP_SIZE}
                    value={config.width}
                    onChange={(event) => {
                      const width = Math.max(
                        MIN_MAP_SIZE,
                        Math.min(MAX_MAP_SIZE, Number(event.target.value) || MIN_MAP_SIZE)
                      )
                      const tiles = Array.from(
                        { length: width * config.height },
                        (_, index) => config.tiles[index] ?? null
                      )
                      const collision = Array.from(
                        { length: width * config.height },
                        (_, index) => config.collision[index] ?? false
                      )
                      setConfig({
                        ...config,
                        width,
                        tiles,
                        collision,
                        zones: config.zones.map((zone) => ({
                          ...zone,
                          x: Math.min(zone.x, Math.max(0, width - zone.w))
                        })),
                        spawns: config.spawns.map((spawn) => ({
                          ...spawn,
                          x: Math.min(spawn.x, width - 1)
                        }))
                      })
                    }}
                  />
                </Field>
                <Field label="Altura (tiles)">
                  <Input
                    type="number"
                    min={MIN_MAP_SIZE}
                    max={MAX_MAP_SIZE}
                    value={config.height}
                    onChange={(event) => {
                      const height = Math.max(
                        MIN_MAP_SIZE,
                        Math.min(MAX_MAP_SIZE, Number(event.target.value) || MIN_MAP_SIZE)
                      )
                      const tiles = Array.from(
                        { length: config.width * height },
                        (_, index) => config.tiles[index] ?? null
                      )
                      const collision = Array.from(
                        { length: config.width * height },
                        (_, index) => config.collision[index] ?? false
                      )
                      setConfig({
                        ...config,
                        height,
                        tiles,
                        collision,
                        zones: config.zones.map((zone) => ({
                          ...zone,
                          y: Math.min(zone.y, Math.max(0, height - zone.h))
                        })),
                        spawns: config.spawns.map((spawn) => ({
                          ...spawn,
                          y: Math.min(spawn.y, height - 1)
                        }))
                      })
                    }}
                  />
                </Field>
                <Field label="Tile (px)">
                  <Input
                    type="number"
                    min={MIN_TILE_SIZE}
                    max={MAX_TILE_SIZE}
                    value={config.tileSize}
                    onChange={(event) =>
                      setConfig({
                        ...config,
                        tileSize: Math.max(
                          MIN_TILE_SIZE,
                          Math.min(MAX_TILE_SIZE, Number(event.target.value) || MIN_TILE_SIZE)
                        )
                      })
                    }
                  />
                </Field>
                <Field label="Semente">
                  <Input
                    type="number"
                    value={config.seed}
                    onChange={(event) =>
                      setConfig({ ...config, seed: Math.abs(Number(event.target.value) || 1) })
                    }
                  />
                </Field>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" icon={Eraser} onClick={clearGrid}>
                  Limpar grade
                </Button>
              </div>
            </div>
          </Card>

          <Card title="Ferramentas" description="Escolha o que o mouse faz na grade.">
            <div className="grid grid-cols-2 gap-2">
              {TOOLS.map((item) => {
                const Icon = item.icon
                const active = tool === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTool(item.id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                      active
                        ? 'border-accent-500/60 bg-accent-500/15 text-accent-100'
                        : 'border-base-700 bg-base-950/40 text-ink-300 hover:border-base-600 hover:text-ink-100'
                    }`}
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden />
                    {item.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
              {TOOLS.find((item) => item.id === tool)?.hint}
            </p>

            {tool === 'terreno' && (
              <div className="mt-3">
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-ink-300 uppercase">
                  Tile do pincel
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {TILE_KINDS.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      title={TILE_HINTS[kind]}
                      onClick={() => setBrush(kind)}
                      className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[10px] transition-colors ${
                        brush === kind
                          ? 'border-accent-400 bg-accent-500/15 text-accent-100'
                          : 'border-base-700 bg-base-950/40 text-ink-400 hover:border-base-600'
                      }`}
                    >
                      <span
                        className="size-6 rounded border border-black/40"
                        style={{ backgroundColor: tileColor(config.themeId, kind) }}
                      />
                      {TILE_LABELS[kind]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tool === 'zona' && (
              <div className="mt-3">
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-ink-300 uppercase">
                  Tipo de área
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ZONE_KINDS.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setZoneKind(kind)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                        zoneKind === kind
                          ? 'border-white/40 text-white'
                          : 'border-base-700 text-ink-300 hover:border-base-600'
                      }`}
                      style={
                        zoneKind === kind
                          ? { backgroundColor: `${ZONE_COLORS[kind]}33` }
                          : undefined
                      }
                    >
                      {ZONE_LABELS[kind]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tool === 'spawn' && (
              <div className="mt-3">
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-ink-300 uppercase">
                  Tipo de spawn
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SPAWN_KINDS.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setSpawnKind(kind)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                        spawnKind === kind
                          ? 'border-white/40 text-white'
                          : 'border-base-700 text-ink-300 hover:border-base-600'
                      }`}
                      style={
                        spawnKind === kind
                          ? { backgroundColor: `${SPAWN_COLORS[kind]}33` }
                          : undefined
                      }
                    >
                      {SPAWN_LABELS[kind]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="mt-3 flex items-center gap-2 text-[11px] text-ink-300">
              <input
                type="checkbox"
                checked={showCollision}
                onChange={(event) => setShowCollision(event.target.checked)}
                className="size-3.5 accent-accent-500"
              />
              Mostrar colisão
            </label>
            <label className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-300">
              <input
                type="checkbox"
                checked={showZones}
                onChange={(event) => setShowZones(event.target.checked)}
                className="size-3.5 accent-accent-500"
              />
              Mostrar áreas e spawns
            </label>
          </Card>
        </div>

        <div className="space-y-5">
          <Card
            title="Grade do mapa"
            description={`${config.width} × ${config.height} tiles · ${pixelsWide} px de largura · ${filled}/${total} células pintadas`}
            actions={
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{blocked} bloqueadas</Badge>
                <Badge tone="accent">
                  {hoverCell ? `x ${hoverCell.x} · y ${hoverCell.y}` : 'arraste para pintar'}
                </Badge>
              </div>
            }
          >
            <div className="overflow-auto rounded-xl border border-base-800 bg-base-950/60 p-3">
              <div
                ref={gridRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishStroke}
                onPointerLeave={() => setHoverCell(null)}
                onPointerCancel={finishStroke}
                className="relative mx-auto grid cursor-crosshair touch-none select-none"
                style={{
                  gridTemplateColumns: `repeat(${config.width}, ${cellSize}px)`,
                  gridTemplateRows: `repeat(${config.height}, ${cellSize}px)`,
                  width: config.width * cellSize,
                  height: config.height * cellSize,
                  backgroundColor: '#0b1120'
                }}
              >
                {config.tiles.map((tile, index) => {
                  const x = index % config.width
                  const y = Math.floor(index / config.width)
                  const solid = config.collision[index] === true
                  return (
                    <div
                      key={`${x}-${y}`}
                      className="relative"
                      style={{
                        backgroundColor: tileColor(config.themeId, tile),
                        boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.18)'
                      }}
                    >
                      {showCollision && solid && (
                        <span
                          className="absolute inset-0"
                          style={{ backgroundColor: 'rgba(248,113,113,0.42)' }}
                        />
                      )}
                      {hoverCell && hoverCell.x === x && hoverCell.y === y && (
                        <span className="absolute inset-0 border border-white/70" />
                      )}
                    </div>
                  )
                })}

                {showZones &&
                  config.zones.map((zone) => (
                    <div
                      key={zone.id}
                      className="pointer-events-none absolute flex items-start justify-end rounded-sm border-2"
                      style={{
                        left: zone.x * cellSize,
                        top: zone.y * cellSize,
                        width: zone.w * cellSize,
                        height: zone.h * cellSize,
                        borderColor: ZONE_COLORS[zone.kind],
                        backgroundColor: `${ZONE_COLORS[zone.kind]}22`
                      }}
                    >
                      <span
                        className="rounded-sm px-0.5 text-[9px] font-semibold"
                        style={{ backgroundColor: ZONE_COLORS[zone.kind], color: '#0b1120' }}
                      >
                        {ZONE_LABELS[zone.kind].split(' ')[1] ?? ZONE_LABELS[zone.kind]}
                      </span>
                    </div>
                  ))}

                {dragRect && (
                  <div
                    className="pointer-events-none absolute rounded-sm border-2 border-white/80 bg-white/15"
                    style={{
                      left: dragRect.x * cellSize,
                      top: dragRect.y * cellSize,
                      width: dragRect.w * cellSize,
                      height: dragRect.h * cellSize
                    }}
                  />
                )}

                {showZones &&
                  config.spawns.map((spawn) => (
                    <div
                      key={spawn.id}
                      title={`${spawn.name} (${spawn.x}, ${spawn.y})`}
                      className="pointer-events-none absolute rounded-full border border-black/60"
                      style={{
                        left: spawn.x * cellSize + cellSize * 0.2,
                        top: spawn.y * cellSize + cellSize * 0.2,
                        width: Math.max(4, cellSize * 0.6),
                        height: Math.max(4, cellSize * 0.6),
                        backgroundColor: SPAWN_COLORS[spawn.kind]
                      }}
                    />
                  ))}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-ink-400">
              <span className="flex items-center gap-1.5">
                <Shield className="size-3 text-red-300" aria-hidden /> colisão
              </span>
              <span className="flex items-center gap-1.5">
                <Swords className="size-3 text-amber-300" aria-hidden /> áreas do jogo
              </span>
              <span className="flex items-center gap-1.5">
                <MousePointerClick className="size-3 text-sky-300" aria-hidden /> spawns
              </span>
              <span className="ml-auto text-ink-500">
                A imagem exportada tem {config.width * config.tileSize} ×{' '}
                {config.height * config.tileSize} px
              </span>
            </div>

            {previewError && (
              <div className="mt-3">
                <Note tone="warning">{previewError}</Note>
              </div>
            )}
          </Card>

          <Card
            title="Imagem renderizada"
            description="Desenho real do mapa e atlas de tiles gerados pelo Studio — é isso que vai para a Godot."
            actions={
              previewLoading ? (
                <span className="flex items-center gap-1.5 text-[11px] text-ink-400">
                  <Loader2 className="size-3 animate-spin" aria-hidden /> desenhando
                </span>
              ) : null
            }
          >
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
              <div className="grid place-items-center overflow-auto rounded-xl border border-base-800 bg-base-950/60 p-3">
                {preview ? (
                  <img
                    src={preview.image}
                    alt="Prévia do mapa"
                    className="max-h-[360px] w-auto max-w-full"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ) : (
                  <div className="flex h-32 items-center gap-2 text-xs text-ink-500">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Preparando a prévia…
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold tracking-wide text-ink-300 uppercase">
                  Atlas de tiles
                </p>
                <div className="overflow-hidden rounded-lg border border-base-800 bg-base-950 p-2">
                  {preview ? (
                    <img
                      src={preview.tileset}
                      alt="Atlas de tiles"
                      className="w-full"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <div className="h-6" />
                  )}
                </div>
                <ul className="space-y-1 text-[11px] text-ink-400">
                  {TILE_KINDS.slice(0, 4).map((kind) => (
                    <li key={kind} className="flex items-center gap-2">
                      <span
                        className="size-3 rounded border border-black/40"
                        style={{ backgroundColor: tileColor(config.themeId, kind) }}
                      />
                      {TILE_LABELS[kind]}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {pixelsWide > MAX_MAP_PIXELS && (
              <div className="mt-3">
                <Note tone="warning">
                  O mapa passaria de {MAX_MAP_PIXELS} px de largura. Reduza o tamanho dos tiles
                  para conseguir salvar.
                </Note>
              </div>
            )}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card
              title="Áreas"
              description="Retângulos exportados como Area2D com o tipo em metadados."
              actions={<Badge tone="neutral">{config.zones.length}</Badge>}
            >
              {config.zones.length === 0 ? (
                <p className="text-xs text-ink-500">
                  Nenhuma área ainda. Escolha a ferramenta Zona e arraste na grade.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {config.zones.map((zone) => (
                    <li
                      key={zone.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-base-800 bg-base-950/40 px-2.5 py-1.5"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-xs text-ink-200">
                        <span
                          className="size-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: ZONE_COLORS[zone.kind] }}
                        />
                        <span className="truncate">{zone.name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-[11px] text-ink-500">
                        {zone.w}×{zone.h} em {zone.x},{zone.y}
                        <button
                          type="button"
                          aria-label={`Remover ${zone.name}`}
                          onClick={() =>
                            setConfig({
                              ...config,
                              zones: config.zones.filter((item) => item.id !== zone.id)
                            })
                          }
                          className="rounded p-0.5 text-ink-500 transition-colors hover:bg-white/5 hover:text-red-300"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card
              title="Pontos de spawn"
              description="Viram Marker2D na cena da Godot."
              actions={<Badge tone="neutral">{config.spawns.length}</Badge>}
            >
              {config.spawns.length === 0 ? (
                <p className="text-xs text-ink-500">
                  Nenhum spawn ainda. Escolha a ferramenta Spawn e clique na grade.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {config.spawns.map((spawn) => (
                    <li
                      key={spawn.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-base-800 bg-base-950/40 px-2.5 py-1.5"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-xs text-ink-200">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: SPAWN_COLORS[spawn.kind] }}
                        />
                        <span className="truncate">{spawn.name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-[11px] text-ink-500">
                        {spawn.x},{spawn.y}
                        <button
                          type="button"
                          aria-label={`Remover ${spawn.name}`}
                          onClick={() =>
                            setConfig({
                              ...config,
                              spawns: config.spawns.filter((item) => item.id !== spawn.id)
                            })
                          }
                          className="rounded p-0.5 text-ink-500 transition-colors hover:bg-white/5 hover:text-red-300"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card
            title="Mapas salvos"
            description="Cada mapa grava imagem, atlas, dados, script e cena na pasta mapas/ do projeto."
            actions={
              listLoading ? (
                <Loader2 className="size-4 animate-spin text-ink-400" aria-hidden />
              ) : (
                <Badge tone="neutral">{maps.length}</Badge>
              )
            }
          >
            {maps.length === 0 ? (
              <p className="text-xs text-ink-500">
                Nenhum mapa salvo ainda. Use “Salvar no projeto” para gravar o primeiro.
              </p>
            ) : (
              <ul className="space-y-2">
                {maps.map((asset) => (
                  <li
                    key={asset.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-base-800 bg-base-950/40 p-2.5"
                  >
                    <MapThumb relativePath={asset.imagePath} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-100">{asset.name}</p>
                      <p className="mt-0.5 text-[11px] text-ink-500">
                        {asset.width}×{asset.height} tiles · {asset.tileSize} px ·{' '}
                        {asset.zoneCount} área(s) · {asset.spawnCount} spawn(s) ·{' '}
                        {formatDateTime(asset.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Pencil}
                        onClick={() => void loadSaved(asset)}
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
            <div className="mt-3">
              <Note tone="info">
                Ao exportar para a Godot, a pasta <code className="text-accent-200">mapas/</code>{' '}
                vai junto. Abra a cena <code className="text-accent-200">.tscn</code> gerada e o
                TileMapLayer, as colisões, as áreas e os spawns são montados automaticamente.
              </Note>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={removeTarget !== null}
        title="Remover este mapa?"
        description="A pasta do mapa (imagem, atlas, dados, script e cena) vai para a lixeira interna do Studio."
        confirmLabel="Remover mapa"
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
