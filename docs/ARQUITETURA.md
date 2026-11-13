# Arquitetura do Pixel Strike Studio

Documento técnico da Etapa 1. Explica como o aplicativo está dividido, como os dados
circulam e como adicionar os próximos módulos sem quebrar o que já existe.

## Visão geral

```
┌──────────────────────────────────────────────────────────────┐
│ INTERFACE (renderer)                                         │
│ React + TypeScript + Tailwind · src/renderer                 │
│ Sem acesso a Node, disco ou banco.                           │
└───────────────▲──────────────────────────────────────────────┘
                │  window.studio.<recurso>.<ação>()  (contextBridge)
                │  <IpcResult> { ok, data } | { ok:false, message }
┌───────────────┴──────────────────────────────────────────────┐
│ PRELOAD (ponte) · src/preload                                │
│ Só ipcRenderer.invoke/send + eventos de progresso.           │
└───────────────▲──────────────────────────────────────────────┘
                │  canais validados (origem + argumentos)
┌───────────────┴──────────────────────────────────────────────┐
│ PROCESSO PRINCIPAL · src/main                                │
│ ipc.ts  →  core/  →  SQLite (libsql) + sistema de arquivos   │
└──────────────────────────────────────────────────────────────┘
```

Regras que sustentam essa divisão:

1. **A interface nunca importa código de `src/main`.** Só tipos de `src/shared`.
2. **Todo erro chega à interface como texto em português** (envelope `IpcResult`), nunca
   como stack trace cru.
3. **O núcleo não conhece Electron.** `initializeCore()` recebe caminhos e versão por
   parâmetro, então os mesmos serviços rodam nos testes em Node puro.

## Camadas e responsabilidades

| Arquivo | Responsabilidade |
| --- | --- |
| `src/main/index.ts` | Ciclo de vida do app, janela, CSP/bridge, teste automático (`--smoke-test`) |
| `src/main/ipc.ts` | Registro dos canais, validação de origem e de argumentos |
| `src/main/security.ts` | Bloqueio de navegação externa, `window.open`, webviews e permissões |
| `src/main/core/database.ts` | Conexão SQLite, pragmas e migrações versionadas |
| `src/main/core/projects.ts` | CRUD de projetos, duplicação, backup, restauração, remoção segura |
| `src/main/core/file-manager.ts` | Listagem, prévia, importação sem sobrescrever e lixeira de itens |
| `src/main/core/godot.ts` | Leitura do `project.godot`, vínculo, plano de exportação e escrita com backup |
| `src/main/core/characters.ts` | Serviço de personagens/monstros: validação, gravação, lista e remoção |
| `src/main/core/sprites.ts` | Desenho procedural em pixel art (grade 32, poses, quatro direções, contorno) |
| `src/main/core/animations.ts` | Quadros, spritesheet, ficha JSON, lista e remoção de animações |
| `src/main/core/maps.ts` | Validação, renderização, gravação e leitura de mapas, atlas e cena para a Godot |
| `src/shared/maps.ts` | Tiles, temas, zonas, spawns e geração determinística de proposta de mapa |
| `src/main/core/weapons.ts` | Skins: validação, desenho pixel art, comparação, gravação e remoção |
| `src/shared/weapons.ts` | Modelos de arma, raridades, condições, padrões e interpretação de descrição |
| `src/main/core/effects.ts` | Motor de partículas por quadro, spritesheet, gravação e remoção de efeitos |
| `src/shared/effects.ts` | Tipos de efeito, presets de quadros/FPS/cores e limites |
| `src/main/core/skills.ts` | Habilidades: validação, ícone, efeito, script GDScript e gravação |
| `src/shared/skills.ts` | Tipos de habilidade, parâmetros, faixas e interpretação de descrição |
| `src/main/core/items.ts` | Itens: ícone por categoria, desgaste, gravação e remoção |
| `src/shared/items.ts` | Categorias, raridades, atributos, faixas e interpretação de descrição |
| `src/main/core/drops.ts` | Tabelas de drops: validação de 100%, script GDScript e CSV |
| `src/shared/drops.ts` | Modelos de drop, calculadora de chances e normalização |
| `src/main/core/ai.ts` | Provedores, chave cifrada, chat, código, imagem e áudio |
| `src/main/core/assistant.ts` | Plano do assistente: prompt, validação e aplicação |
| `src/shared/ai.ts` | Catálogo de provedores, capacidades e tipos do assistente |
| `src/main/core/updates.ts` | Consulta de versões publicadas no GitHub |
| `src/shared/updates.ts` | Tipos de atualização e comparação de versões |
| `src/main/core/diagnostics.ts` | Log local rotativo de falhas |
| `src/main/core/png.ts` | Codificador PNG RGBA com `zlib` (sem dependências externas) |
| `src/main/smoke.ts` | Teste automático em duas fases (com recarga da janela) |
| `src/main/core/settings-store.ts` | Preferências em tabela chave/valor |
| `src/main/core/activity.ts` | Histórico (mantém as 500 ações mais recentes) |
| `src/main/core/stats.ts` | Contadores e tamanho total em disco |
| `src/main/core/filesystem.ts` | Cópia com progresso, tamanho de pasta, lixeira interna |
| `src/main/core/project-template.ts` | Pastas, `projeto.json` e `LEIA-ME.txt` de um projeto novo |
| `src/main/core/naming.ts` | Slug sem acentos, carimbo de data, formatação de bytes |
| `src/shared/contract.ts` | Tipos e nomes dos canais IPC |
| `src/shared/project-structure.ts` | Lista de pastas do projeto usada pelo núcleo e pela interface |

## Contrato de IPC

Todos os canais seguem `studio:<área>:<ação>`. Nenhum recebe caminho de arquivo
arbitrário da interface: o núcleo sempre resolve os caminhos a partir do banco.

| Canal | Retorno |
| --- | --- |
| `studio:app:paths` | pastas de dados, banco, backups e versão |
| `studio:app:open-data-folder` | abre a pasta de dados no Explorador |
| `studio:app:open-project-folder` | valida o projeto e abre sua pasta |
| `studio:settings:get` / `update` | preferências (patch com campos permitidos) |
| `studio:settings:choose-workspace` | diálogo nativo de pasta |
| `studio:settings:reset-onboarding` | reativa o guia inicial |
| `studio:projects:list` / `get` | resumos com contadores e tamanho |
| `studio:projects:create` | valida nome e cria pastas + registro + histórico |
| `studio:projects:update` | nome, descrição e situação |
| `studio:projects:open` | atualiza último acesso e projeto ativo |
| `studio:projects:duplicate` | copia pasta e registros de recursos |
| `studio:projects:remove` | move para a lixeira (opcional) e/ou retira da lista |
| `studio:projects:backup` | copia a pasta para a área de backups |
| `studio:projects:list-backups` / `restore-backup` | histórico e restauração com cópia de segurança |
| `studio:activity:list` | histórico recente |
| `studio:stats:get` | indicadores do painel |
| `studio:files:list` / `preview` | conteúdo de uma pasta e prévia de arquivo (texto ou imagem) |
| `studio:files:import` | diálogo nativo e cópia de arquivos para o projeto |
| `studio:files:create-folder` / `trash` | pasta nova e envio para a lixeira interna |
| `studio:files:open-folder` | abre uma pasta do projeto no Explorador |
| `studio:godot:state` | vínculo, informações do projeto Godot e executável configurado |
| `studio:godot:link` / `unlink` | vincula a pasta do `project.godot` ou esquece o vínculo |
| `studio:godot:plan` | lista de arquivos que seriam gravados, sem escrever nada |
| `studio:godot:export` | grava o plano, com backup prévio dos arquivos substituídos |
| `studio:godot:choose-executable` / `check-executable` | confere a versão da Godot (opcional) |
| `studio:characters:preview` | sprites em memória (data URL por direção), sem gravar nada |
| `studio:characters:interpret` | sugestões por palavras-chave a partir da descrição |
| `studio:characters:save` | grava PNGs + ficha JSON e registra na tabela `assets` |
| `studio:characters:list` / `remove` | lista personagens/monstros e move a pasta para a lixeira |
| `studio:animations:preview` | quadros e spritesheet em memória, sem gravar nada |
| `studio:animations:save` | grava PNGs, `_sheet.png` e ficha JSON, registrando em `assets` |
| `studio:animations:list` / `remove` | lista animações e move a pasta para a lixeira |
| `studio:maps:propose` | proposta de mapa determinística a partir da descrição e da semente |
| `studio:maps:preview` | imagem do mapa e atlas de tiles em memória, sem gravar nada |
| `studio:maps:save` | grava `mapa.png`, `tileset.png`, `mapa.json`, `.gd` e `.tscn` em `mapas/` |
| `studio:maps:list` / `load` | lista os mapas e devolve um mapa salvo para edição |
| `studio:maps:remove` | move a pasta do mapa para a lixeira interna |
| `studio:weapons:preview` | ícone da skin em memória, sem gravar nada |
| `studio:weapons:compare` | faixa com a mesma skin nas seis raridades |
| `studio:weapons:interpret` | sugestões de arma, raridade e padrão por palavras-chave |
| `studio:weapons:save` | grava ícone, comparativo e ficha em `armas/` |
| `studio:weapons:list` / `remove` | lista skins e leva a pasta para a lixeira |
| `studio:effects:preview` | quadros e spritesheet do efeito em memória |
| `studio:effects:save` / `list` / `remove` | grava em `efeitos/`, lista e move para a lixeira |
| `studio:skills:preview` | ícone + animação do efeito da habilidade |
| `studio:skills:interpret` | sugere tipo, efeito e parâmetros por palavras-chave |
| `studio:skills:save` / `list` / `remove` | grava ícone, quadros, `.gd` e ficha em `habilidades/` |
| `studio:items:preview` / `interpret` | ícone do item em memória e leitura da descrição |
| `studio:items:save` / `list` / `remove` | grava em `itens/`, lista e move para a lixeira |
| `studio:drops:stats` | calculadora de chances e quantidade esperada |
| `studio:drops:save` / `list` / `remove` | grava JSON, `.gd` e CSV em `drops/` |
| `studio:ai:providers` | estado dos provedores, sem nenhuma chave |
| `studio:ai:save-provider` | cifra a chave com o armazenamento seguro e salva |
| `studio:ai:remove-key` | apaga a chave do banco |
| `studio:ai:test` | chamada mínima real ao provedor |
| `studio:ai:text` / `code` / `image` / `audio` | gerações reais |
| `studio:assistant:plan` / `apply` | plano validado e criação confirmada |
| `studio:diagnostics:logs` / `open-logs` / `report` | leitura, pasta e registro de erro |
| `studio:updates:check` / `open` | consulta o GitHub e abre o link do repositório |
| `studio:event:progress` | evento (main → renderer) de operações longas |

`studio:app:smoke-ready` é o único canal `send` (sem resposta), usado pelo teste
automático.

## Banco de dados

SQLite via `@libsql/client` (binário N-API, funciona no Electron sem compilação
nativa). Migrações são uma lista numerada em `database.ts`: **nunca edite uma migração
já publicada**; acrescente uma nova entrada no fim.

| Tabela | Conteúdo |
| --- | --- |
| `schema_migrations` | versão e data de cada migração aplicada |
| `settings` | chave/valor JSON (pasta de projetos, projeto ativo, guia, retenção) |
| `projects` | id, nome, slug, descrição, caminho, situação, datas |
| `assets` | recursos por projeto; `kind` é `personagem`, `monstro` ou `animacao`, e o `data` guarda a especificação completa (no caso da animação, tipo, FPS, quadros e caminho da spritesheet) |
| `backups` | id, projeto, rótulo, caminho, tamanho, tipo, data |
| `activity` | histórico de ações |
| `godot_links` | pasta do projeto Godot vinculada, data do vínculo e do último envio |

Migração 2 acrescenta `godot_links`. Projetos removidos do banco levam o vínculo junto
(`ON DELETE CASCADE`); nenhum arquivo do projeto Godot é tocado por isso.

`assets.project_id` e `backups.project_id` têm `ON DELETE CASCADE`; apagar um projeto
do banco remove seus registros, mas **os arquivos vão para a lixeira**, não são
destruídos.

## Fluxo de backup e restauração

**Backup**

1. valida que a pasta do projeto existe;
2. copia a pasta para `<dados>/backups/<id do projeto>/<data>_<sufixo>`;
3. mede o tamanho e registra em `backups`;
4. registra a ação no histórico;
5. aplica a retenção configurada **apenas aos backups automáticos/de segurança**
   (os manuais nunca são reciclados); excedentes vão para a lixeira.

Backups ficam fora da pasta do projeto para que copiar o projeto nunca copie os
próprios backups (sem recursão).

**Restauração**

1. cria um backup de segurança do estado atual;
2. move a pasta atual do projeto para a lixeira interna;
3. copia o conteúdo do backup escolhido para o lugar do projeto;
4. atualiza a data do projeto e registra no histórico.

## Progresso de operações longas

Operações de cópia emitem `ProgressEvent { operationId, label, percent, done }` pelo
canal `studio:event:progress`. A interface mostra uma barra flutuante e limpa o estado
1,5 s após o término.

## Segurança

- `BrowserWindow` com `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, `webSecurity: true`.
- `contextBridge` expõe apenas a API tipada `window.studio`.
- Cada handler IPC confere a origem do frame (`file://` do próprio app ou
  `localhost` do servidor de desenvolvimento) antes de executar.
- Argumentos são validados por tipo; o patch de preferências só aceita chaves
  conhecidas.
- `setWindowOpenHandler` e `will-navigate` bloqueiam navegação para fora; links
  `https`/`mailto` abrem no navegador padrão.
- Permissões (câmera, microfone, etc.) negadas por padrão.
- CSP no `index.html`: `default-src 'self'`, sem `unsafe-eval`, sem scripts externos.

## Como adicionar um módulo (etapas 2 a 9)

1. Crie `src/main/core/<modulo>.ts` com funções puras em relação ao Electron.
2. Adicione os tipos e canais em `src/shared/contract.ts`.
3. Registre os handlers em `src/main/ipc.ts` com validação de argumentos.
4. Exponha no preload (`src/preload/index.ts`) dentro de `StudioApi`.
5. Crie a página em `src/renderer/src/pages/` e ligue no menu (`navigation.ts`),
   trocando o selo "Etapa N" quando o módulo estiver completo.
6. Cubra a lógica nova em `tests/core.test.ts` antes de considerar a etapa concluída.
7. Se houver migração de banco, acrescente uma nova versão em `database.ts`.

## Gerenciador de arquivos

`file-manager.ts` é a única porta de entrada para o disco dentro de um projeto:

- `resolveInside(root, rel)` normaliza o caminho, recusa `..`, `:` e caracteres
  inválidos, e confirma que o destino continua dentro da raiz.
- A listagem classifica por extensão (`imagem`, `audio`, `cena`, `codigo`, `dados`,
  `texto`, `outro`) e devolve data, tamanho e contagem de filhos.
- A prévia lê no máximo 200 KB de texto ou 3 MB de imagem (devolvida como `data:`) —
  nada de enviar arquivos gigantes pelo IPC.
- Importar usa `uniqueName()` para nunca sobrescrever: `heroi.png` repetido vira
  `heroi-2.png`.
- Remover usa a lixeira interna (`dataDir/lixeira`), com `renameSync` e cópia como
  reserva quando o destino está em outro disco.

## Integração com Godot 4

1. **Leitura** — `inspectGodotProject()` analisa `project.godot` (formato INI),
   extrai `config/name`, `config/features` (versão da engine), `run/main_scene` e
   autoloads, e percorre a pasta contando cenas (`.tscn`, `.scn`, `.escn`), scripts
   (`.gd`, `.cs`), imagens e recursos. Projetos com `config_version < 5` são
   recusados com mensagem clara (Godot 3).
2. **Vínculo** — gravado em `godot_links`, por projeto. O Studio nunca grava nessa
   pasta sem vínculo.
3. **Plano** — `buildGodotExportPlan()` monta em memória: script utilitário, manifesto
   JSON, instruções e a cópia de cada arquivo da pasta `godot/` do projeto, mais os
   personagens e monstros gerados (`personagens/` e `monstros/`, PNG + JSON), em
   `pixel_strike/recursos/...`. Para cada arquivo calcula `criar`, `sobrescrever`
   (conteúdo diferente) ou `igual`.
4. **Aplicação** — `applyGodotExport()` recalcula o plano, copia os arquivos que serão
   substituídos para `<godot>/.pixel_strike/backups/<data>/...`, grava, registra em
   `last_export_at` e no histórico. Arquivos `igual` são ignorados, então reexportar
   sem mudanças não reescreve nada.
5. **Executável (opcional)** — `spawnSync(exe, ['--version'])` só lê a versão; o
   Studio não abre a Godot nem executa projetos.

O manifesto é determinístico (sem data volátil) justamente para que a comparação
`igual` funcione em exportações repetidas.

## Gerador de sprites (etapa 3)

`sprites.ts` desenha em uma grade lógica de 32×32 e amplia por vizinho mais próximo para
32, 64 ou 96 px (`scaleTo`), sem interpolação. O PNG é codificado em `png.ts` com
`zlib.deflateSync` — nada de bibliotecas nativas ou binários externos.

- `Canvas` guarda RGBA (`Uint8Array`), com `rect`, `set`, `opacity`, `mirror` e
  `outline` (contorno de 1 px ao redor de tudo que é opaco).
- O desenho é **determinístico**: `mulberry32(seed)` controla detalhes (ombreiras,
  camuflagem, mochila), então a mesma semente gera bytes idênticos.
- Personagens: humanoide com cabeça, tronco, braços, pernas, calça, botas, cabelo,
  olhos e equipamento visível (fuzil, pistola, espada ou escudo); lado esquerdo é o
  direito espelhado.
- Monstros: quatro arquétipos (`humanoide`, `quadrupede`, `slime`, `voador`) e chefes
  com chifres claros.
- `characters.ts` valida tudo (`validateSpec`): nome 2–60, tamanho 32/64/96, pelo
  menos uma direção, cores em hexadecimal, atributos limitados, drops com chance
  0–100 e quantidade 1–999.
- Gravação: `<categoria>/<slug>/<slug>_<direção>.png` + `<slug>.json`, e um registro
  em `assets` para que o gerenciador de arquivos, a exportação para a Godot e os
  próximos módulos enxerguem o recurso.

A descrição é interpretada por `RULES` (palavras-chave → paleta, arquétipo, papel,
equipamento). Não há chamada de IA nesta etapa; a interface diz isso ao usuário.

## Editor de animações (etapa 4)

As animações não são só metadados: cada quadro é desenhado pelo mesmo motor de
sprites, com uma pose diferente.

- `src/shared/animations.ts` define os 10 tipos, os valores sugeridos de FPS e de
  quadros, e `poseForFrame(kind, index, count)` — uma função pura que devolve a pose
  daquele quadro (`bob`, `lean`, `stance`, `squash`, `rotate`, `flash`, `shift`).
- `sprites.ts` aplica a pose: pernas e braços seguem `stance` (humanoides e
  quadrúpedes), e o `Canvas` ganhou `shear`, `squashBottom`, `translate`,
  `rotateQuarter` e `blend`. `renderPosePixels` devolve os pixels crus para montar a
  spritesheet; `renderPose` devolve o PNG.
- `animations.ts` valida a configuração (nome 2–60, FPS 1–60, 1 a 24 quadros, espera
  de 1 a 8 batidas), renderiza, monta a spritesheet horizontal
  (`buildSpritesheet`), calcula a duração (`batidas ÷ FPS`) e grava:
  `animacoes/<slug>/<slug>_NN.png`, `<slug>_sheet.png` e `<slug>.json`.
- A remoção usa a mesma lixeira interna dos outros módulos; nada é apagado.
- A exportação para a Godot copia `animacoes/` junto de `personagens/` e
  `monstros/` para `pixel_strike/recursos/`.

O FPS, a repetição e a espera de cada quadro vêm da ficha JSON, então o runtime do
jogo não precisa adivinhar a velocidade da animação.

## Construtor de mapas (etapa 5)

O mapa é uma grade de tiles com dados que a Godot entende de verdade.

- `src/shared/maps.ts` define os 8 tipos de tile, 5 temas com paleta e peso de
  geração, 5 tipos de área (`segura`, `pvp`, `inimigo`, `objetivo`, `secreta`),
  3 tipos de spawn e o gerador `proposeMap(draft)` — ruído suave determinístico
  pela semente, mais borda de parede, estradas em cruz, lago e pontos de spawn em
  piso livre.
- `maps.ts` valida tudo (nome 2–60, grade 8–64 por lado, tile 8–32 px, imagem de até
  2048 px por lado, coleção de tiles e de colisão sempre do tamanho da grade, áreas
  e spawns encaixados dentro do mapa) e desenha os pixels: cada tile tem detalhe
  próprio (tufos, pedrinhas, ondas, tijolos, tábuas) derivado da posição, então o
  mesmo mapa gera sempre a mesma imagem.
- Gravação em `mapas/<slug>/`: `mapa.png`, `tileset.png` (atlas horizontal com um
  tile por tipo), `mapa.json` (grade, colisão agrupada em blocos, áreas, spawns e
  tamanho), `<slug>.gd` e `<slug>.tscn`.
- O script gerado usa `TileSetAtlasSource` + `TileMapLayer` e cria `StaticBody2D`
  com um `CollisionShape2D` por bloco, `Area2D` por área (tipo nos metadados) e
  `Marker2D` por spawn. Não é preciso converter nada à mão na Godot.
- A exportação para a Godot passou a copiar também `mapas/` para
  `pixel_strike/recursos/`.

## Editor de armas e skins (etapa 6)

- `src/shared/weapons.ts` guarda os 9 modelos base (com classe, munição e
  atributos), as 6 raridades, as 5 condições de desgaste (com faixa de float) e os
  6 padrões. `interpretWeapon(description)` reconhece arma, raridade e padrão por
  palavras-chave — sem IA nesta etapa.
- **Raridade e condição nunca se misturam**: `rarity` é a etiqueta/faixa colorida,
  `wear` + `float` descrevem o desgaste. `validateWeaponSpec` limita o float à faixa
  da condição escolhida e mantém `wearForFloat` para converter na direção oposta.
- `weapons.ts` desenha a silhueta lateral de cada modelo em uma grade 32×32 com
  quatro tipos de célula (corpo da skin, detalhe, metal e cabo), aplica o padrão nas
  duas cores, adiciona lascas proporcionais ao float, a faixa de raridade na base e
  o contorno automático, e amplia sem interpolação para 32, 64 ou 96 px.
- `compareWeapon` monta uma faixa horizontal com a mesma skin nas seis raridades;
  `saveWeapon` grava `armas/<slug>/<slug>_icone.png`, `<slug>_raridades.png` e
  `<slug>.json` com arma, atributos, skin, variações e condições.
- A exportação para a Godot também copia `armas/` para `pixel_strike/recursos/`.

## Efeitos e habilidades (etapa 7)

- `src/shared/effects.ts` define os 7 tipos (explosão, fumaça, fogo, impacto, sangue
  estilizado, cura e faísca), os presets de quadros/FPS/cores e os limites
  (2–16 quadros, 1–30 FPS, 32/64/96 px).
- `effects.ts` desenha cada quadro com um motor de partículas simples e
  determinístico: discos, quadrados e raios posicionados por hash da semente, com
  transparência decrescente. `renderEffectFrames` devolve pixels crus,
  `buildEffectSheet` monta a faixa horizontal e a gravação cria
  `efeitos/<slug>/quadro_NN.png`, `<slug>_sheet.png` e `<slug>.json`.
- `src/shared/skills.ts` define os 6 tipos de habilidade, os parâmetros
  (dano, alcance, raio, duração, recarga, custo e velocidade), as faixas válidas e
  `interpretSkill(description)`, que prioriza o **efeito** sobre o meio de entrega
  (uma “granada de fumaça” vira fumaça, não explosão).
- `skills.ts` valida e limita os parâmetros, desenha um ícone 64 px com o símbolo do
  tipo de habilidade e grava `habilidades/<slug>/`: ícone, quadros do efeito,
  `efeito_sheet.png`, `<slug>.json` e `<slug>.gd`.
- O GDScript gerado (`usar(origem, alvo)`) cria `Area2D` + `CircleShape2D` com o raio,
  chama `receber_dano()` nos corpos que entram, monta `AnimatedSprite2D` com
  `AtlasTexture` por quadro da spritesheet, respeita a recarga e libera os nós no fim
  da duração.
- A exportação para a Godot copia `efeitos/` e `habilidades/` junto dos demais
  recursos.

## Itens e drops (etapa 8)

- `src/shared/items.ts` define 7 categorias (colete, capacete, mochila, seringa, kit,
  chave, especial), 5 raridades próprias e os atributos armadura, capacidade, cura,
  durabilidade e valor, com faixas válidas por campo. `ITEM_CATEGORY_ATTRIBUTES` diz
  quais atributos importam em cada categoria.
- `interpretItem` lê a descrição por palavras-chave e por número: aceita “80 de
  armadura” e “cura 40”. Não é IA nesta etapa.
- `items.ts` desenha a silhueta de cada categoria em grade 32 (colete com placas,
  capacete com viseira, mochila com alças, seringa com agulha, kit com cruz, chave com
  anel e item especial em forma de gema), aplica marcas de desgaste proporcionais à
  durabilidade perdida e a faixa de raridade na base. Grava `itens/<slug>/` com o
  ícone PNG e a ficha JSON.
- `src/shared/drops.ts` define fonte (monstro, caixa, missão, evento), modo
  (`exclusiva` ou `independente`), as entradas e `dropTableStats`, que calcula a
  quantidade esperada e a chance de sair ao menos uma vez em N aberturas com a mesma
  matemática do jogo.
- `normalizeEntries` reajusta as chances para exatamente 100% (usado pelo botão
  “Distribuir 100%”).
- `drops.ts` valida a tabela de verdade: no modo exclusivo a soma precisa ficar em
  100% com tolerância de 0,01; no independente cada item é validado sozinho. Grava
  `drops/<slug>/` com ficha JSON, planilha CSV e um GDScript com `sortear()` — por
  faixa acumulada no modo exclusivo, rolagem individual no independente.
- A exportação copia `itens/` e `drops/` para `pixel_strike/recursos/`.

## Central de IA e assistente (etapa 9)

- `src/shared/ai.ts` lista os provedores (OpenAI, Anthropic, OpenRouter), as
  capacidades de cada um (texto, código, imagem, áudio) e os tipos do assistente.
- `ai.ts` guarda a chave cifrada na tabela `ai_keys` (migração 3). A cifra vem de um
  `SecretStore` injetado: no Electron é o `safeStorage`, que usa o cofre do sistema;
  nos testes é um duplo com a mesma interface. **Se o armazenamento seguro não estiver
  disponível, a chave é recusada** em vez de ser gravada em texto puro.
- A chave só é lida no processo principal, no momento da chamada. Ela não faz parte
  do contrato do IPC de leitura, não entra em registros de atividade e não aparece nos
  logs de erro.
- Cada provedor tem o seu formato: OpenAI/OpenRouter usam `/chat/completions` e a
  Anthropic usa `/messages` com `x-api-key`. Toda chamada tem tempo limite e traduz
  401/403, 404, 429, 5xx e falha de rede em mensagens em português.
- O assistente (`assistant.ts`) pede um JSON com `criacoes` e valida **cada** criação
  com o gerador correspondente: item, drops, efeito, habilidade ou arma. Tabelas
  exclusivas têm as chances reajustadas para 100% antes da validação.
- `planCreations` não grava nada; `applyPlan` só roda depois da confirmação e devolve
  a lista do que foi criado e do que foi ignorado, com o motivo.
- Código, imagens e áudios ficam em `ia/codigo/`, `ia/imagens/` e `ia/audio/` e entram
  na exportação para a Godot.

## Estabilidade, atualizações e instalador (etapa 10)

- `diagnostics.ts` grava eventos e erros em `<pasta de dados>/logs/app.log`, com rotação
  em 1 MB para `app.anterior.log`. O log nunca recebe chaves, textos de projeto ou
  conteúdo de arquivo: só versão, horário, escopo e mensagem.
- `src/main/index.ts` captura `uncaughtException` e `unhandledRejection` e registra no
  log; falhas não tratadas deixam de derrubar o aplicativo em silêncio.
- `ErrorBoundary` (interface) impede que uma tela quebrada derrube o app inteiro:
  mostra uma mensagem clara, registra o erro e oferece recarregar. Também há captura de
  `window.error` e `unhandledrejection` no `main.tsx` do renderer.
- `updates.ts` consulta `https://api.github.com/repos/<repo>/releases/latest`, compara a
  tag com a versão instalada (`compareVersions`, tolerante a `v` e a sufixos) e devolve
  `atualizado`, `disponivel`, `sem-publicacao` ou `erro` — nunca lança exceção para a
  interface, exceto em falhas inesperadas.
- O canal `studio:updates:open` só aceita endereços dentro do repositório oficial antes
  de chamar `shell.openExternal`.
- O instalador usa `electron-builder.yml`: NSIS por usuário, atalhos, ícone em
  `build/icon.ico` (gerado por `scripts/gerar-icone.ts` com o codificador PNG do próprio
  Studio) e `asarUnpack` para o binário nativo do `@libsql`.
- A build de verificação é `dist/win-unpacked/`, testada com
  `--smoke-test`; o instalador sai em `dist/PixelStrikeStudio-Setup-<versão>.exe`.

## Teste automático do Electron (`npm run smoke`)

Executa o app compilado com `--smoke-test`:

- usa pasta temporária como `userData` e como pasta de projetos (não toca nos dados
  reais);
- espera a interface renderizar e o aviso `studio:app:smoke-ready` (executado uma
  única vez, mesmo que a interface avise mais de uma vez);
- **fase 1**: cria um projeto, faz backup, lista a raiz, cria uma pasta, lê o
  `projeto.json`, consulta o estado inicial da Godot, gera um sprite (prévia + save),
  monta uma animação de 6 quadros com spritesheet (prévia + save), propõe, renderiza
  e salva um mapa de 24×16 tiles, gera uma skin com ícone/comparação/save, um efeito
  de 4 quadros, uma habilidade com script, um item e uma tabela de drops;
- recarrega a janela, como um reinício, e **fase 2**: confirma que o app abriu no
  painel, abre as páginas de arquivos, Godot, personagens, animações e mapas pelo
  menu, verifica que as pastas, os sprites, a linha do tempo, a grade do mapa, o ícone
  da skin, a prévia do efeito, os parâmetros da habilidade, o ícone do item e a
  calculadora de drops aparecem e remove o projeto pela lixeira;
- encerra com código 0 apenas se tudo responder como esperado, e imprime um resumo.

Isso cobre de uma vez: preload, IPC, validações, SQLite, sistema de arquivos, React e
navegação.
