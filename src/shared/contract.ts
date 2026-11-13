import type {
  CharacterAsset,
  CharacterCategory,
  CharacterDirection,
  CharacterSpec,
  DescriptionSuggestion
} from './characters'
import type { AnimationAsset, AnimationConfig, AnimationPreview } from './animations'
import type { MapAsset, MapConfig, MapDraft, MapPreview } from './maps'
import type {
  WeaponAsset,
  WeaponComparison,
  WeaponPreview,
  WeaponSpec,
  WeaponSuggestion
} from './weapons'
import type { EffectAsset, EffectPreview, EffectSpec } from './effects'
import type { SkillAsset, SkillSpec, SkillSuggestion } from './skills'
import type { ItemAsset, ItemPreview, ItemSpec, ItemSuggestion } from './items'
import type { DropTableAsset, DropTableSpec, DropTableStats } from './drops'
import type { UpdateCheckResult } from './updates'
import type {
  AiAudioResult,
  AiCodeResult,
  AiFileEntry,
  AiImageResult,
  AiImageSize,
  AiProviderId,
  AiProvidersView,
  AiTestResult,
  AiTextResult,
  SaveAiProviderInput,
  AssistantApplyResult,
  AssistantPlan
} from './ai'

/**
 * Contrato compartilhado entre o processo principal (Node) e a interface (React).
 * Tudo aqui é serializável: nenhuma função, classe ou objeto nativo atravessa o IPC.
 */

export type ProjectStatus = 'ativo' | 'arquivado'

export interface ProjectSummary {
  id: string
  name: string
  slug: string
  description: string
  path: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  lastOpenedAt: string | null
  assetCount: number
  backupCount: number
  sizeBytes: number
  folderExists: boolean
}

export interface BackupSummary {
  id: string
  projectId: string
  label: string
  path: string
  sizeBytes: number
  kind: 'manual' | 'automatico' | 'seguranca'
  createdAt: string
}

export interface ActivityEntry {
  id: string
  projectId: string | null
  type: string
  message: string
  createdAt: string
}

export interface StudioSettings {
  workspaceRoot: string
  activeProjectId: string | null
  onboardingDone: boolean
  maxBackups: number
  lastOpenedPage: string
  /** Caminho do executável da Godot 4 (opcional, só para conferir a versão). */
  godotExecutable: string
}

export interface StudioPaths {
  dataDir: string
  dbPath: string
  workspaceRoot: string
  backupsDir: string
  appVersion: string
}

export interface StudioStats {
  projectCount: number
  backupCount: number
  assetCount: number
  totalSizeBytes: number
  activeProjectName: string | null
}

export interface CreateProjectInput {
  name: string
  description?: string
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  status?: ProjectStatus
}

export interface RestoreResult {
  restoredFrom: BackupSummary
  safetyBackup: BackupSummary | null
}

/* ------------------------------------------------------- gerenciador de arquivos */

export type FileCategory =
  | 'pasta'
  | 'imagem'
  | 'audio'
  | 'cena'
  | 'codigo'
  | 'dados'
  | 'texto'
  | 'outro'

export interface FileEntry {
  name: string
  relativePath: string
  isDirectory: boolean
  sizeBytes: number
  modifiedAt: string
  category: FileCategory
  extension: string
  childCount: number
}

export interface FilePreview {
  relativePath: string
  name: string
  category: FileCategory
  sizeBytes: number
  modifiedAt: string
  text: string | null
  dataUrl: string | null
  truncated: boolean
}

export interface ImportedFile {
  name: string
  relativePath: string
}

export interface ImportFilesResult {
  imported: ImportedFile[]
  renamed: ImportedFile[]
  skipped: Array<{ name: string; reason: string }>
}

/* ---------------------------------------------------------------- Godot 4 */

export interface GodotProjectInfo {
  path: string
  valid: boolean
  problem: string | null
  name: string
  engineVersion: string | null
  configVersion: number | null
  features: string[]
  mainScene: string | null
  autoloads: string[]
  counts: {
    scenes: number
    scripts: number
    images: number
    resources: number
    other: number
  }
  scenes: string[]
  scripts: string[]
}

export interface GodotLink {
  path: string
  linkedAt: string
  lastExportAt: string | null
}

export interface GodotExecutableInfo {
  path: string | null
  version: string | null
  ok: boolean
  message: string
}

export interface ProjectGodotState {
  link: GodotLink | null
  info: GodotProjectInfo | null
  executable: GodotExecutableInfo
}

export type GodotPlanAction = 'criar' | 'sobrescrever' | 'igual'

export interface GodotFilePlan {
  relativePath: string
  action: GodotPlanAction
  bytes: number
  language: 'gdscript' | 'json' | 'markdown' | 'binario'
  preview: string | null
}

export interface GodotExportPlan {
  targetPath: string
  files: GodotFilePlan[]
  assetCount: number
  warnings: string[]
}

export interface GodotExportResult {
  written: number
  unchanged: number
  backupPath: string | null
  targetPath: string
}

export interface ProgressEvent {
  operationId: string
  label: string
  percent: number
  done: boolean
}

/**
 * Envelope de resposta usado em todo o IPC.
 * Em caso de erro, `message` já vem em português e pronta para exibição.
 */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; message: string }

export interface StudioApi {
  app: {
    paths(): Promise<StudioPaths>
    openDataFolder(): Promise<void>
    openProjectFolder(projectId: string): Promise<void>
    smokeTestReady(): void
  }
  settings: {
    get(): Promise<StudioSettings>
    update(patch: Partial<StudioSettings>): Promise<StudioSettings>
    chooseWorkspace(): Promise<StudioSettings | null>
    resetOnboarding(): Promise<StudioSettings>
  }
  projects: {
    list(): Promise<ProjectSummary[]>
    create(input: CreateProjectInput): Promise<ProjectSummary>
    get(id: string): Promise<ProjectSummary>
    update(id: string, patch: UpdateProjectInput): Promise<ProjectSummary>
    open(id: string): Promise<ProjectSummary>
    duplicate(id: string, newName?: string): Promise<ProjectSummary>
    remove(id: string, deleteFiles: boolean): Promise<void>
    backup(id: string, label?: string): Promise<BackupSummary>
    listBackups(id: string): Promise<BackupSummary[]>
    restoreBackup(backupId: string): Promise<RestoreResult>
  }
  activity: {
    list(limit?: number): Promise<ActivityEntry[]>
  }
  stats: {
    get(): Promise<StudioStats>
  }
  files: {
    list(projectId: string, relativePath: string): Promise<FileEntry[]>
    preview(projectId: string, relativePath: string): Promise<FilePreview>
    importFiles(projectId: string, relativePath: string): Promise<ImportFilesResult | null>
    createFolder(projectId: string, relativePath: string, name: string): Promise<FileEntry>
    trash(projectId: string, relativePath: string): Promise<void>
    openFolder(projectId: string, relativePath: string): Promise<void>
  }
  characters: {
    preview(spec: CharacterSpec): Promise<Partial<Record<CharacterDirection, string>>>
    interpret(description: string): Promise<DescriptionSuggestion>
    save(projectId: string, spec: CharacterSpec): Promise<CharacterAsset>
    list(projectId: string, category?: CharacterCategory): Promise<CharacterAsset[]>
    remove(assetId: string): Promise<void>
  }
  animations: {
    preview(config: AnimationConfig): Promise<AnimationPreview>
    save(projectId: string, config: AnimationConfig): Promise<AnimationAsset>
    list(projectId: string): Promise<AnimationAsset[]>
    remove(assetId: string): Promise<void>
  }
  maps: {
    propose(draft: Partial<MapDraft>): Promise<MapConfig>
    preview(config: MapConfig): Promise<MapPreview>
    save(projectId: string, config: MapConfig): Promise<MapAsset>
    list(projectId: string): Promise<MapAsset[]>
    load(assetId: string): Promise<MapConfig>
    remove(assetId: string): Promise<void>
  }
  weapons: {
    preview(spec: WeaponSpec): Promise<WeaponPreview>
    compare(spec: WeaponSpec): Promise<WeaponComparison>
    interpret(description: string): Promise<WeaponSuggestion>
    save(projectId: string, spec: WeaponSpec): Promise<WeaponAsset>
    list(projectId: string): Promise<WeaponAsset[]>
    remove(assetId: string): Promise<void>
  }
  effects: {
    preview(spec: EffectSpec): Promise<EffectPreview>
    save(projectId: string, spec: EffectSpec): Promise<EffectAsset>
    list(projectId: string): Promise<EffectAsset[]>
    remove(assetId: string): Promise<void>
  }
  skills: {
    preview(spec: SkillSpec): Promise<{ icon: string; effect: EffectPreview }>
    interpret(description: string): Promise<SkillSuggestion>
    save(projectId: string, spec: SkillSpec): Promise<SkillAsset>
    list(projectId: string): Promise<SkillAsset[]>
    remove(assetId: string): Promise<void>
  }
  items: {
    preview(spec: ItemSpec): Promise<ItemPreview>
    interpret(description: string): Promise<ItemSuggestion>
    save(projectId: string, spec: ItemSpec): Promise<ItemAsset>
    list(projectId: string): Promise<ItemAsset[]>
    remove(assetId: string): Promise<void>
  }
  drops: {
    stats(spec: DropTableSpec): Promise<DropTableStats>
    save(projectId: string, spec: DropTableSpec): Promise<DropTableAsset>
    list(projectId: string): Promise<DropTableAsset[]>
    remove(assetId: string): Promise<void>
  }
  ai: {
    providers(): Promise<AiProvidersView>
    saveProvider(input: SaveAiProviderInput): Promise<AiProvidersView>
    removeKey(provider: AiProviderId): Promise<AiProvidersView>
    test(provider: AiProviderId): Promise<AiTestResult>
    text(prompt: string, system?: string): Promise<AiTextResult>
    code(projectId: string, prompt: string): Promise<AiCodeResult>
    image(projectId: string, prompt: string, size: AiImageSize): Promise<AiImageResult>
    audio(projectId: string, text: string): Promise<AiAudioResult>
    files(projectId: string): Promise<AiFileEntry[]>
  }
  assistant: {
    plan(projectId: string, request: string): Promise<AssistantPlan>
    apply(projectId: string, plan: AssistantPlan): Promise<AssistantApplyResult>
  }
  diagnostics: {
    logs(): Promise<{ path: string; text: string; bytes: number }>
    openLogsFolder(): Promise<void>
    report(message: string): Promise<void>
  }
  updates: {
    check(): Promise<UpdateCheckResult>
    openPage(url: string): Promise<void>
  }
  godot: {
    state(projectId: string): Promise<ProjectGodotState>
    link(projectId: string): Promise<ProjectGodotState | null>
    unlink(projectId: string): Promise<ProjectGodotState>
    plan(projectId: string): Promise<GodotExportPlan>
    exportProject(projectId: string): Promise<GodotExportResult>
    chooseExecutable(): Promise<GodotExecutableInfo>
    checkExecutable(): Promise<GodotExecutableInfo>
  }
  events: {
    onProgress(callback: (event: ProgressEvent) => void): () => void
  }
}

export const IPC = {
  appPaths: 'studio:app:paths',
  appOpenDataFolder: 'studio:app:open-data-folder',
  appOpenProjectFolder: 'studio:app:open-project-folder',
  appSmokeReady: 'studio:app:smoke-ready',
  settingsGet: 'studio:settings:get',
  settingsUpdate: 'studio:settings:update',
  settingsChooseWorkspace: 'studio:settings:choose-workspace',
  settingsResetOnboarding: 'studio:settings:reset-onboarding',
  projectsList: 'studio:projects:list',
  projectsCreate: 'studio:projects:create',
  projectsGet: 'studio:projects:get',
  projectsUpdate: 'studio:projects:update',
  projectsOpen: 'studio:projects:open',
  projectsDuplicate: 'studio:projects:duplicate',
  projectsRemove: 'studio:projects:remove',
  projectsBackup: 'studio:projects:backup',
  projectsListBackups: 'studio:projects:list-backups',
  projectsRestoreBackup: 'studio:projects:restore-backup',
  activityList: 'studio:activity:list',
  statsGet: 'studio:stats:get',
  filesList: 'studio:files:list',
  filesPreview: 'studio:files:preview',
  filesImport: 'studio:files:import',
  filesCreateFolder: 'studio:files:create-folder',
  filesTrash: 'studio:files:trash',
  filesOpenFolder: 'studio:files:open-folder',
  godotState: 'studio:godot:state',
  godotLink: 'studio:godot:link',
  godotUnlink: 'studio:godot:unlink',
  godotPlan: 'studio:godot:plan',
  godotExport: 'studio:godot:export',
  godotChooseExecutable: 'studio:godot:choose-executable',
  godotCheckExecutable: 'studio:godot:check-executable',
  charactersPreview: 'studio:characters:preview',
  charactersInterpret: 'studio:characters:interpret',
  charactersSave: 'studio:characters:save',
  charactersList: 'studio:characters:list',
  charactersRemove: 'studio:characters:remove',
  animationsPreview: 'studio:animations:preview',
  animationsSave: 'studio:animations:save',
  animationsList: 'studio:animations:list',
  animationsRemove: 'studio:animations:remove',
  mapsPropose: 'studio:maps:propose',
  mapsPreview: 'studio:maps:preview',
  mapsSave: 'studio:maps:save',
  mapsList: 'studio:maps:list',
  mapsLoad: 'studio:maps:load',
  mapsRemove: 'studio:maps:remove',
  weaponsPreview: 'studio:weapons:preview',
  weaponsCompare: 'studio:weapons:compare',
  weaponsInterpret: 'studio:weapons:interpret',
  weaponsSave: 'studio:weapons:save',
  weaponsList: 'studio:weapons:list',
  weaponsRemove: 'studio:weapons:remove',
  effectsPreview: 'studio:effects:preview',
  effectsSave: 'studio:effects:save',
  effectsList: 'studio:effects:list',
  effectsRemove: 'studio:effects:remove',
  skillsPreview: 'studio:skills:preview',
  skillsInterpret: 'studio:skills:interpret',
  skillsSave: 'studio:skills:save',
  skillsList: 'studio:skills:list',
  skillsRemove: 'studio:skills:remove',
  itemsPreview: 'studio:items:preview',
  itemsInterpret: 'studio:items:interpret',
  itemsSave: 'studio:items:save',
  itemsList: 'studio:items:list',
  itemsRemove: 'studio:items:remove',
  dropsStats: 'studio:drops:stats',
  dropsSave: 'studio:drops:save',
  dropsList: 'studio:drops:list',
  dropsRemove: 'studio:drops:remove',
  aiProviders: 'studio:ai:providers',
  aiSaveProvider: 'studio:ai:save-provider',
  aiRemoveKey: 'studio:ai:remove-key',
  aiTest: 'studio:ai:test',
  aiText: 'studio:ai:text',
  aiCode: 'studio:ai:code',
  aiImage: 'studio:ai:image',
  aiAudio: 'studio:ai:audio',
  aiFiles: 'studio:ai:files',
  assistantPlan: 'studio:assistant:plan',
  assistantApply: 'studio:assistant:apply',
  diagnosticsLogs: 'studio:diagnostics:logs',
  diagnosticsOpenLogs: 'studio:diagnostics:open-logs',
  diagnosticsReport: 'studio:diagnostics:report',
  updatesCheck: 'studio:updates:check',
  updatesOpen: 'studio:updates:open',
  eventProgress: 'studio:event:progress'
} as const
