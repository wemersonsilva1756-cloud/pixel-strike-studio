import {
  ClipboardList,
  Database,
  Download,
  FileText,
  FolderOpen,
  GraduationCap,
  HardDriveDownload,
  Info,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal
} from 'lucide-react'
import { useState } from 'react'
import type { UpdateCheckResult } from '@shared/updates'
import { useApp } from '../state/store'
import { Badge, Button, Card, Note, PageHeader } from '../components/ui'

const BACKUP_OPTIONS = [5, 10, 20, 50]

export function SettingsPage(): React.JSX.Element {
  const { settings, paths, chooseWorkspace, updateSettings, resetOnboarding, notify } = useApp()
  const [checking, setChecking] = useState(false)
  const [update, setUpdate] = useState<UpdateCheckResult | null>(null)
  const [logs, setLogs] = useState<{ path: string; text: string; bytes: number } | null>(null)

  async function openDataFolder(): Promise<void> {
    try {
      await window.studio.app.openDataFolder()
    } catch (error) {
      notify(
        'erro',
        'Não foi possível abrir a pasta',
        error instanceof Error ? error.message : undefined
      )
    }
  }

  async function checkUpdates(): Promise<void> {
    setChecking(true)
    try {
      const result = await window.studio.updates.check()
      setUpdate(result)
      if (result.status === 'disponivel') {
        notify('info', 'Atualização disponível', result.message)
      } else if (result.status === 'atualizado') {
        notify('sucesso', 'Você está atualizado', result.message)
      } else {
        notify('info', 'Verificação concluída', result.message)
      }
    } catch (error) {
      notify(
        'erro',
        'Não foi possível verificar atualizações',
        error instanceof Error ? error.message : undefined
      )
    } finally {
      setChecking(false)
    }
  }

  async function openRelease(url: string): Promise<void> {
    try {
      await window.studio.updates.openPage(url)
    } catch (error) {
      notify('erro', 'Não foi possível abrir o link', error instanceof Error ? error.message : undefined)
    }
  }

  async function loadLogs(): Promise<void> {
    try {
      setLogs(await window.studio.diagnostics.logs())
    } catch (error) {
      notify('erro', 'Não foi possível ler o log', error instanceof Error ? error.message : undefined)
    }
  }

  async function openLogs(): Promise<void> {
    try {
      await window.studio.diagnostics.openLogsFolder()
    } catch (error) {
      notify('erro', 'Não foi possível abrir a pasta', error instanceof Error ? error.message : undefined)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        description="Preferências gerais do Studio. Tudo é salvo imediatamente no banco de dados local."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          title="Pasta dos projetos"
          description="Onde novos projetos são criados."
          actions={<Badge tone="accent" icon={FolderOpen}>Local</Badge>}
        >
          <div className="space-y-3">
            <p className="rounded-xl border border-base-800 bg-base-950/50 px-3 py-2.5 font-mono text-xs break-all text-ink-100">
              {settings?.workspaceRoot ?? '—'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={FolderOpen} onClick={() => void chooseWorkspace()}>
                Alterar pasta
              </Button>
            </div>
            <Note>
              Alterar esta pasta não move projetos existentes. Eles continuam funcionando e aparecem
              na lista normalmente.
            </Note>
          </div>
        </Card>

        <Card
          title="Backups automáticos"
          description="Quantos backups automáticos e de segurança o Studio mantém por projeto."
          actions={<Badge icon={HardDriveDownload}>Retenção</Badge>}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {BACKUP_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => void updateSettings({ maxBackups: option })}
                  className={`rounded-xl border px-3.5 py-2 text-sm transition-colors ${
                    settings?.maxBackups === option
                      ? 'border-accent-500/50 bg-accent-500/15 text-white'
                      : 'border-base-700 bg-base-850 text-ink-300 hover:border-base-600 hover:text-ink-100'
                  }`}
                >
                  {option} por projeto
                </button>
              ))}
            </div>
            <Note tone="warning">
              Backups criados manualmente nunca são reciclados. O limite vale apenas para os backups
              automáticos e de segurança. Os excedentes vão para a lixeira interna, não são apagados.
            </Note>
          </div>
        </Card>

        <Card
          title="Dados do aplicativo"
          description="Onde ficam o banco de dados e os arquivos internos."
          actions={<Badge icon={Database}>SQLite local</Badge>}
        >
          <dl className="space-y-2 text-xs">
            <div>
              <dt className="text-ink-500">Banco de dados</dt>
              <dd className="font-mono break-all text-ink-200">{paths?.dbPath ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Pasta de dados</dt>
              <dd className="font-mono break-all text-ink-200">{paths?.dataDir ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Backups guardados em</dt>
              <dd className="font-mono break-all text-ink-200">{paths?.backupsDir ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Lixeira interna</dt>
              <dd className="font-mono break-all text-ink-200">
                {paths ? `${paths.dataDir}\\lixeira` : '—'}
              </dd>
            </div>
          </dl>
          <div className="mt-3">
            <Button variant="secondary" icon={FolderOpen} onClick={() => void openDataFolder()}>
              Abrir pasta de dados
            </Button>
          </div>
        </Card>

        <Card
          title="Aparência e acessibilidade"
          description="O Studio usa tema escuro fixo para não cansar a vista durante o trabalho."
          actions={<Badge icon={SlidersHorizontal}>Tema escuro</Badge>}
        >
          <ul className="space-y-2 text-xs leading-relaxed text-ink-300">
            <li>· Tema escuro com detalhes em azul, otimizado para sessões longas.</li>
            <li>· Todos os botões têm texto explicativo e atalhos visíveis.</li>
            <li>· Notificações informam o resultado de cada operação.</li>
            <li>· Nenhuma ação destrutiva acontece sem confirmação.</li>
          </ul>
        </Card>

        <Card
          title="Guia inicial"
          description="O tour de boas-vindas mostra onde ficam as coisas."
          actions={<Badge icon={GraduationCap}>Para iniciantes</Badge>}
        >
          <p className="text-xs leading-relaxed text-ink-300">
            Você pode rever o guia quantas vezes quiser. Ele explica como criar projetos, onde os
            arquivos ficam e como os backups funcionam.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" icon={GraduationCap} onClick={() => void resetOnboarding()}>
              Mostrar guia inicial novamente
            </Button>
          </div>
        </Card>

        <Card
          title="Atualizações"
          description="Consulta as versões publicadas do Studio no GitHub. Nada é baixado automaticamente."
          actions={<Badge icon={RefreshCw}>GitHub Releases</Badge>}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" icon={RefreshCw} loading={checking} onClick={() => void checkUpdates()}>
                Verificar atualizações
              </Button>
              <Badge tone="neutral">v{paths?.appVersion ?? '0.9.0'}</Badge>
            </div>

            {update ? (
              <div className="space-y-2 rounded-xl border border-base-800 bg-base-950/50 p-3">
                <p className="text-xs text-ink-200">{update.message}</p>
                {update.latest?.notes ? (
                  <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-base-800 bg-base-950 p-2 text-[11px] leading-relaxed text-ink-400">
                    {update.latest.notes}
                  </pre>
                ) : null}
                {update.status === 'disponivel' && update.latest ? (
                  <Button
                    size="sm"
                    icon={Download}
                    onClick={() =>
                      void openRelease(update.latest?.assetUrl ?? update.latest?.pageUrl ?? '')
                    }
                  >
                    Abrir página de download
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-[11px] text-ink-500">
                A verificação é opcional e não envia nada do seu projeto — só consulta a lista de
                versões públicas do repositório.
              </p>
            )}
          </div>
        </Card>

        <Card
          title="Logs e diagnóstico"
          description="O Studio registra falhas em um arquivo local para facilitar o suporte."
          actions={<Badge icon={FileText}>Local</Badge>}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={ClipboardList} onClick={() => void loadLogs()}>
                Ver últimas linhas
              </Button>
              <Button variant="ghost" icon={FolderOpen} onClick={() => void openLogs()}>
                Abrir pasta de logs
              </Button>
            </div>
            {logs ? (
              <div className="space-y-1">
                <p className="font-mono text-[11px] break-all text-ink-500">{logs.path}</p>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-base-800 bg-base-950 p-2 text-[11px] leading-relaxed text-ink-300">
                  {logs.text || 'O log está vazio: nenhuma falha registrada.'}
                </pre>
              </div>
            ) : null}
            <Note>
              O log guarda apenas mensagens de erro do aplicativo, versão e horário. Nenhuma chave de
              IA, texto de projeto ou conteúdo de arquivo é registrado.
            </Note>
          </div>
        </Card>

        <Card
          title="Sobre esta versão"
          description="Informações técnicas do aplicativo."
          actions={<Badge icon={Info}>v{paths?.appVersion ?? '0.1.0'}</Badge>}
        >
          <ul className="space-y-1.5 text-xs leading-relaxed text-ink-300">
            <li>· Electron, React e TypeScript com interface em português do Brasil.</li>
            <li>· Banco de dados SQLite local, sem servidor e sem envio de dados.</li>
            <li>
              · Comunicação entre interface e sistema isolada: a interface não tem acesso direto ao
              disco ou ao Node.
            </li>
            <li>
              · Etapas 1 a 9 concluídas: projetos, Godot, personagens, animações, mapas, armas,
              efeitos, habilidades, itens, drops e central de IA.
            </li>
            <li>· Etapa 10: revisão de estabilidade, log local, atualizações e instalador.</li>
          </ul>
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
            <p className="text-xs leading-relaxed text-ink-300">
              Nenhum recurso deste aplicativo envia seus arquivos ou projetos para a internet.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
