import { createServer } from 'node:http'

/**
 * Servidor de demonstração da tela de atualizações.
 *
 * Responde no formato da API de releases do GitHub dizendo que existe uma versão
 * 1.0.1 — **nada é publicado no repositório**: é só uma resposta local para você
 * ver como a tela se comporta quando há uma versão nova.
 *
 * Uso (Git Bash, na raiz do projeto):
 *   npm run demo:atualizacao
 *   PIXEL_STRIKE_UPDATE_ENDPOINT=http://127.0.0.1:4599/releases/latest npx electron .
 */

const port = Number(process.env['DEMO_UPDATE_PORT'] ?? 4599)
const repository = 'https://github.com/wemersonsilva1756-cloud/pixel-strike-studio'

const release = {
  tag_name: 'v1.0.1',
  name: 'Pixel Strike Studio 1.0.1 (demonstração local)',
  body: [
    'Esta é uma resposta de demonstração gerada na sua máquina.',
    '',
    '- Corrige o travamento ao salvar um mapa grande',
    '- Exportação para Godot mostra o progresso por arquivo',
    '- Ajuste no contraste dos botões desativados',
    '',
    'A versão 1.0.1 não existe de verdade: este texto vem do servidor local.'
  ].join('\n'),
  html_url: `${repository}/releases`,
  published_at: new Date().toISOString(),
  assets: [
    {
      name: 'PixelStrikeStudio-Setup-1.0.1.exe',
      // Link real do instalador publicado, para o botão não levar a lugar nenhum
      // quebrado. O arquivo baixado é o 1.0.0, porque a 1.0.1 é só demonstração.
      browser_download_url: `${repository}/releases/download/v1.0.0/PixelStrikeStudio-Setup-1.0.0.exe`,
      size: 124822384
    }
  ]
}

const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(release, null, 2))
})

server.listen(port, '127.0.0.1', () => {
  console.log(`[demo] servidor de atualização falsa em http://127.0.0.1:${port}/releases/latest`)
  console.log('[demo] versão anunciada: 1.0.1 · nada foi publicado no GitHub')
})
