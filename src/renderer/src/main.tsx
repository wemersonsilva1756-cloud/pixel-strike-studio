import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AppProvider } from './state/store'
import './styles.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Elemento raiz não encontrado na interface.')
}

// Erros que escapam do React também vão para o log local do Studio.
function report(message: string): void {
  try {
    void window.studio.diagnostics.report(message)
  } catch {
    // Sem a ponte do Electron não há onde registrar; a interface continua.
  }
}

window.addEventListener('error', (event) => {
  report(`window.error: ${event.message} (${event.filename ?? ''}:${event.lineno ?? 0})`)
})

window.addEventListener('unhandledrejection', (event) => {
  const reason =
    event.reason instanceof Error ? event.reason.stack ?? event.reason.message : String(event.reason)
  report(`promessa rejeitada: ${reason}`)
})

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>
)
