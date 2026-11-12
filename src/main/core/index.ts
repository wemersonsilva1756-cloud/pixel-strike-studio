import { join } from 'node:path'
import { closeDatabase, openDatabase } from './database'
import { configureSettingsDefaults } from './settings-store'
import { configureProjects } from './projects'
import { configureGodot } from './godot'
import { configureCharacters } from './characters'
import { configureAnimations } from './animations'
import { configureMaps } from './maps'
import { configureWeapons } from './weapons'
import { configureEffects } from './effects'
import { configureSkills } from './skills'
import { configureItems } from './items'
import { configureDrops } from './drops'
import { ensureDir } from './filesystem'

export * from './database'
export * from './settings-store'
export * from './projects'
export * from './activity'
export * from './stats'
export * from './filesystem'
export * from './naming'
export * from './project-template'
export * from './file-manager'
export * from './godot'
export * from './png'
export * from './sprites'
export * from './characters'
export * from './animations'
export * from './maps'
export * from './weapons'
export * from './effects'
export * from './skills'
export * from './items'
export * from './drops'

/**
 * Inicializa o núcleo local (banco de dados + serviços).
 * Recebe os caminhos de fora para poder rodar tanto dentro do Electron quanto
 * nos testes automatizados, sem depender do módulo `electron`.
 */
export interface CoreOptions {
  dataDir: string
  dbPath: string
  workspaceRoot: string
  studioVersion: string
}

let initialized = false

export async function initializeCore(options: CoreOptions): Promise<void> {
  if (initialized) return

  const trashDir = join(options.dataDir, 'lixeira')
  ensureDir(options.dataDir)
  ensureDir(trashDir)

  await openDatabase(options.dbPath)
  configureSettingsDefaults({ workspaceRoot: options.workspaceRoot })
  configureProjects({
    dataDir: options.dataDir,
    trashDir,
    studioVersion: options.studioVersion
  })
  configureGodot({ studioVersion: options.studioVersion })
  configureCharacters({ trashDir })
  configureAnimations({ trashDir })
  configureMaps({ trashDir })
  configureWeapons({ trashDir })
  configureEffects({ trashDir })
  configureSkills({ trashDir })
  configureItems({ trashDir })
  configureDrops({ trashDir })

  initialized = true
}

export async function shutdownCore(): Promise<void> {
  await closeDatabase()
  initialized = false
}
