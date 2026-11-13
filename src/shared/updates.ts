/**
 * Atualizações (etapa 10).
 *
 * O Studio consulta as versões publicadas do próprio repositório no GitHub e
 * compara com a versão instalada. Ele **não baixa nem instala nada sozinho**:
 * mostra a versão nova, as notas e o link para você baixar quando quiser.
 */

export interface UpdateRelease {
  version: string
  name: string
  notes: string
  pageUrl: string
  assetUrl: string | null
  assetName: string | null
  publishedAt: string | null
}

export type UpdateStatus = 'atualizado' | 'disponivel' | 'sem-publicacao' | 'erro'

export interface UpdateCheckResult {
  status: UpdateStatus
  currentVersion: string
  latest: UpdateRelease | null
  message: string
  checkedAt: string
  /** Página de Releases, sempre disponível para abrir manualmente. */
  releasesPageUrl: string
}

export const UPDATE_REPOSITORY = 'wemersonsilva1756-cloud/pixel-strike-studio'

/** Compara duas versões no formato 1.2.3 (aceita prefixo `v` e sufixo -beta). */
export function compareVersions(a: string, b: string): number {
  const normalize = (value: string): number[] => {
    const clean = value.trim().replace(/^v/i, '').split('-')[0] ?? ''
    return clean.split('.').map((part) => {
      const numeric = Number.parseInt(part.replace(/[^\d]/g, ''), 10)
      return Number.isFinite(numeric) ? numeric : 0
    })
  }

  const left = normalize(a)
  const right = normalize(b)
  const length = Math.max(left.length, right.length)

  for (let index = 0; index < length; index += 1) {
    const first = left[index] ?? 0
    const second = right[index] ?? 0
    if (first > second) return 1
    if (first < second) return -1
  }
  return 0
}
