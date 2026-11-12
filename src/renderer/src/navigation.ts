import {
  Bot,
  Boxes,
  Crosshair,
  Dices,
  Film,
  FolderKanban,
  FolderTree,
  HelpCircle,
  LayoutDashboard,
  Map,
  Package,
  Route as RouteIcon,
  Settings,
  Skull,
  Sparkles,
  UserRound,
  Zap,
  type LucideIcon
} from 'lucide-react'

export type Route =
  | { name: 'painel' }
  | { name: 'projetos' }
  | { name: 'arquivos' }
  | { name: 'projeto'; projectId: string }
  | { name: 'modulo'; moduleId: string }
  | { name: 'configuracoes' }
  | { name: 'ajuda' }
  | { name: 'roadmap' }

export type StaticRouteName =
  | 'painel'
  | 'projetos'
  | 'arquivos'
  | 'configuracoes'
  | 'ajuda'
  | 'roadmap'

export const ROUTE_LABELS: Record<StaticRouteName, string> = {
  painel: 'Painel',
  projetos: 'Projetos',
  arquivos: 'Arquivos do projeto',
  configuracoes: 'Configurações',
  ajuda: 'Ajuda e tutoriais',
  roadmap: 'Etapas do desenvolvimento'
}

export interface ModuleDefinition {
  id: string
  title: string
  stage: number
  icon: LucideIcon
  summary: string
  planned: string[]
  /** Verdadeiro quando o módulo já está implementado e testado. */
  available?: boolean
}

/**
 * Módulos de criação. Todos aparecem no menu desde já para o usuário acompanhar
 * o plano, mas cada um informa com honestidade em qual etapa será entregue.
 */
export const MODULES: ModuleDefinition[] = [
  {
    id: 'assistente',
    title: 'Assistente de IA',
    stage: 9,
    icon: Bot,
    summary:
      'Central de provedores com chaves guardadas pela criptografia do sistema, assistente que prepara criações com prévia e confirmação, e geração real de código, imagem e voz.',
    planned: [
      'Chave de cada provedor salva cifrada pelo sistema, nunca visível na interface',
      'Teste real de chave com uma chamada ao provedor',
      'Assistente que transforma um pedido em plano de itens, drops, efeitos, habilidades e skins',
      'Prévia do plano e criação somente após confirmação',
      'Geração de script GDScript, imagem e áudio salva dentro do projeto'
    ]
  },
  {
    id: 'godot',
    title: 'Integração com Godot 4',
    stage: 2,
    icon: Boxes,
    available: true,
    summary:
      'Vincular a pasta do seu projeto Godot 4, identificar a versão, listar as cenas e recursos e exportar a preparação do Pixel Strike com prévia e backup.',
    planned: [
      'Selecionar a pasta do projeto Godot e identificar a versão',
      'Listar cenas, scripts, imagens e recursos do projeto',
      'Exportar o script utilitário, o manifesto de recursos e as instruções',
      'Copiar os arquivos da pasta godot/ do projeto para dentro da Godot',
      'Pré-visualizar cada arquivo antes de gravar, com backup dos substituídos'
    ]
  },
  {
    id: 'personagens',
    title: 'Gerador de Personagens',
    stage: 3,
    icon: UserRound,
    available: true,
    summary:
      'Crie soldados, NPCs e vendedores com sprites transparentes em quatro direções, paletas ajustáveis e ficha de atributos salva no projeto.',
    planned: [
      'Sprites 32, 64 ou 96 px com fundo transparente e contorno automático',
      'Quatro direções: frente, costas, esquerda e direita',
      'Paletas prontas e edição de cada cor',
      'Equipamento visível: fuzil, pistola, espada ou escudo',
      'Ficha de atributos em JSON salva na pasta personagens/' 
    ]
  },
  {
    id: 'monstros',
    title: 'Monstros e Inimigos',
    stage: 3,
    icon: Skull,
    available: true,
    summary:
      'Crie inimigos comuns, especiais, raros e chefes com quatro arquétipos, atributos, habilidades e tabela de drops.',
    planned: [
      'Arquétipos humanoide, quadrúpede, gosma e voador',
      'Papéis de inimigo comum, especial, raro e chefe',
      'Vida, dano, velocidade e alcance configuráveis',
      'Habilidades e tabela de drops com chances independentes',
      'Ficha completa salva na pasta monstros/' 
    ]
  },
  {
    id: 'animacoes',
    title: 'Editor de Animações',
    stage: 4,
    icon: Film,
    available: true,
    summary:
      'Montar animações a partir dos personagens do projeto com linha do tempo, espera por quadro, FPS, loop, spritesheet e ficha JSON.',
    planned: [
      'Animações padrão: idle, walk, run, attack, shoot, reload, death, hit, heal e skill',
      'Reordenar, duplicar e excluir quadros na linha do tempo',
      'Configurar FPS, duração, espera por quadro e repetição',
      'Pré-visualização em tempo real com reprodução automática',
      'Spritesheet horizontal e ficha JSON salvas na pasta animacoes/ do projeto'
    ]
  },
  {
    id: 'mapas',
    title: 'Construtor de Mapas',
    stage: 5,
    icon: Map,
    available: true,
    summary:
      'Pinte o terreno, marque colisões, desenhe áreas seguras, PvP, inimigos, objetivo e secreta, posicione spawns e exporte TileSet, TileMap e cena para a Godot 4.',
    planned: [
      'Grade e tiles configuráveis, pintura de terreno com arrastar',
      'Camada de colisão editável célula por célula',
      'Áreas seguras, PvP, inimigos, objetivo e secretas desenhadas como retângulos',
      'Proposta de mapa gerada por descrição, sempre editável',
      'TileSet, TileMapLayer, colisões e spawns gerados para a Godot 4'
    ]
  },
  {
    id: 'armas',
    title: 'Armas e Skins',
    stage: 6,
    icon: Crosshair,
    available: true,
    summary:
      'Editor de skins em pixel art sobre 9 modelos base, com padrões, cores, raridade separada da condição de desgaste e comparação lado a lado das raridades.',
    planned: [
      'Modelos base: AK-47, M4A4, AWP, Desert Eagle, Glock-18, USP-S, MP5-SD, P90 e faca',
      'Skins com duas cores e seis padrões (sólido, listras, camuflado, digital, gradiente e chamas)',
      'Raridade (azul, roxo, rosa, vermelho, dourado e Blue Gem) separada da condição de desgaste',
      'Ícone em 32, 64 ou 96 px com marcas de desgaste conforme o float',
      'Comparação das seis raridades lado a lado e ficha JSON exportada para a Godot'
    ]
  },
  {
    id: 'habilidades',
    title: 'Skills e Habilidades',
    stage: 7,
    icon: Sparkles,
    available: true,
    summary:
      'Crie habilidades com dano, alcance, raio, duração, recarga, custo e velocidade, efeito visual animado e script GDScript pronto para a Godot 4.',
    planned: [
      'Dano, alcance, duração, recarga e área de efeito',
      'Granadas, fumaça, explosões, cura, escudos e habilidades táticas',
      'Efeitos visuais e partículas associados',
      'Pré-visualização e ajuste visual dos parâmetros',
      'Geração de script de integração para Godot 4'
    ]
  },
  {
    id: 'efeitos',
    title: 'Efeitos Visuais e Sonoros',
    stage: 7,
    icon: Zap,
    available: true,
    summary:
      'Biblioteca de efeitos com explosão, fumaça, fogo, impacto, sangue estilizado, cura e faísca: quadros, FPS, cores, spritesheet e ficha JSON.',
    planned: [
      'Biblioteca de efeitos por categoria',
      'Edição de quadros, cores e tempo de vida',
      'Efeitos de habilidades reaproveitáveis',
      'Integração com provedores de áudio quando configurados'
    ]
  },
  {
    id: 'itens',
    title: 'Itens e Equipamentos',
    stage: 8,
    icon: Package,
    available: true,
    summary:
      'Crie coletes, capacetes, mochilas, seringas, kits médicos, chaves e itens especiais com ícone em pixel art, raridade, atributos e ficha JSON exportada para a Godot.',
    planned: [
      'Ícones e sprites gerados',
      'Nome, descrição, raridade, valor e propriedades',
      'Categorias de itens e equipamentos',
      'Vínculo com o sistema de drops'
    ]
  },
  {
    id: 'drops',
    title: 'Drops e Economia',
    stage: 8,
    icon: Dices,
    available: true,
    summary:
      'Monte tabelas de recompensa com chances exclusivas validadas em 100% ou independentes, calculadora de chances e script GDScript gerado.',
    planned: [
      'Tabelas de drops por monstro, caixa e missão',
      'Probabilidades exclusivas validadas em 100%',
      'Probabilidades independentes quando configuradas assim',
      'Calculadora de chances',
      'Raridade, condição e padrão de skin sempre separados'
    ]
  }
]

export interface NavItem {
  label: string
  route: Route
  icon: LucideIcon
  badge?: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Estúdio',
    items: [
      { label: 'Painel', route: { name: 'painel' }, icon: LayoutDashboard },
      { label: 'Projetos', route: { name: 'projetos' }, icon: FolderKanban },
      { label: 'Arquivos do projeto', route: { name: 'arquivos' }, icon: FolderTree }
    ]
  },
  {
    label: 'Criação',
    items: MODULES.map((module) => ({
      label: module.title,
      route: { name: 'modulo', moduleId: module.id } as Route,
      icon: module.icon,
      badge: module.available ? undefined : `Etapa ${module.stage}`
    }))
  },
  {
    label: 'Sistema',
    items: [
      { label: 'Configurações', route: { name: 'configuracoes' }, icon: Settings },
      { label: 'Ajuda e tutoriais', route: { name: 'ajuda' }, icon: HelpCircle },
      { label: 'Etapas do desenvolvimento', route: { name: 'roadmap' }, icon: RouteIcon }
    ]
  }
]

export function moduleById(id: string): ModuleDefinition | undefined {
  return MODULES.find((module) => module.id === id)
}
