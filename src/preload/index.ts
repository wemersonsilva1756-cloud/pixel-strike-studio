import { contextBridge, ipcRenderer } from 'electron'
import type {
  CharacterAsset,
  CharacterCategory,
  CharacterDirection,
  CharacterSpec,
  DescriptionSuggestion
} from '@shared/characters'
import type { AnimationAsset, AnimationConfig, AnimationPreview } from '@shared/animations'
import type { MapAsset, MapConfig, MapDraft, MapPreview } from '@shared/maps'
import type {
  WeaponAsset,
  WeaponComparison,
  WeaponPreview,
  WeaponSpec,
  WeaponSuggestion
} from '@shared/weapons'
import type { EffectAsset, EffectPreview, EffectSpec } from '@shared/effects'
import type { SkillAsset, SkillSpec, SkillSuggestion } from '@shared/skills'
import type { ItemAsset, ItemPreview, ItemSpec, ItemSuggestion } from '@shared/items'
import type { DropTableAsset, DropTableSpec, DropTableStats } from '@shared/drops'
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
} from '@shared/ai'
import {
  IPC,
  type ActivityEntry,
  type BackupSummary,
  type CreateProjectInput,
  type FileEntry,
  type FilePreview,
  type GodotExecutableInfo,
  type GodotExportPlan,
  type GodotExportResult,
  type ImportFilesResult,
  type IpcResult,
  type ProgressEvent,
  type ProjectGodotState,
  type ProjectSummary,
  type RestoreResult,
  type StudioApi,
  type StudioPaths,
  type StudioSettings,
  type StudioStats,
  type UpdateProjectInput
} from '@shared/contract'

/**
 * Ponte segura entre a interface e o processo principal.
 * A interface nunca recebe acesso direto ao Node, ao sistema de arquivos ou ao banco.
 */

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T> | undefined

  if (!result || typeof result !== 'object' || !('ok' in result)) {
    throw new Error('O aplicativo não respondeu corretamente. Tente novamente.')
  }
  if (!result.ok) {
    throw new Error(result.message)
  }
  return result.data
}

const api: StudioApi = {
  app: {
    paths: () => invoke<StudioPaths>(IPC.appPaths),
    openDataFolder: () => invoke<void>(IPC.appOpenDataFolder),
    openProjectFolder: (projectId: string) => invoke<void>(IPC.appOpenProjectFolder, projectId),
    smokeTestReady: () => ipcRenderer.send(IPC.appSmokeReady)
  },
  settings: {
    get: () => invoke<StudioSettings>(IPC.settingsGet),
    update: (patch) => invoke<StudioSettings>(IPC.settingsUpdate, patch),
    chooseWorkspace: () => invoke<StudioSettings | null>(IPC.settingsChooseWorkspace),
    resetOnboarding: () => invoke<StudioSettings>(IPC.settingsResetOnboarding)
  },
  projects: {
    list: () => invoke<ProjectSummary[]>(IPC.projectsList),
    create: (input: CreateProjectInput) => invoke<ProjectSummary>(IPC.projectsCreate, input),
    get: (id: string) => invoke<ProjectSummary>(IPC.projectsGet, id),
    update: (id: string, patch: UpdateProjectInput) =>
      invoke<ProjectSummary>(IPC.projectsUpdate, id, patch),
    open: (id: string) => invoke<ProjectSummary>(IPC.projectsOpen, id),
    duplicate: (id: string, newName?: string) =>
      invoke<ProjectSummary>(IPC.projectsDuplicate, id, newName),
    remove: (id: string, deleteFiles: boolean) =>
      invoke<void>(IPC.projectsRemove, id, deleteFiles),
    backup: (id: string, label?: string) => invoke<BackupSummary>(IPC.projectsBackup, id, label),
    listBackups: (id: string) => invoke<BackupSummary[]>(IPC.projectsListBackups, id),
    restoreBackup: (backupId: string) => invoke<RestoreResult>(IPC.projectsRestoreBackup, backupId)
  },
  activity: {
    list: (limit?: number) => invoke<ActivityEntry[]>(IPC.activityList, limit)
  },
  stats: {
    get: () => invoke<StudioStats>(IPC.statsGet)
  },
  files: {
    list: (projectId: string, relativePath: string) =>
      invoke<FileEntry[]>(IPC.filesList, projectId, relativePath),
    preview: (projectId: string, relativePath: string) =>
      invoke<FilePreview>(IPC.filesPreview, projectId, relativePath),
    importFiles: (projectId: string, relativePath: string) =>
      invoke<ImportFilesResult | null>(IPC.filesImport, projectId, relativePath),
    createFolder: (projectId: string, relativePath: string, name: string) =>
      invoke<FileEntry>(IPC.filesCreateFolder, projectId, relativePath, name),
    trash: (projectId: string, relativePath: string) =>
      invoke<void>(IPC.filesTrash, projectId, relativePath),
    openFolder: (projectId: string, relativePath: string) =>
      invoke<void>(IPC.filesOpenFolder, projectId, relativePath)
  },
  characters: {
    preview: (spec: CharacterSpec) =>
      invoke<Partial<Record<CharacterDirection, string>>>(IPC.charactersPreview, spec),
    interpret: (description: string) =>
      invoke<DescriptionSuggestion>(IPC.charactersInterpret, description),
    save: (projectId: string, spec: CharacterSpec) =>
      invoke<CharacterAsset>(IPC.charactersSave, projectId, spec),
    list: (projectId: string, category?: CharacterCategory) =>
      invoke<CharacterAsset[]>(IPC.charactersList, projectId, category),
    remove: (assetId: string) => invoke<void>(IPC.charactersRemove, assetId)
  },
  animations: {
    preview: (config: AnimationConfig) => invoke<AnimationPreview>(IPC.animationsPreview, config),
    save: (projectId: string, config: AnimationConfig) =>
      invoke<AnimationAsset>(IPC.animationsSave, projectId, config),
    list: (projectId: string) => invoke<AnimationAsset[]>(IPC.animationsList, projectId),
    remove: (assetId: string) => invoke<void>(IPC.animationsRemove, assetId)
  },
  maps: {
    propose: (draft: Partial<MapDraft>) => invoke<MapConfig>(IPC.mapsPropose, draft),
    preview: (config: MapConfig) => invoke<MapPreview>(IPC.mapsPreview, config),
    save: (projectId: string, config: MapConfig) =>
      invoke<MapAsset>(IPC.mapsSave, projectId, config),
    list: (projectId: string) => invoke<MapAsset[]>(IPC.mapsList, projectId),
    load: (assetId: string) => invoke<MapConfig>(IPC.mapsLoad, assetId),
    remove: (assetId: string) => invoke<void>(IPC.mapsRemove, assetId)
  },
  weapons: {
    preview: (spec: WeaponSpec) => invoke<WeaponPreview>(IPC.weaponsPreview, spec),
    compare: (spec: WeaponSpec) => invoke<WeaponComparison>(IPC.weaponsCompare, spec),
    interpret: (description: string) =>
      invoke<WeaponSuggestion>(IPC.weaponsInterpret, description),
    save: (projectId: string, spec: WeaponSpec) =>
      invoke<WeaponAsset>(IPC.weaponsSave, projectId, spec),
    list: (projectId: string) => invoke<WeaponAsset[]>(IPC.weaponsList, projectId),
    remove: (assetId: string) => invoke<void>(IPC.weaponsRemove, assetId)
  },
  effects: {
    preview: (spec: EffectSpec) => invoke<EffectPreview>(IPC.effectsPreview, spec),
    save: (projectId: string, spec: EffectSpec) =>
      invoke<EffectAsset>(IPC.effectsSave, projectId, spec),
    list: (projectId: string) => invoke<EffectAsset[]>(IPC.effectsList, projectId),
    remove: (assetId: string) => invoke<void>(IPC.effectsRemove, assetId)
  },
  skills: {
    preview: (spec: SkillSpec) =>
      invoke<{ icon: string; effect: EffectPreview }>(IPC.skillsPreview, spec),
    interpret: (description: string) =>
      invoke<SkillSuggestion>(IPC.skillsInterpret, description),
    save: (projectId: string, spec: SkillSpec) =>
      invoke<SkillAsset>(IPC.skillsSave, projectId, spec),
    list: (projectId: string) => invoke<SkillAsset[]>(IPC.skillsList, projectId),
    remove: (assetId: string) => invoke<void>(IPC.skillsRemove, assetId)
  },
  items: {
    preview: (spec: ItemSpec) => invoke<ItemPreview>(IPC.itemsPreview, spec),
    interpret: (description: string) =>
      invoke<ItemSuggestion>(IPC.itemsInterpret, description),
    save: (projectId: string, spec: ItemSpec) =>
      invoke<ItemAsset>(IPC.itemsSave, projectId, spec),
    list: (projectId: string) => invoke<ItemAsset[]>(IPC.itemsList, projectId),
    remove: (assetId: string) => invoke<void>(IPC.itemsRemove, assetId)
  },
  drops: {
    stats: (spec: DropTableSpec) => invoke<DropTableStats>(IPC.dropsStats, spec),
    save: (projectId: string, spec: DropTableSpec) =>
      invoke<DropTableAsset>(IPC.dropsSave, projectId, spec),
    list: (projectId: string) => invoke<DropTableAsset[]>(IPC.dropsList, projectId),
    remove: (assetId: string) => invoke<void>(IPC.dropsRemove, assetId)
  },
  ai: {
    providers: () => invoke<AiProvidersView>(IPC.aiProviders),
    saveProvider: (input: SaveAiProviderInput) =>
      invoke<AiProvidersView>(IPC.aiSaveProvider, input),
    removeKey: (provider: AiProviderId) =>
      invoke<AiProvidersView>(IPC.aiRemoveKey, provider),
    test: (provider: AiProviderId) => invoke<AiTestResult>(IPC.aiTest, provider),
    text: (prompt: string, system?: string) =>
      invoke<AiTextResult>(IPC.aiText, prompt, system),
    code: (projectId: string, prompt: string) =>
      invoke<AiCodeResult>(IPC.aiCode, projectId, prompt),
    image: (projectId: string, prompt: string, size: AiImageSize) =>
      invoke<AiImageResult>(IPC.aiImage, projectId, prompt, size),
    audio: (projectId: string, text: string) =>
      invoke<AiAudioResult>(IPC.aiAudio, projectId, text),
    files: (projectId: string) => invoke<AiFileEntry[]>(IPC.aiFiles, projectId)
  },
  assistant: {
    plan: (projectId: string, request: string) =>
      invoke<AssistantPlan>(IPC.assistantPlan, projectId, request),
    apply: (projectId: string, plan: AssistantPlan) =>
      invoke<AssistantApplyResult>(IPC.assistantApply, projectId, plan)
  },
  godot: {
    state: (projectId: string) => invoke<ProjectGodotState>(IPC.godotState, projectId),
    link: (projectId: string) => invoke<ProjectGodotState | null>(IPC.godotLink, projectId),
    unlink: (projectId: string) => invoke<ProjectGodotState>(IPC.godotUnlink, projectId),
    plan: (projectId: string) => invoke<GodotExportPlan>(IPC.godotPlan, projectId),
    exportProject: (projectId: string) =>
      invoke<GodotExportResult>(IPC.godotExport, projectId),
    chooseExecutable: () => invoke<GodotExecutableInfo>(IPC.godotChooseExecutable),
    checkExecutable: () => invoke<GodotExecutableInfo>(IPC.godotCheckExecutable)
  },
  events: {
    onProgress: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: ProgressEvent): void => {
        callback(payload)
      }
      ipcRenderer.on(IPC.eventProgress, listener)
      return () => {
        ipcRenderer.removeListener(IPC.eventProgress, listener)
      }
    }
  }
}

contextBridge.exposeInMainWorld('studio', api)
