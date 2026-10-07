// Regulamento interno guardado como texto simples, em versões. A gestão publica uma versão nova
// pelo portal e todo mundo precisa assinar de novo. Formato do texto:
//   # Título            (opcional, primeira linha)
//   ## Seção            (cada seção vira um item do índice)
//   - item de lista
//   | coluna | coluna |  (tabela; a linha "| --- |" é opcional)
//   **negrito**
// Linhas em branco separam parágrafos.

export type Bloco =
  | { tipo: 'p'; texto: string }
  | { tipo: 'lista'; itens: string[] }
  | { tipo: 'tabela'; cabecalho: string[]; linhas: string[][] }

export interface Secao {
  id: string
  titulo: string
  blocos: Bloco[]
}

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const celulas = (linha: string) => linha.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
const separador = (linha: string) => /^\|?\s*:?-{3,}/.test(linha.trim())

export function lerRegulamento(texto: string): { titulo: string | null; secoes: Secao[] } {
  let titulo: string | null = null
  const secoes: Secao[] = []
  let atual: Secao | null = null
  let paragrafo: string[] = []
  const usados = new Set<string>()

  const secao = () => {
    if (!atual) {
      atual = { id: 'inicio', titulo: '', blocos: [] }
      secoes.push(atual)
    }
    return atual
  }
  const fecharParagrafo = () => {
    if (paragrafo.length) secao().blocos.push({ tipo: 'p', texto: paragrafo.join(' ') })
    paragrafo = []
  }

  for (const bruta of texto.replace(/\r/g, '').split('\n')) {
    const linha = bruta.trim()
    const ultimo = () => secao().blocos[secao().blocos.length - 1]
    if (!linha) {
      fecharParagrafo()
    } else if (/^#\s/.test(linha) && titulo === null && !secoes.length) {
      titulo = linha.replace(/^#\s+/, '')
    } else if (/^#{1,3}\s/.test(linha)) {
      fecharParagrafo()
      const t = linha.replace(/^#+\s+/, '')
      let id = slug(t) || 'secao'
      while (usados.has(id)) id += '-2'
      usados.add(id)
      atual = { id, titulo: t, blocos: [] }
      secoes.push(atual)
    } else if (/^[-*•]\s+/.test(linha)) {
      fecharParagrafo()
      const item = linha.replace(/^[-*•]\s+/, '')
      const u = ultimo()
      if (u?.tipo === 'lista') u.itens.push(item)
      else secao().blocos.push({ tipo: 'lista', itens: [item] })
    } else if (linha.startsWith('|')) {
      fecharParagrafo()
      if (separador(linha)) continue
      const u = ultimo()
      if (u?.tipo === 'tabela') u.linhas.push(celulas(linha))
      else secao().blocos.push({ tipo: 'tabela', cabecalho: celulas(linha), linhas: [] })
    } else {
      paragrafo.push(linha)
    }
  }
  fecharParagrafo()
  return { titulo, secoes: secoes.filter((s) => s.titulo || s.blocos.length) }
}

// O que mudou entre duas versões, por seção (comparando pelo título).
export function mudancas(anterior: string, nova: string) {
  const a = lerRegulamento(anterior).secoes
  const n = lerRegulamento(nova).secoes
  const chave = (s: Secao) => s.titulo.toLowerCase()
  const conteudo = (s: Secao) => JSON.stringify(s.blocos)
  return {
    novas: n.filter((s) => !a.some((x) => chave(x) === chave(s))).map((s) => s.titulo),
    alteradas: n.filter((s) => a.some((x) => chave(x) === chave(s) && conteudo(x) !== conteudo(s))).map((s) => s.titulo),
    removidas: a.filter((s) => !n.some((x) => chave(x) === chave(s))).map((s) => s.titulo),
  }
}

// Impressão digital do texto: prova qual versão exata a pessoa assinou.
export async function sha256(texto: string) {
  if (!globalThis.crypto?.subtle) return ''
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const termoRegulamento = (nome: string, numero: number, data: string) =>
  `Eu, ${nome}, declaro que li o Regulamento Interno da The Ozzy (versão ${numero}, publicada em ${data}), ` +
  `entendi as normas e me comprometo a cumpri-las.`
