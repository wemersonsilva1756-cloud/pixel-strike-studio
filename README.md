# Pixel Strike Studio

Plataforma desktop para criação de jogos 2D em pixel art, com editores visuais e
assistência de inteligência artificial. Interface em português do Brasil, pensada
para quem está começando.

> **Versão 1.0.0 — as 10 etapas concluídas e testadas.**
> Nesta versão o Studio gerencia projetos, arquivos, banco de dados local, backups,
> integra a Godot 4, gera **personagens e monstros em pixel art** com sprites
> transparentes e ficha JSON, monta **animações com linha do tempo, FPS e
> spritesheet**, desenha **mapas com tiles, colisão, áreas e spawns** e cria
> **skins de armas** em pixel art com raridade separada da condição de desgaste,
> gera **efeitos visuais animados** e **habilidades** com parâmetros e script para
> a Godot 4, cria **itens e equipamentos** com atributos e monta **tabelas de drops**
> com validação real de 100%. A **central de IA** usa a sua própria chave (cifrada
> pelo sistema operacional), conversa com OpenAI, Anthropic ou OpenRouter de
> verdade e o **assistente** prepara criações com prévia antes de gravar.
>
> O gerador da etapa 3 é **procedural e determinístico**, não é IA: a descrição é
> interpretada por palavras-chave. Os provedores de IA chegam na etapa 9.

---

## O que já funciona

| Recurso | Situação |
| --- | --- |
| Aplicativo desktop (Electron + React + TypeScript) | Funcionando |
| Interface em tema escuro com navegação lateral | Funcionando |
| Guia inicial para iniciantes | Funcionando |
| Criar, abrir, renomear, duplicar e remover projetos | Funcionando |
| Estrutura de pastas organizada por tipo de recurso | Funcionando |
| Navegar, pré-visualizar e importar arquivos do projeto | Funcionando |
| Importar sem sobrescrever (arquivos repetidos ganham sufixo) | Funcionando |
| Vincular projeto Godot 4, ler versão, cenas, scripts e autoloads | Funcionando |
| Gerar personagens com sprites transparentes em 4 direções | Funcionando |
| Gerar monstros (humanoide, quadrúpede, gosma, voador) e chefes | Funcionando |
| Ficha JSON com atributos, habilidades e drops | Funcionando |
| Montar animações em 10 tipos (idle, andar, correr, atacar, morrer...) | Funcionando |
| Linha do tempo com reordenar, duplicar, excluir e espera por quadro | Funcionando |
| FPS, repetição e pré-visualização em tempo real | Funcionando |
| Spritesheet horizontal e ficha JSON por animação | Funcionando |
| Desenhar mapas com pincel, borracha e camada de colisão | Funcionando |
| Áreas segura, PvP, inimigos, objetivo e secreta desenhadas na grade | Funcionando |
| Spawns de jogador, inimigo e item posicionados no mapa | Funcionando |
| Proposta de mapa gerada pela descrição, sempre editável | Funcionando |
| TileSet, TileMapLayer, colisões e spawns gerados para a Godot 4 | Funcionando |
| Skins em pixel art sobre 9 modelos de arma | Funcionando |
| Raridade separada da condição de desgaste (float) | Funcionando |
| Comparação das seis raridades lado a lado | Funcionando |
| Biblioteca de efeitos (explosão, fumaça, fogo, impacto, sangue, cura, faísca) | Funcionando |
| Efeitos com quadros, FPS, cores e spritesheet | Funcionando |
| Habilidades com dano, alcance, raio, duração, recarga e custo | Funcionando |
| Script GDScript de habilidade gerado automaticamente | Funcionando |
| Itens e equipamentos em 7 categorias com ícone e atributos | Funcionando |
| Tabelas de drops exclusivas validadas em 100% ou independentes | Funcionando |
| Calculadora de chances e quantidade esperada de itens | Funcionando |
| Script GDScript de sorteio e planilha CSV de cada tabela | Funcionando |
| Central de IA com chave cifrada pelo sistema (OpenAI, Anthropic, OpenRouter) | Funcionando |
| Teste real da chave e do modelo escolhido | Funcionando |
| Assistente que prepara plano de criações com prévia e confirmação | Funcionando |
| Geração de GDScript, imagem e voz salva na pasta `ia/` do projeto | Funcionando |
| Exportar para a Godot com prévia e backup dos substituídos | Funcionando |
| Banco de dados local SQLite | Funcionando |
| Backups completos com restauração | Funcionando |
| Backup de segurança automático antes de restaurar | Funcionando |
| Histórico de ações | Funcionando |
| Preferências (pasta de projetos, retenção de backups) | Funcionando |
| Tutoriais e glossário em português | Funcionando |
| Exportar cenas geradas pelos módulos restantes | Junto com a etapa 10 |
| Instalador Windows (NSIS) gerado com electron-builder | Funcionando |
| Verificação de atualizações pelo GitHub Releases | Funcionando |
| Log local de falhas e proteção contra tela quebrada | Funcionando |

A tela **Etapas do desenvolvimento** (no menu lateral) mostra o plano completo e o
que está concluído.

---

## Como abrir o Studio

### Opção 1 — atalho pronto (mais simples)

Clique duas vezes em **`abrir-studio.cmd`** na pasta do projeto. O script:

1. usa o Node.js portátil da pasta `.tools/node` quando ele existe;
2. instala as dependências na primeira execução;
3. compila o aplicativo se necessário;
4. abre o Pixel Strike Studio.

### Opção 2 — comandos

```bash
npm install       # apenas na primeira vez
npm run dev       # modo desenvolvimento (recarrega a interface sozinho)
npm run build     # gera a versão compilada em out/
npm start         # abre a versão compilada
```

### Requisitos

- Windows 10 ou 11 (o código também roda em Linux e macOS).
- Node.js 22 ou superior **para compilar**. O aplicativo já compilado não precisa de
  Node para abrir.
- Nenhuma conta, nenhuma conexão com a internet e nenhuma chave de API são
  necessárias para usar a Etapa 1.

> Nesta máquina o Node não estava instalado, então foi baixada uma versão portátil
> em `.tools/node` (não altera o sistema). Para instalar oficialmente, use o
> instalador LTS de <https://nodejs.org>.

---

## Primeiros passos (para quem nunca programou)

1. Ao abrir pela primeira vez, siga o **guia inicial** (três passos).
2. Escolha onde os projetos serão salvos. O padrão é
   `Documentos\Pixel Strike Studio\Projetos`.
3. Crie o primeiro projeto — por exemplo `Pixel Strike`.
4. Abra o projeto no menu **Projetos**. Dentro dele já existem as pastas
   `personagens`, `monstros`, `armas`, `itens`, `efeitos`, `mapas`, `animacoes`,
   `audio`, `godot`, `originais` e `gerados`.
5. Antes de mudanças grandes, clique em **Backup**. Se algo der errado, use
   **Histórico → Restaurar**.
6. Leia **Ajuda e tutoriais** para entender sprites, quadros, tiles e colisões em
   linguagem simples.

### Gerador de personagens e monstros

Menu **Gerador de Personagens** ou **Monstros e Inimigos**. Passo a passo:

1. Dê um **nome** (ele vira o nome da pasta) e escreva uma **descrição**.
2. Clique em **Interpretar descrição** — palavras como `deserto`, `neve`, `neon`,
   `lobo`, `morcego`, `gosma`, `chefe`, `raro`, `fuzil`, `espada` escolhem paleta,
   arquétipo, papel e equipamento.
3. Ajuste o que quiser: papel, arquétipo, tamanho (32, 64 ou 96 px), paleta,
   cada cor, direções e semente.
4. Preencha vida, dano, velocidade e alcance. Nos monstros, adicione habilidades e
   drops (chance de 0 a 100 por item).
5. Use **Gerar variação** para sortear outra semente e **Salvar no projeto**.

O Studio grava tudo em `personagens/<nome>/` ou `monstros/<nome>/`:

```
soldado-alfa/
  soldado-alfa_frente.png
  soldado-alfa_costas.png
  soldado-alfa_esquerda.png
  soldado-alfa_direita.png
  soldado-alfa.json
```

Os PNGs têm fundo transparente e tamanho exato de 32, 64 ou 96 px. A ficha JSON traz
atributos, habilidades, drops, paleta e semente — o mesmo **soldado-alfa.json** que a
exportação para a Godot enxerga e copia para o lado da engine.

### Editor de animações

Menu **Editor de Animações**. Passo a passo:

1. Escolha o **personagem base** (personagens e monstros já salvos aparecem na lista).
2. Escolha o **tipo**: parado, andando, correndo, ataque, tiro, recarregar, morte,
   dano recebido, cura ou habilidade. Cada tipo já vem com FPS, número de quadros e
   repetição sugeridos.
3. Escolha a **direção**. A pré-visualização reproduz sozinha em tempo real.
4. Na **linha do tempo**, use as setas para reordenar, o ícone de cópia para duplicar e
   a lixeira para excluir. O campo numérico é a **espera** do quadro em batidas
   (1 batida = 1 ÷ FPS).
5. Clique em **Salvar animação**.

O Studio grava em `animacoes/<nome>/`:

```
soldado-alfa-andando/
  soldado-alfa-andando_01.png ... _06.png
  soldado-alfa-andando_sheet.png   ← todos os quadros lado a lado
  soldado-alfa-andando.json        ← tipo, FPS, repetição, espera e colunas
```

Nada aqui é simulado: os quadros são desenhados pelo mesmo motor procedural dos
sprites, com poses diferentes por tipo de animação. A importação de uma spritesheet
externa ainda **não** existe — está prevista para a etapa 10, junto do polimento.

### Construtor de mapas

Menu **Construtor de Mapas**. Passo a passo:

1. Escreva o **nome** e uma **descrição** (por exemplo, “arena militar abandonada
   com pátio central”). A descrição escolhe o tema e orienta a proposta.
2. Ajuste **largura, altura, tamanho do tile e semente** e clique em **Gerar
   proposta**. O mapa é gerado na hora e fica totalmente editável.
3. Escolha a ferramenta e trabalhe na grade:
   - **Pincel**: pinta o tile selecionado (arraste para pintar vários).
   - **Borracha**: apaga o tile e libera a colisão.
   - **Colisão**: liga/desliga o bloqueio da célula.
   - **Zona**: clique e arraste para desenhar uma área (segura, PvP, inimigos,
     objetivo ou secreta).
   - **Spawn**: clique para posicionar jogador, inimigo ou item.
4. Acompanhe a **imagem renderizada** e o **atlas de tiles** — é exatamente o que a
   Godot recebe.
5. Clique em **Salvar no projeto**.

Cada mapa grava em `mapas/<nome>/`:

```
arena-do-deserto/
  mapa.png                            ← mapa inteiro renderizado
  tileset.png                         ← atlas com um tile de cada tipo
  mapa.json                           ← grade, colisão, áreas, spawns e tamanho
  arena-do-deserto.gd                 ← monta TileMapLayer, colisões, áreas e spawns
  arena-do-deserto.tscn               ← cena pronta para abrir na Godot
```

Nada disso é simulado: a imagem é desenhada pelo mesmo motor do Studio e o script
extrai do `mapa.json` os mesmos dados que você vê na tela. O que ainda **não**
existe é importar um mapa de fora ou pintar com uma imagem de tileset própria.

### Editor de armas e skins

Menu **Armas e Skins**. Passo a passo:

1. Escolha o **modelo** (AK-47, M4A4, AWP, Desert Eagle, Glock-18, USP-S, MP5-SD, P90
   ou faca) e o **tamanho** do ícone (32, 64 ou 96 px).
2. Escolha a **raridade**: azul, roxo, rosa, vermelho, dourado ou Blue Gem.
3. Escolha a **condição de desgaste** ou arraste o **float** de 0 a 1. A condição
   muda só as marcas na pintura; a raridade muda só a faixa colorida e a etiqueta.
   São campos independentes, sempre.
4. Escolha o **padrão** (cor sólida, listras, camuflado, digital, gradiente ou
   chamas) e ajuste as **duas cores**.
5. Opcional: escreva uma descrição como “ak-47 dourada com chamas” e clique em
   **Aplicar descrição** — o Studio reconhece palavras-chave (não é IA nesta etapa).
6. Confira o **ícone** e a **comparação das seis raridades** e clique em **Salvar no
   projeto**.

Cada skin grava em `armas/<nome>/`:

```
ak-dourada/
  ak-dourada_icone.png       ← ícone no tamanho escolhido
  ak-dourada_raridades.png   ← a mesma skin nas seis raridades
  ak-dourada.json            ← arma, atributos, raridade, condição, float, padrão
```

O desenho é procedural e determinístico: a mesma semente, cores e padrão geram
exatamente o mesmo ícone. Ainda **não** existem efeitos de disparo animados nem
animação de recarga — isso fica para a etapa 7, junto dos efeitos visuais.

### Efeitos visuais

Menu **Efeitos Visuais e Sonoros**. Passo a passo:

1. Escolha o **tipo**: explosão, fumaça, fogo, impacto, sangue estilizado, cura ou
   faísca. Cada tipo traz quadros e FPS sugeridos.
2. Ajuste **quadros, FPS, tamanho do quadro (32/64/96 px), semente e as duas cores**.
3. A prévia reproduz sozinha na velocidade do FPS; clique em um quadro para pausar
   nele.
4. Clique em **Salvar no projeto**.

Cada efeito grava em `efeitos/<nome>/`:

```
explosao-de-teste/
  quadro_01.png ... quadro_06.png
  explosao-de-teste_sheet.png
  explosao-de-teste.json
```

### Skills e habilidades

Menu **Skills e Habilidades**. Passo a passo:

1. Escreva o **nome** e uma **descrição** como “granada de fumaça que dura 8
   segundos”. **Aplicar descrição** escolhe o tipo e os parâmetros por
   palavras-chave (não é IA nesta etapa).
2. Escolha o **tipo**: área de efeito, projétil, cura, escudo, mobilidade ou
   utilitária.
3. Ajuste os **parâmetros**: dano, alcance, raio, duração, recarga, custo de energia
   e velocidade. Os campos têm limites reais aplicados no núcleo.
4. Escolha o **efeito visual** e as cores da habilidade. A prévia mostra o ícone e a
   animação do efeito, e a lista de quadros permite pausar em qualquer ponto.
5. Clique em **Salvar no projeto**.

Cada habilidade grava em `habilidades/<nome>/`:

```
granada-de-teste/
  granada-de-teste_icone.png
  efeito_01.png ... efeito_08.png
  efeito_sheet.png
  granada-de-teste.gd      ← script pronto para a Godot 4
  granada-de-teste.json
```

O script gerado (`usar(origem, alvo)`) cria a `Area2D` com o raio configurado, aplica
`receber_dano()` nos corpos que entram, monta o `AnimatedSprite2D` a partir da
spritesheet do efeito e respeita a recarga. Não há som nesta etapa: a integração
com áudio fica para o polimento da etapa 10.

### Itens e equipamentos

Menu **Itens e Equipamentos**. Passo a passo:

1. Escolha a **categoria**: colete, capacete, mochila, seringa, kit médico, chave ou
   item especial.
2. Escreva o **nome** e a **descrição**. **Aplicar descrição** lê palavras como
   “colete de 80 de armadura” ou “seringa que cura 40” e preenche os campos (não é
   IA nesta etapa).
3. Escolha a **raridade**: comum, incomum, raro, épico ou lendário. A raridade só
   muda a faixa colorida do ícone — nunca os atributos.
4. Ajuste os **atributos da categoria** (armadura, capacidade, cura, durabilidade e
   valor), as cores, o tamanho e a semente.
5. Clique em **Salvar no projeto**.

Cada item grava em `itens/<nome>/`:

```
colete-de-teste/
  colete-de-teste_icone.png
  colete-de-teste.json
```

### Drops e economia

Menu **Drops e Economia**. Passo a passo:

1. Dê um nome à tabela e escolha a **fonte**: monstro, caixa, missão ou evento.
2. Escolha o **modo**: **exclusiva** (uma recompensa por abertura, as chances têm de
   somar exatamente 100%) ou **independente** (cada item rola sozinho).
3. Adicione os itens com nome, raridade, chance em % e quantidade mínima/máxima.
4. Se a soma não estiver em 100%, o botão **Distribuir 100%** reajusta tudo
   proporcionalmente.
5. Confira a **calculadora**: chance de cada item sair ao menos uma vez e quantidade
   esperada para o número de aberturas escolhido.
6. Clique em **Salvar no projeto**.

Cada tabela grava em `drops/<nome>/`:

```
loot-de-inimigo-comum/
  loot-de-inimigo-comum.json
  loot-de-inimigo-comum.gd    ← sortear() pronto para a Godot 4
  loot-de-inimigo-comum.csv   ← planilha para conferir a economia
```

### Assistente de IA

Menu **Assistente de IA**. Esta etapa **não é uma simulação**: o Studio faz chamadas
reais para o provedor que você escolher, com a sua chave.

1. Em **Provedores**, cole a chave da OpenAI, Anthropic ou OpenRouter e clique em
   **Salvar**. A chave é cifrada pelo armazenamento seguro do sistema
   (`safeStorage`) antes de ir para o banco e **nunca volta para a tela**.
2. Clique em **Testar** para fazer uma chamada mínima de verdade e conferir chave,
   modelo e conexão.
3. Em **Assistente de criações**, descreva o pedido, por exemplo “crie um colete
   tático raro com 70% de armadura e uma tabela de drops para inimigo comum”.
4. Clique em **Preparar plano**. A IA devolve um plano em JSON e **cada criação passa
   pelos mesmos validadores das etapas 3 a 8** antes de aparecer na tela.
5. Confira nomes e resumos e clique em **Criar no projeto**. Só então os arquivos são
   gravados — nada é salvo sem essa confirmação.
6. As ferramentas **Código GDScript**, **Imagem** e **Áudio (voz)** geram arquivos
   reais em `ia/codigo/`, `ia/imagens/` e `ia/audio/`.

O que **não** existe: nenhuma chave fica dentro do código, nenhuma chamada é feita
sem a sua chave e nenhum resultado é inventado. Sem chave ou sem internet, o Studio
mostra o motivo exato da falha.

### Gerenciador de arquivos

Menu **Arquivos do projeto**. Você navega pelas pastas, vê imagens como sprites (com
fundo xadrez), lê arquivos de texto e cenas como código, cria pastas, importa arquivos
do computador e move itens indesejados para a lixeira interna.

- Importar **nunca sobrescreve**: um arquivo repetido vira `nome-2.png`.
- Caminhos são validados: a interface não consegue sair da pasta do projeto.

### Integração com Godot 4

Menu **Integração com Godot 4**. Passo a passo:

1. Clique em **Escolher pasta da Godot** e selecione a pasta que contém
   `project.godot`.
2. O Studio mostra nome do projeto, versão da engine, cena principal, autoloads,
   quantidade de cenas, scripts e imagens.
3. Coloque na pasta `godot/` do seu projeto no Studio os arquivos que deseja enviar.
4. Clique em **Pré-visualizar exportação** e confira **cada arquivo** e o que acontece
   com ele (novo, substituir ou sem mudança).
5. Confirme. Nada é apagado; arquivos substituídos vão antes para
   `.pixel_strike/backups/` dentro do projeto Godot.

O que a exportação grava hoje:

| Arquivo | Para que serve |
| --- | --- |
| `addons/pixel_strike/pixel_strike.gd` | Utilitário (autoload) que lê o manifesto e carrega recursos |
| `addons/pixel_strike/pixel_strike_manifest.json` | Lista dos recursos exportados |
| `addons/pixel_strike/LEIA-ME.md` | Instruções para ativar o autoload |
| `pixel_strike/recursos/...` | Arquivos da pasta `godot/` do projeto |
| `pixel_strike/recursos/personagens/...` | Sprites PNG e fichas JSON dos personagens gerados |
| `pixel_strike/recursos/monstros/...` | Sprites PNG e fichas JSON dos monstros gerados |
| `pixel_strike/recursos/animacoes/...` | Quadros PNG, spritesheets e fichas JSON das animações |
| `pixel_strike/recursos/mapas/...` | Imagem, atlas, dados, script e cena de cada mapa |
| `pixel_strike/recursos/armas/...` | Ícone, comparativo de raridades e ficha JSON de cada skin |
| `pixel_strike/recursos/efeitos/...` | Quadros, spritesheet e ficha de cada efeito |
| `pixel_strike/recursos/habilidades/...` | Ícone, quadros do efeito, ficha e script GDScript |
| `pixel_strike/recursos/itens/...` | Ícone e ficha JSON de cada item |
| `pixel_strike/recursos/drops/...` | Ficha JSON, script GDScript de sorteio e planilha CSV |
| `pixel_strike/recursos/ia/...` | Scripts, imagens e áudios gerados pelo assistente |

Tudo o que os geradores criam entra na exportação automaticamente — não é preciso
copiar arquivo por arquivo. O Studio não altera cenas, scripts ou
configurações que você criou na Godot.

Opcionalmente, em Configurações, você pode apontar o executável da Godot apenas para
conferir a versão instalada — o Studio nunca abre a Godot sozinho.

### Onde ficam os arquivos

| O quê | Onde |
| --- | --- |
| Projetos e recursos | pasta escolhida em Configurações |
| Banco de dados (`studio.db`) | `%APPDATA%\Pixel Strike Studio` |
| Backups | `<pasta de dados>\backups\<id do projeto>` |
| Lixeira interna (nada é apagado de verdade) | `<pasta de dados>\lixeira` |
| Cópias feitas antes de exportar para a Godot | `<projeto Godot>\.pixel_strike\backups\<data e hora>` |

---

## Testes

```bash
npm run typecheck   # verificação de tipos (interface + processo principal)
npm run test:core   # 298 verificações: banco, projetos, arquivos, Godot, sprites, animações, mapas, armas, efeitos, habilidades, itens, drops, IA, atualizações e logs
npm run smoke       # compila e abre o Electron verificando IPC, banco e interface
```

O `smoke` é um teste real de integração em duas fases: cria um projeto em pasta
temporária, faz backup, testa o gerenciador de arquivos, gera um sprite, uma animação e
um mapa, confere o estado inicial da Godot, **recarrega a janela** (simulando reiniciar
o app), confere que o projeto continua aberto, abre as páginas de arquivos,
personagens, animações e mapas pelo menu e remove o projeto. Tudo dentro do Electron, sem tocar nos seus
dados.

Resultado da última execução desta versão: **typecheck OK, 298/298 verificações do
núcleo, build OK, smoke OK** — inclusive rodando o smoke dentro do aplicativo já
empacotado (`dist/win-unpacked/Pixel Strike Studio.exe`).

---

## Estrutura do código

```
src/
  main/                 processo principal do Electron (Node)
    core/               banco de dados, projetos, backups, histórico, estatísticas
      database.ts       conexão SQLite e migrações versionadas
      projects.ts       criar, abrir, duplicar, remover, backup, restaurar
      file-manager.ts   listar, pré-visualizar, importar e remover arquivos
      godot.ts          ler project.godot, vincular e exportar com backup
      characters.ts     gerar, salvar, listar e remover personagens/monstros
      sprites.ts        desenho em pixel art (grade 32, poses e quatro direções)
      animations.ts     quadros, spritesheet, ficha e remoção de animações
      maps.ts           mapas, colisões, áreas, spawns e arquivos da Godot
      weapons.ts        skins: desenho, raridade, condição, comparação e ficha
      effects.ts        efeitos: partículas por quadro, spritesheet e ficha
      skills.ts         habilidades: parâmetros, ícone, efeito e script GDScript
      items.ts          itens: ícone por categoria, atributos, raridade e ficha
      drops.ts          tabelas de drops: validação de 100%, script e planilha
      ai.ts             provedores, chave cifrada, texto, código, imagem e áudio
      assistant.ts      plano do assistente: valida e aplica com confirmação
      updates.ts        consulta de versões publicadas no GitHub
      diagnostics.ts    log local rotativo de falhas
      png.ts            codificador PNG RGBA sem dependências
      settings-store.ts preferências locais
      activity.ts       histórico de ações
      stats.ts          indicadores do painel
      filesystem.ts     cópia, tamanho e lixeira interna
      project-template.ts  pastas e arquivos de um projeto novo
    ipc.ts              canais validados entre interface e núcleo
    security.ts         bloqueio de navegação externa e permissões
    smoke.ts            teste automático em duas fases
    index.ts            janela e ciclo de vida
  preload/              ponte segura (contextBridge) exposta à interface
  renderer/             interface React + Tailwind
    src/components/     botões, cartões, modais, notificações, navegação
    src/pages/          painel, projetos, arquivos, projeto, Godot, personagens, animações, ajuda, etapas
    src/state/store.tsx estado global e chamadas ao núcleo
  shared/               contrato de tipos compartilhado (IPC, estrutura de pastas)
tests/core.test.ts      testes do núcleo
docs/ARQUITETURA.md     decisões técnicas e como estender
```

Detalhes de arquitetura, esquema do banco e contrato de IPC em
[`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

---

## Segurança

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- A interface não acessa disco, banco ou Node: só fala com o processo principal por
  canais IPC com validação de argumentos e de origem.
- Links externos abrem no navegador padrão; navegação dentro da janela é bloqueada.
- Permissões de mídia/dispositivo negadas por padrão.
- Política de segurança de conteúdo (CSP) restritiva na interface.
- **Nenhum dado do usuário sai do computador.** Nenhuma chave de API é usada nesta
  etapa.

## Regras do projeto

- Nada de botões falsos ou integrações simuladas.
- Nenhuma operação destrutiva sem confirmação.
- O Studio nunca apaga arquivos de forma definitiva: move para a lixeira interna.
- Restaurar backup sempre cria antes uma cópia de segurança do estado atual.
- Raridade, condição de desgaste e padrão de skin serão tratados como campos
  separados (etapa 6), nunca misturados.
- Conteúdo visual sempre original ou devidamente licenciado.

---

## Instalador para Windows

O instalador é gerado com o electron-builder, sem assinatura de código:

```bash
npm run icon      # gera build/icon.png e build/icon.ico em pixel art
npm run pack:win  # pasta pronta para testar: dist/win-unpacked/
npm run dist:win  # instalador: dist/PixelStrikeStudio-Setup-1.0.0.exe
```

O instalador NSIS permite escolher a pasta, cria atalhos na área de trabalho e no menu
Iniciar e **não apaga os seus dados ao desinstalar** (banco, projetos, backups e chaves
continuam em `%APPDATA%\Pixel Strike Studio`). Detalhes em
[`docs/INSTALADOR.md`](docs/INSTALADOR.md).

O aplicativo empacotado foi verificado: `dist/win-unpacked/Pixel Strike Studio.exe
--smoke-test` passa por todas as checagens, incluindo o banco SQLite nativo.

## Atualizações

Em **Configurações → Atualizações**, o Studio consulta a última versão publicada no
GitHub e compara com a instalada. Ele mostra a versão, as notas e o link do instalador;
**não baixa nem instala sozinho**.

A verificação usa a API **pública** do GitHub. Enquanto o repositório for **privado**, ela
responde 404 e o Studio informa que nenhuma versão foi encontrada sem login, com um botão
que abre a página de Releases para baixar o instalador manualmente. Para a verificação
automática funcionar, o repositório precisa ser público.

## Logs e diagnóstico

Falhas do processo principal, promessas rejeitadas e erros de renderização vão para
`<pasta de dados>\logs\app.log` (rotação em 1 MB). A tela **Configurações → Logs e
diagnóstico** mostra o caminho e as últimas linhas. Nenhuma chave, texto de projeto ou
conteúdo de arquivo é registrado.

## Limitações conhecidas desta versão

- O instalador **não é assinado** (sem certificado de código), então o Windows mostrará
o aviso do SmartScreen no primeiro uso.
- A atualização é **verificada e baixada manualmente**: não há atualização silenciosa.
- Como o repositório é **privado**, a verificação pública de versões retorna 404; a tela
  mostra o aviso e o atalho para a página de Releases.
- As chamadas de IA foram testadas contra um servidor local que simula a API; **nenhum
provedor real foi chamado** nesta máquina por falta de chave.
- Os scripts `.gd` gerados são validados por texto e estrutura, **não compilados** na
Godot (a engine não está instalada aqui).
- Personagens, monstros e animações não geram cena `.tscn` pronta; só os mapas.
- Áudio de jogo (efeitos sonoros) continua fora do escopo: a IA gera voz, não sfx.
