import type { BrowserWindow } from 'electron'

/**
 * Teste automático do aplicativo (--smoke-test).
 *
 * Executa o código real dentro da janela: preload, IPC, validação de argumentos,
 * SQLite, sistema de arquivos e interface React. Usa uma pasta temporária como
 * `userData` (ver index.ts), então não toca nos dados do usuário.
 *
 * Fase 1: renderização, criação de projeto, backup, gerenciador de arquivos e
 *         estado inicial da integração com a Godot.
 * Fase 2: a janela é recarregada (como um reinício) e conferimos que o projeto
 *         continua aberto, que a página de arquivos lista as pastas e que a
 *         remoção segura funciona.
 */

const PHASE_ONE = `(async () => {
  const info = {
    title: document.title,
    chars: document.body.innerText.trim().length,
    hasRoot: Boolean(document.querySelector('#root')?.firstElementChild),
    projects: -1,
    created: '',
    createdId: '',
    backups: -1,
    dbPath: '',
    raizItens: 0,
    manifestoLegivel: false,
    godotSemVinculo: false,
    spritePreview: false,
    spriteImagens: 0,
    spriteSalvo: false,
    animQuadros: 0,
    animFolha: false,
    animSalva: false,
    mapaImagem: false,
    mapaZonas: 0,
    mapaSalvo: false,
    armaIcone: false,
    armaRaridades: 0,
    armaSalva: false,
    efeitoQuadros: 0,
    efeitoSalvo: false,
    skillIcone: false,
    skillSalva: false
  }

  try {
    const paths = await window.studio.app.paths()
    info.dbPath = paths.dbPath

    const created = await window.studio.projects.create({ name: 'Teste de fumaça' })
    info.created = created.path
    info.createdId = created.id
    await window.studio.projects.backup(created.id, 'Backup automático de teste')
    info.projects = (await window.studio.projects.list()).length
    info.backups = (await window.studio.projects.listBackups(created.id)).length

    info.raizItens = (await window.studio.files.list(created.id, '')).length
    await window.studio.files.createFolder(created.id, '', 'pasta-de-teste')
    const manifesto = await window.studio.files.preview(created.id, 'projeto.json')
    info.manifestoLegivel = (manifesto.text ?? '').includes('Pixel Strike')

    const godot = await window.studio.godot.state(created.id)
    info.godotSemVinculo = godot.link === null && godot.info === null

    const spec = {
      category: 'personagem',
      name: 'Sprite de teste',
      description: 'soldado do deserto',
      role: 'soldado',
      archetype: 'humanoide',
      size: 32,
      paletteId: 'militar',
      palette: {
        pele: '#c98d63',
        cabelo: '#3a2a1d',
        roupa: '#4a5d3a',
        detalhe: '#2f3b25',
        calca: '#3c4a30',
        bota: '#22261c',
        contorno: '#141a12'
      },
      seed: 5,
      equipment: 'rifle',
      directions: ['frente', 'costas', 'esquerda', 'direita'],
      stats: { vida: 100, dano: 10, velocidade: 90, alcance: 200 },
      abilities: [],
      drops: []
    }

    const preview = await window.studio.characters.preview(spec)
    info.spritePreview = String(preview.frente ?? '').startsWith('data:image/png;base64,')
    const asset = await window.studio.characters.save(created.id, spec)
    info.spriteImagens = asset.images.length
    info.spriteSalvo = (await window.studio.characters.list(created.id, 'personagem')).length === 1

    const animConfig = {
      characterId: asset.id,
      name: 'Sprite de teste Andando',
      kind: 'walk',
      direction: 'frente',
      fps: 8,
      loop: true,
      frames: Array.from({ length: 6 }, () => ({ hold: 1 }))
    }
    const animPreview = await window.studio.animations.preview(animConfig)
    info.animQuadros = animPreview.frames.length
    info.animFolha = String(animPreview.sheet).startsWith('data:image/png;base64,')
    await window.studio.animations.save(created.id, animConfig)
    info.animSalva = (await window.studio.animations.list(created.id)).length === 1

    const proposta = await window.studio.maps.propose({
      name: 'Mapa de teste',
      description: 'arena militar abandonada com pátio central',
      themeId: 'auto',
      width: 24,
      height: 16,
      tileSize: 16,
      seed: 3
    })
    const mapaPreview = await window.studio.maps.preview(proposta)
    info.mapaImagem = String(mapaPreview.image).startsWith('data:image/png;base64,')
    info.mapaZonas = proposta.zones.length
    await window.studio.maps.save(created.id, proposta)
    info.mapaSalvo = (await window.studio.maps.list(created.id)).length === 1

    const armaSpec = {
      baseId: 'ak47',
      name: 'Skin de teste',
      rarity: 'dourado',
      wear: 'testada',
      float: 0.2,
      pattern: 'camuflado',
      colors: { primaria: '#4d7c0f', secundaria: '#1f2937' },
      seed: 4,
      size: 32
    }
    const armaPreview = await window.studio.weapons.preview(armaSpec)
    info.armaIcone = String(armaPreview.icon).startsWith('data:image/png;base64,')
    const armaComparacao = await window.studio.weapons.compare(armaSpec)
    info.armaRaridades = armaComparacao.columns
    await window.studio.weapons.save(created.id, armaSpec)
    info.armaSalva = (await window.studio.weapons.list(created.id)).length === 1

    const efeitoSpec = {
      kind: 'explosao',
      name: 'Efeito de teste',
      colors: { primaria: '#fbbf24', secundaria: '#b91c1c' },
      size: 32,
      frames: 4,
      fps: 12,
      seed: 6
    }
    const efeitoPreview = await window.studio.effects.preview(efeitoSpec)
    info.efeitoQuadros = efeitoPreview.frames.length
    await window.studio.effects.save(created.id, efeitoSpec)
    info.efeitoSalvo = (await window.studio.effects.list(created.id)).length === 1

    const skillSpec = {
      name: 'Habilidade de teste',
      description: 'granada de fumaça que dura 8 segundos',
      kind: 'utilitaria',
      effectKind: 'fumaca',
      params: { dano: 0, alcance: 120, raio: 80, duracao: 8, recarga: 14, custo: 45, velocidade: 0 },
      colors: { primaria: '#9ca3af', secundaria: '#4b5563' },
      seed: 12
    }
    const skillPreview = await window.studio.skills.preview(skillSpec)
    info.skillIcone = String(skillPreview.icon).startsWith('data:image/png;base64,')
    await window.studio.skills.save(created.id, skillSpec)
    info.skillSalva = (await window.studio.skills.list(created.id)).length === 1

    await window.studio.settings.update({ onboardingDone: true })
  } catch (error) {
    info.error = String(error && error.message ? error.message : error)
  }

  return info
})()`

function phaseTwoScript(projectId: string): string {
  return `(async () => {
    const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    const info = {
      panel: false,
      sidebar: false,
      filesNavFound: false,
      filesPage: false,
      filesListed: false,
      godotPage: false,
      characterPage: false,
      spriteImages: 0,
      animationPage: false,
      mapPage: false,
      weaponPage: false,
      effectPage: false,
      skillPage: false,
      removed: false
    }

    await esperar(1500)
    const initial = document.body.innerText
    info.panel = initial.includes('Painel')
    info.sidebar = initial.includes('Gerador de Personagens')

    const nav = [...document.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Arquivos do projeto'
    )
    info.filesNavFound = Boolean(nav)
    nav?.click()
    await esperar(1500)

    const filesText = document.body.innerText
    info.filesPage = filesText.includes('Raiz do projeto')
    info.filesListed = filesText.includes('personagens')

    const godotNav = [...document.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Integração com Godot 4'
    )
    godotNav?.click()
    await esperar(1200)
    const godotText = document.body.innerText
    info.godotPage =
      godotText.includes('Escolha a pasta do seu projeto Godot 4') ||
      godotText.includes('O que existe no projeto Godot')

    const charNav = [...document.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Gerador de Personagens'
    )
    charNav?.click()
    await esperar(1800)
    const charText = document.body.innerText
    info.characterPage =
      charText.includes('Gerador de personagens') && charText.includes('Salvar no projeto')
    info.spriteImages = document.querySelectorAll('img').length

    const animNav = [...document.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Editor de Animações'
    )
    animNav?.click()
    await esperar(2200)
    const animText = document.body.innerText
    info.animationPage =
      animText.includes('Linha do tempo') && animText.includes('Animações salvas')

    const mapNav = [...document.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Construtor de Mapas'
    )
    mapNav?.click()
    await esperar(2200)
    const mapText = document.body.innerText
    info.mapPage =
      mapText.includes('Grade do mapa') && mapText.includes('Mapas salvos')

    const weaponNav = [...document.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Armas e Skins'
    )
    weaponNav?.click()
    await esperar(2200)
    const weaponText = document.body.innerText
    info.weaponPage =
      weaponText.includes('Ícone da skin') && weaponText.includes('Skins salvas')

    const effectNav = [...document.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Efeitos Visuais e Sonoros'
    )
    effectNav?.click()
    await esperar(2000)
    const effectText = document.body.innerText
    info.effectPage =
      effectText.includes('Prévia animada') && effectText.includes('Efeitos salvos')

    const skillNav = [...document.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Skills e Habilidades'
    )
    skillNav?.click()
    await esperar(2000)
    const skillText = document.body.innerText
    info.skillPage =
      skillText.includes('Parâmetros') && skillText.includes('Habilidades salvas')

    await window.studio.projects.remove(${JSON.stringify(projectId)}, true)
    info.removed = (await window.studio.projects.list()).length === 0
    return info
  })()`
}

type Report = Record<string, unknown>

export interface SmokeOutcome {
  ok: boolean
  detail: string
}

export async function runSmokeTest(window: BrowserWindow): Promise<SmokeOutcome> {
  const phaseOne = (await window.webContents.executeJavaScript(PHASE_ONE)) as Report

  if (!phaseOne['hasRoot'] || (phaseOne['chars'] as number) < 80) {
    return { ok: false, detail: `interface sem conteúdo: ${JSON.stringify(phaseOne)}` }
  }
  if (phaseOne['error']) {
    return {
      ok: false,
      detail: `falha na comunicação com o núcleo: ${String(phaseOne['error'])}`
    }
  }
  if (phaseOne['projects'] !== 1 || phaseOne['backups'] !== 1) {
    return {
      ok: false,
      detail: `projeto/backup não confirmados: ${JSON.stringify(phaseOne)}`
    }
  }
  if ((phaseOne['raizItens'] as number) < 10 || !phaseOne['manifestoLegivel']) {
    return {
      ok: false,
      detail: `gerenciador de arquivos falhou: ${JSON.stringify(phaseOne)}`
    }
  }
  if (!phaseOne['godotSemVinculo']) {
    return {
      ok: false,
      detail: `estado inicial da Godot inesperado: ${JSON.stringify(phaseOne)}`
    }
  }
  if (!phaseOne['spritePreview'] || phaseOne['spriteImagens'] !== 4 || !phaseOne['spriteSalvo']) {
    return { ok: false, detail: `gerador de sprites falhou: ${JSON.stringify(phaseOne)}` }
  }
  if (phaseOne['animQuadros'] !== 6 || !phaseOne['animFolha'] || !phaseOne['animSalva']) {
    return { ok: false, detail: `editor de animações falhou: ${JSON.stringify(phaseOne)}` }
  }
  if (!phaseOne['mapaImagem'] || (phaseOne['mapaZonas'] as number) < 3 || !phaseOne['mapaSalvo']) {
    return { ok: false, detail: `construtor de mapas falhou: ${JSON.stringify(phaseOne)}` }
  }
  if (
    !phaseOne['armaIcone'] ||
    phaseOne['armaRaridades'] !== 6 ||
    !phaseOne['armaSalva']
  ) {
    return { ok: false, detail: `editor de armas falhou: ${JSON.stringify(phaseOne)}` }
  }
  if (
    phaseOne['efeitoQuadros'] !== 4 ||
    !phaseOne['efeitoSalvo'] ||
    !phaseOne['skillIcone'] ||
    !phaseOne['skillSalva']
  ) {
    return { ok: false, detail: `efeitos/habilidades falharam: ${JSON.stringify(phaseOne)}` }
  }

  const projectId = String(phaseOne['createdId'])

  const reloaded = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('a interface não recarregou')), 20_000)
    window.webContents.once('did-finish-load', () => {
      clearTimeout(timer)
      resolve()
    })
  })
  window.webContents.reload()
  await reloaded

  const phaseTwo = (await window.webContents.executeJavaScript(
    phaseTwoScript(projectId)
  )) as Report

  if (!phaseTwo['panel'] || !phaseTwo['sidebar']) {
    return { ok: false, detail: `o app não reabriu no painel: ${JSON.stringify(phaseTwo)}` }
  }
  if (!phaseTwo['filesNavFound'] || !phaseTwo['filesPage'] || !phaseTwo['filesListed']) {
    return { ok: false, detail: `a página de arquivos não abriu: ${JSON.stringify(phaseTwo)}` }
  }
  if (!phaseTwo['godotPage']) {
    return { ok: false, detail: `a página da Godot não abriu: ${JSON.stringify(phaseTwo)}` }
  }
  if (!phaseTwo['characterPage'] || (phaseTwo['spriteImages'] as number) < 1) {
    return {
      ok: false,
      detail: `a página de personagens não abriu: ${JSON.stringify(phaseTwo)}`
    }
  }
  if (!phaseTwo['animationPage']) {
    return { ok: false, detail: `a página de animações não abriu: ${JSON.stringify(phaseTwo)}` }
  }
  if (!phaseTwo['mapPage']) {
    return { ok: false, detail: `a página de mapas não abriu: ${JSON.stringify(phaseTwo)}` }
  }
  if (!phaseTwo['weaponPage']) {
    return { ok: false, detail: `a página de armas não abriu: ${JSON.stringify(phaseTwo)}` }
  }
  if (!phaseTwo['effectPage']) {
    return { ok: false, detail: `a página de efeitos não abriu: ${JSON.stringify(phaseTwo)}` }
  }
  if (!phaseTwo['skillPage']) {
    return { ok: false, detail: `a página de habilidades não abriu: ${JSON.stringify(phaseTwo)}` }
  }
  if (!phaseTwo['removed']) {
    return {
      ok: false,
      detail: `o projeto de teste não foi removido: ${JSON.stringify(phaseTwo)}`
    }
  }

  return {
    ok: true,
    detail:
      `interface renderizada (${phaseOne['chars']} caracteres), projeto criado em ` +
      `${phaseOne['created']}, backup registrado, arquivos, personagens, animações, mapas, armas, efeitos, habilidades e Godot ` +
      `respondendo, banco em ${phaseOne['dbPath']}`
  }
}
