import { appendFileSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { StudioPaths } from '../../shared/contract'

/**
 * Diagnóstico e registro de falhas (etapa 10).
 *
 * O log fica em `<pasta de dados>/logs/app.log`, cresce no máximo até 1 MB e é
 * rotacionado para `app.anterior.log`. Nada é enviado para a internet: o arquivo
 * existe para você (ou para quem for ajudar) entender o que aconteceu.
 */

const MAX_LOG_BYTES = 1024 * 1024

let dataDir = ''
let appVersion = '0.0.0'

export function configureDiagnostics(options: { dataDir: string; appVersion: string }): void {
  dataDir = options.dataDir
  appVersion = options.appVersion
}

function logPath(): string {
  return join(dataDir, 'logs', 'app.log')
}

function rotateIfNeeded(): void {
  try {
    const info = statSync(logPath())
    if (info.size < MAX_LOG_BYTES) return
    const previous = join(dataDir, 'logs', 'app.anterior.log')
    const content = readFileSync(logPath(), 'utf8').slice(-MAX_LOG_BYTES / 2)
    appendFileSync(previous, content, 'utf8')
    appendFileSync(logPath(), '', 'utf8')
  } catch {
    // Arquivo ainda não existe ou não pode ser lido: nada a fazer.
  }
}

/** Grava uma linha no log local. Nunca inclui chaves nem conteúdos de projeto. */
export function logEvent(level: 'info' | 'erro', scope: string, message: string): void {
  if (!dataDir) return
  try {
    mkdirSync(join(dataDir, 'logs'), { recursive: true })
    rotateIfNeeded()
    const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${scope} · v${appVersion} · ${message.replace(/\s+/g, ' ').slice(0, 800)}\n`
    appendFileSync(logPath(), line, 'utf8')
  } catch {
    // Um erro de log nunca deve derrubar o aplicativo.
  }
}

export function logError(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  logEvent('erro', scope, message)
}

/** Lê o fim do log para mostrar na tela de configurações. */
export function readLogTail(limit = 12000): { path: string; text: string; bytes: number } {
  const path = logPath()
  try {
    const info = statSync(path)
    const content = readFileSync(path, 'utf8')
    return {
      path,
      text: content.slice(-limit),
      bytes: info.size
    }
  } catch {
    return { path, text: '', bytes: 0 }
  }
}

export function diagnosticsPaths(): Partial<StudioPaths> | null {
  if (!dataDir) return null
  return { dataDir, appVersion }
}
