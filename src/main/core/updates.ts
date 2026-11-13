import type { UpdateCheckResult, UpdateRelease } from '../../shared/updates'
import { UPDATE_REPOSITORY, compareVersions } from '../../shared/updates'

/**
 * Verificação de atualizações (etapa 10).
 *
 * Consulta a API pública de releases do GitHub — nada do seu projeto é enviado.
 * Nada é baixado nem instalado automaticamente: o resultado é só a versão, as
 * notas e o link para baixar.
 */

interface UpdateOptions {
  currentVersion: string
  /** Só para testes automatizados. */
  endpoint?: string
  repositoryUrl?: string
}

let options: UpdateOptions = { currentVersion: '0.0.0' }

export function configureUpdates(next: UpdateOptions): void {
  options = { ...options, ...next }
}

export function updatesRepositoryUrl(): string {
  return options.repositoryUrl ?? `https://github.com/${UPDATE_REPOSITORY}`
}

function parseRelease(payload: unknown): UpdateRelease | null {
  if (!payload || typeof payload !== 'object') return null
  const data = payload as Record<string, unknown>
  const tag = typeof data['tag_name'] === 'string' ? data['tag_name'] : ''
  if (!tag) return null

  const assets = Array.isArray(data['assets']) ? data['assets'] : []
  const installer = assets
    .map((asset) => (asset && typeof asset === 'object' ? (asset as Record<string, unknown>) : {}))
    .find((asset) => {
      const name = typeof asset['name'] === 'string' ? asset['name'].toLowerCase() : ''
      return name.endsWith('.exe') || name.endsWith('.msi')
    })

  return {
    version: tag.trim().replace(/^v/i, ''),
    name: typeof data['name'] === 'string' && data['name'].trim() ? data['name'].trim() : tag,
    notes: typeof data['body'] === 'string' ? data['body'].slice(0, 4000) : '',
    pageUrl: typeof data['html_url'] === 'string' ? data['html_url'] : updatesRepositoryUrl(),
    assetUrl:
      installer && typeof installer['browser_download_url'] === 'string'
        ? installer['browser_download_url']
        : null,
    assetName:
      installer && typeof installer['name'] === 'string' ? installer['name'] : null,
    publishedAt: typeof data['published_at'] === 'string' ? data['published_at'] : null
  }
}

/** Consulta a última versão publicada e compara com a instalada. */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = options.currentVersion
  const endpoint =
    options.endpoint ?? `https://api.github.com/repos/${UPDATE_REPOSITORY}/releases/latest`
  const checkedAt = new Date().toISOString()
  const releasesPageUrl = `${updatesRepositoryUrl()}/releases`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)

  try {
    const response = await fetch(endpoint, {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'Pixel-Strike-Studio'
      },
      signal: controller.signal
    })

    if (response.status === 404) {
      return {
        status: 'sem-publicacao',
        currentVersion,
        releasesPageUrl,
        latest: null,
        message:
          'Nenhuma versão publicada foi encontrada sem login. Se o repositório for privado, a consulta pública não enxerga as Releases — abra a página de Releases para baixar o instalador.',
        checkedAt
      }
    }

    if (!response.ok) {
      return {
        status: 'erro',
        currentVersion,
        releasesPageUrl,
        latest: null,
        message:
          response.status === 403
            ? 'O GitHub limitou as consultas agora. Tente novamente em alguns minutos.'
            : `O GitHub respondeu HTTP ${response.status}. Tente novamente mais tarde.`,
        checkedAt
      }
    }

    const release = parseRelease(await response.json())
    if (!release) {
      return {
        status: 'erro',
        currentVersion,
        releasesPageUrl,
        latest: null,
        message: 'O GitHub devolveu uma resposta inesperada para a versão publicada.',
        checkedAt
      }
    }

    const comparison = compareVersions(release.version, currentVersion)
    if (comparison > 0) {
      return {
        status: 'disponivel',
        currentVersion,
        releasesPageUrl,
        latest: release,
        message: `A versão ${release.version} está disponível (você está na ${currentVersion}).`,
        checkedAt
      }
    }

    return {
              status: 'atualizado',
        currentVersion,
        releasesPageUrl,
      latest: release,
      message: `Você está na versão mais recente (${currentVersion}).`,
      checkedAt
    }
  } catch (error) {
    return {
      status: 'erro',
      currentVersion,
      releasesPageUrl,
      latest: null,
      message:
        error instanceof Error && error.name === 'AbortError'
          ? 'A consulta demorou mais de 20 segundos. Confira a conexão.'
          : 'Não foi possível consultar o GitHub. Confira a conexão e tente novamente.',
      checkedAt
    }
  } finally {
    clearTimeout(timer)
  }
}
