# Pixel Strike Studio 1.0.0

Primeira versão completa do estúdio de jogos 2D em pixel art para Windows. As 10 etapas
planejadas estão implementadas, testadas e publicadas.

**Repositório:** [github.com/wemersonsilva1756-cloud/pixel-strike-studio](https://github.com/wemersonsilva1756-cloud/pixel-strike-studio)
— código-fonte, README completo, documentação de arquitetura e histórico de commits.

## O que está incluído

**Base do estúdio**
- Projetos com criação, abertura, duplicação, backup e restauração (com backup de
  segurança automático antes de restaurar)
- Gerenciador de arquivos com prévia, importação e lixeira interna (nada é apagado de
  verdade)
- Banco SQLite local, histórico de ações e indicadores no painel

**Integração com Godot 4**
- Leitura do `project.godot`, versão da engine, cena principal e autoloads
- Exportação com prévia arquivo por arquivo e backup dos substituídos

**Criação**
- Personagens e monstros em pixel art, quatro direções, paletas e fichas JSON
- Animações com linha do tempo, FPS, espera por quadro, loop e spritesheet
- Mapas com tiles, colisão por célula, áreas, spawns e exportação de TileSet/TileMap
- Skins de armas com raridade separada da condição de desgaste e comparativo
- Efeitos animados (7 tipos) e habilidades com parâmetros e script GDScript
- Itens e equipamentos com atributos, mais tabelas de drops exclusivas (100% validado)
  ou independentes, com calculadora de chances, script de sorteio e planilha CSV

**Assistente de IA**
- Chaves de OpenAI, Anthropic e OpenRouter cifradas pelo `safeStorage` do Windows —
  nunca em texto puro e nunca visíveis na interface
- Teste real de chave, plano de criações com prévia e confirmação
- Geração de GDScript, imagem e voz salva na pasta `ia/` do projeto

**Estabilidade**
- Log local rotativo de falhas em `%APPDATA%\Pixel Strike Studio\logs\app.log`
- Proteção contra tela quebrada com opção de recarregar a interface
- Verificação de atualizações por esta página de Releases (sem instalação automática)

## Integridade do arquivo

| Arquivo | Tamanho | SHA-256 |
| --- | --- | --- |
| `PixelStrikeStudio-Setup-1.0.0.exe` | 124.822.384 bytes | `7b16292c1c8653fcf1363f0ac73627a0472006218dee20b621e2aa8a8ad1c42e` |

Para conferir no Windows: `certutil -hashfile PixelStrikeStudio-Setup-1.0.0.exe SHA256`.

## Instalação

1. Baixe `PixelStrikeStudio-Setup-1.0.0.exe` abaixo.
2. Execute o instalador. Ele instala por usuário (não pede administrador) e permite
   escolher a pasta.
3. Abra pelo atalho da área de trabalho ou do menu Iniciar.

Requisitos: Windows 10 ou 11, 64 bits.

## Verificação desta versão

- `npm run typecheck` — OK
- `npm run test:core` — 298 verificações aprovadas
- `npm run build` — OK
- Smoke test no Electron e também no aplicativo empacotado
  (`dist/win-unpacked/Pixel Strike Studio.exe --smoke-test`) — OK
- Instalador NSIS gerado com electron-builder 26.18.0

## Limitações conhecidas

- O instalador **não é assinado**; o Windows mostrará o aviso do SmartScreen no primeiro
  uso ("Mais informações" → "Executar assim mesmo").
- A atualização é verificada e baixada manualmente; não há atualização silenciosa. O
  repositório é público, então **Configurações → Atualizações** encontra esta Release e o
  instalador pelo link. Se o GitHub limitar as consultas (HTTP 403), o Studio avisa e o
  download continua disponível por esta página.
- As chamadas de IA foram testadas contra um servidor local que simula a API. Nenhum
  provedor real foi chamado durante os testes automatizados — o primeiro uso real é com a
  sua chave.
- Scripts `.gd` são validados por estrutura, não compilados na Godot.
- Personagens, monstros e animações não geram cena `.tscn`; só os mapas.
- Sem efeitos sonoros de jogo (a IA gera voz, não sfx).

## Licença

Este projeto é open source sob a licença **MIT**: use, copie, modifique, distribua e venda
livremente, desde que o aviso de copyright seja mantido. O texto completo está em
[LICENSE](https://github.com/wemersonsilva1756-cloud/pixel-strike-studio/blob/main/LICENSE).

```
MIT License · Copyright (c) 2026 Wemerson Silva
```

O código-fonte está em
[github.com/wemersonsilva1756-cloud/pixel-strike-studio](https://github.com/wemersonsilva1756-cloud/pixel-strike-studio).

## Desinstalação

Desinstalar **não apaga seus dados**: projetos, banco, backups, lixeira e chaves continuam
em `%APPDATA%\Pixel Strike Studio`. Para remover tudo, apague essa pasta depois de
desinstalar.
