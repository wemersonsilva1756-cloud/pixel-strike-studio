# Instalador do Windows — Pixel Strike Studio

Este documento explica como gerar, testar e publicar o instalador do Studio. Ele foi
escrito para quem nunca empacotou um aplicativo Electron.

## O que é gerado

| Comando | Resultado | Para que serve |
| --- | --- | --- |
| `npm run icon` | `build/icon.png` e `build/icon.ico` | Ícone em pixel art usado na janela, no instalador e nos atalhos |
| `npm run pack:win` | `dist/win-unpacked/` | Pasta com o aplicativo pronto, sem instalador — ideal para testar |
| `npm run dist:win` | `dist/PixelStrikeStudio-Setup-1.0.0.exe` | Instalador NSIS para distribuir |

Os três comandos rodam sobre o código já compilado por `electron-vite build`. O
`dist/` fica fora do Git.

## Antes de gerar

1. Node 22 ou superior (`node --version`).
2. `npm install` na raiz do projeto.
3. Nenhuma chave de IA é necessária para empacotar: as chaves ficam no banco do
   usuário, não no código.

## Como gerar

```bash
npm run dist:win
```

O electron-builder baixa o Electron e as ferramentas do NSIS na primeira execução
(algumas centenas de MB) e guarda em cache no perfil do usuário. As próximas builds
são bem mais rápidas.

Ao final, confira:

- `dist/PixelStrikeStudio-Setup-1.0.0.exe` — o instalador (cerca de 120 MB).
- `dist/PixelStrikeStudio-Setup-1.0.0.exe.blockmap` — usado por sistemas de
  atualização incremental.
- `dist/win-unpacked/Pixel Strike Studio.exe` — versão sem instalar.

## Como testar sem instalar

```bash
npm run pack:win
"./dist/win-unpacked/Pixel Strike Studio.exe" --smoke-test
```

O parâmetro `--smoke-test` roda o teste de integração completo em uma pasta temporária:
cria projeto, backup, arquivos, personagens, animação, mapa, skin, efeito, habilidade,
item, tabela de drops, confere a central de IA e a exportação para a Godot, recarrega a
janela e remove tudo no final. Nada é gravado nos seus dados.

Esse teste é a melhor prova de que o aplicativo **empacotado** funciona — inclusive o
driver SQLite nativo, que é desempacotado do `app.asar` por causa do `asarUnpack` no
`electron-builder.yml`.

## O que o instalador faz

- Instala por usuário (`perMachine: false`): não pede administrador.
- Permite escolher a pasta de instalação.
- Cria atalho na área de trabalho e no menu Iniciar.
- **Não apaga seus dados ao desinstalar**: banco, projetos, backups, lixeira e chaves
  continuam em `%APPDATA%\Pixel Strike Studio`.

## Assinatura de código

Não há certificado configurado, então o instalador sai **sem assinatura**. O Windows
vai mostrar o aviso do SmartScreen na primeira execução ("Windows protegeu o seu PC").
Para remover o aviso é preciso comprar um certificado de assinatura de código e
configurá-lo no `electron-builder.yml` (`win.certificateFile` e `win.certificatePassword`,
ou as variáveis de ambiente `CSC_LINK` e `CSC_KEY_PASSWORD`). Nunca coloque a senha do
certificado no repositório.

## Publicando uma versão

1. Atualize `version` no `package.json` (o instalador usa esse número).
2. Rode `npm run dist:win`.
3. Crie uma Release no GitHub com a tag `v1.0.0` (o mesmo número do `package.json`).
4. Anexe o `PixelStrikeStudio-Setup-1.0.0.exe` à Release.
5. A tela **Configurações → Atualizações** passa a encontrar a versão nova e mostrar o
   link para download.

A verificação usa a API pública de releases do GitHub. Nenhum dado do projeto é
enviado.

> **Ver a tela de atualização sem publicar versão nova:** rode `npm run demo:atualizacao` e,
> em outro terminal, `PIXEL_STRIKE_UPDATE_ENDPOINT=http://127.0.0.1:4599/releases/latest npx electron .`.
> O Studio passa a consultar um servidor local que anuncia uma versão 1.0.1 fictícia — nada é
> publicado no GitHub e a consulta real continua sendo a padrão sem essa variável.

> **Se aparecer “nenhuma versão publicada”:** a API pública responde 404 quando o
> repositório está privado ou quando não existe Release publicada. O Studio mostra o
> aviso e o botão “Abrir página de Releases”. Este repositório é público e a Release
> `v1.0.0` é encontrada pela verificação — a tela mostra a versão e o link do instalador.

## Problemas comuns

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| `Cannot find module '@libsql/win32-x64-msvc'` | binário nativo dentro do asar | confira `asarUnpack` no `electron-builder.yml` |
| antivírus bloqueia o instalador | assinatura ausente | use "Executar assim mesmo" ou assine o binário |
| build falha ao baixar NSIS | sem internet ou proxy | libere o acesso ou configure `ELECTRON_BUILDER_CACHE` |
| instalador abre e fecha | banco inacessível | rode o aplicativo pelo terminal e veja `logs/app.log` |
