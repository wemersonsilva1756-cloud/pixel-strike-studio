import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Proteção contra falhas de renderização (etapa 10).
 *
 * Se uma tela quebrar, o aplicativo inteiro não cai: aparece uma mensagem
 * simples, o erro vai para o log local e é possível recarregar a interface.
 */

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    try {
      void window.studio.diagnostics.report(
        `interface: ${error.message}\n${info.componentStack ?? ''}`
      )
    } catch {
      // A ponte pode não estar disponível se a falha for muito cedo.
    }
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children

    return (
      <div className="grid min-h-screen place-items-center bg-base-950 px-6 text-ink-100">
        <div className="w-full max-w-lg space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertTriangle className="size-5" aria-hidden />
            <h1 className="text-lg font-semibold">Esta tela encontrou um problema</h1>
          </div>
          <p className="text-sm leading-relaxed text-ink-300">
            Nada do seu projeto foi perdido: os arquivos continuam na pasta de projetos e os
            backups estão intactos. O erro foi registrado no log local do Studio.
          </p>
          <pre className="max-h-40 overflow-auto rounded-xl border border-base-800 bg-base-950/80 p-3 text-[11px] leading-relaxed text-ink-400">
            {this.state.error.message}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-xl border border-accent-500/50 bg-accent-500/20 px-3.5 py-2 text-sm text-white transition-colors hover:bg-accent-500/30"
            >
              <RotateCcw className="size-4" aria-hidden />
              Recarregar a interface
            </button>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded-xl border border-base-700 px-3.5 py-2 text-sm text-ink-300 transition-colors hover:border-base-600 hover:text-ink-100"
            >
              Tentar de novo
            </button>
          </div>
        </div>
      </div>
    )
  }
}
