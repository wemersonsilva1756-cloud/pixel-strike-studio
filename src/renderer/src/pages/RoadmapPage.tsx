import { CheckCircle2, CircleDashed, Flag, ListChecks } from 'lucide-react'
import { useApp } from '../state/store'
import { Badge, Button, Card, PageHeader, ProgressBar } from '../components/ui'

interface Stage {
  number: number
  title: string
  description: string
  deliverable: string
  done?: boolean
}

const STAGES: Stage[] = [
  {
    number: 1,
    title: 'Estrutura, interface, navegação, projetos e banco de dados',
    description:
      'Aplicativo desktop funcionando, navegação lateral, banco SQLite local, criação e gerenciamento de projetos, backups, histórico e guia inicial.',
    deliverable: 'Entregue na etapa 1.',
    done: true
  },
  {
    number: 2,
    title: 'Gerenciador de arquivos e integração com Godot 4',
    description:
      'Gerenciador de arquivos dos projetos com importação sem sobrescrever, vínculo com a pasta da Godot 4, leitura de cenas, scripts e autoloads, e exportação com prévia arquivo por arquivo e backup dos substituídos.',
    deliverable:
      'Entregue nesta versão: script utilitário, manifesto de recursos e instruções vão para a Godot. Cenas e TileMaps gerados a partir dos personagens e mapas chegam junto com os geradores das etapas 3 a 8.',
    done: true
  },
  {
    number: 3,
    title: 'Gerador de personagens e monstros',
    description:
      'Gerador procedural e determinístico de sprites com fundo transparente em quatro direções, paletas ajustáveis, equipamento visível, ficha de atributos, habilidades e tabela de drops.',
    deliverable:
      'Entregue nesta versão: sprites PNG e ficha JSON salvos nas pastas personagens/ e monstros/. A descrição é interpretada por palavras-chave; a geração com IA chega na etapa 9.',
    done: true
  },
  {
    number: 4,
    title: 'Editor de sprites e animações',
    description:
      'Linha do tempo com reordenação, duplicação e exclusão de quadros, espera por quadro, FPS, loop, pré-visualização em tempo real e exportação como spritesheet.',
    deliverable:
      'Entregue nesta versão: 10 tipos de animação gerados a partir dos personagens e monstros, com PNGs, spritesheet e ficha JSON na pasta animacoes/. O corte de spritesheet externa fica para o polimento da etapa 10.',
    done: true
  },
  {
    number: 5,
    title: 'Construtor de mapas',
    description:
      'Grade e tiles, camadas, colisões, áreas seguras e PvP, spawns e propostas de mapa geradas por descrição, sempre editáveis.',
    deliverable:
      'Entregue nesta versão: pincel, borracha, colisão, áreas e spawns na grade, mapa renderizado e exportação com atlas, TileSet, TileMapLayer, colisões e cenas para a Godot 4. NPCs posicionáveis ficam para o polimento da etapa 10.',
    done: true
  },
  {
    number: 6,
    title: 'Armas, skins e equipamentos',
    description:
      'Armas base, skins com padrões e cores, raridades separadas das condições de desgaste, ícones e comparação das variações.',
    deliverable:
      'Entregue nesta versão: 9 modelos, 6 padrões, 6 raridades e 5 condições independentes, ícone em 32/64/96 px com marcas de desgaste, comparativo das raridades e ficha JSON. Efeitos de disparo e animação de recarga ficam para a etapa 7.',
    done: true
  },
  {
    number: 7,
    title: 'Skills, efeitos visuais e sonoros',
    description:
      'Habilidades descritas em linguagem natural com dano, alcance, recarga e área de efeito, além da biblioteca de efeitos e áudio.',
    deliverable:
      'Entregue nesta versão: 7 efeitos com quadros, FPS e cores, e 6 tipos de habilidade com parâmetros limitados, ícone, efeito animado e script GDScript gerado. O áudio (efeitos sonoros e músicas) fica para o polimento da etapa 10.',
    done: true
  },
  {
    number: 8,
    title: 'Drops, itens e economia',
    description:
      'Itens e equipamentos, tabelas de recompensas, caixas, calculadora de probabilidades e validação real dos 100%.',
    deliverable:
      'Entregue nesta versão: 7 categorias de item com ícone em pixel art, raridade separada dos atributos e ficha JSON; tabelas de drops exclusivas (100% validado) ou independentes com calculadora, script GDScript e planilha CSV.',
    done: true
  },
  {
    number: 9,
    title: 'Assistente de IA e provedores',
    description:
      'Central de provedores com chaves em armazenamento seguro, adaptadores independentes para imagem, texto, código e áudio, e assistente que interpreta pedidos e prepara arquivos com autorização.',
    deliverable:
      'Entregue nesta versão: chaves de OpenAI, Anthropic ou OpenRouter cifradas pelo sistema, teste real de chave, assistente que valida cada criação antes da prévia e grava só após confirmação, e geração de GDScript, imagem e voz na pasta ia/.',
    done: true
  },
  {
    number: 10,
    title: 'Testes, estabilidade e empacotamento para Windows',
    description:
      'Validações reais, testes de recursos, correções finais, instalador para Windows, sistema de atualização e documentação completa.',
    deliverable:
      'Entregue nesta versão: 297 verificações, smoke rodando também no aplicativo empacotado, log local de falhas, proteção contra tela quebrada, verificação de atualizações pelo GitHub e instalador NSIS gerado com electron-builder.',
    done: true
  }
]

export function RoadmapPage(): React.JSX.Element {
  const { navigate } = useApp()
  const done = STAGES.filter((stage) => stage.done).length
  const percent = Math.round((done / STAGES.length) * 100)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistema"
        title="Etapas do desenvolvimento"
        description="O Studio é construído por etapas. Cada etapa só começa quando a anterior está funcionando e testada — nada aqui é apenas aparência."
        actions={
          <Button variant="secondary" icon={ListChecks} onClick={() => navigate({ name: 'ajuda' })}>
            Ver tutoriais
          </Button>
        }
      />

      <Card
        title="Progresso geral"
        description={`${done} de ${STAGES.length} etapas concluídas`}
        actions={<Badge tone="accent" icon={Flag}>{percent}%</Badge>}
      >
        <ProgressBar value={percent} label="Entrega por etapa" />
      </Card>

      <ol className="space-y-3">
        {STAGES.map((stage) => (
          <li
            key={stage.number}
            className={`rounded-2xl border px-5 py-4 ${
              stage.done
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-base-800 bg-base-900/60'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl border text-xs font-semibold ${
                    stage.done
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : 'border-base-700 bg-base-850 text-ink-400'
                  }`}
                >
                  {stage.done ? <CheckCircle2 className="size-4" aria-hidden /> : stage.number}
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-ink-100">
                    Etapa {stage.number} · {stage.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-400">{stage.description}</p>
                  <p className="mt-1.5 text-[11px] text-ink-500">
                    <span className="text-ink-400">Entrega:</span> {stage.deliverable}
                  </p>
                </div>
              </div>
              <Badge
                tone={stage.done ? 'success' : 'neutral'}
                icon={stage.done ? CheckCircle2 : CircleDashed}
              >
                {stage.done ? 'Concluída' : 'Planejada'}
              </Badge>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
