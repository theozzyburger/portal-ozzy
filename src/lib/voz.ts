import type { ChaveItem, ItemContagem } from './types'

// Contagem por voz (08/10): a pessoa fala "focaccia 20, mussarela 3 quilos e meio, coca 48" e a tela preenche
// as quantidades. O reconhecimento é o do próprio navegador (Chrome/Android e Safari/iPhone); nada é gravado,
// só o texto reconhecido, que fica junto da contagem para conferência.

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const normalizar = (s: string) =>
  semAcento(s.toLowerCase())
    .replace(/(\d)[.,](\d)/g, '$1#$2') // guarda a vírgula decimal
    .replace(/[,;.\n]+/g, ' | ') // pausa entre itens
    .replace(/[^a-z0-9#½| ]+/g, ' ')
    .replace(/#/g, ',')
    .split(/\s+/)
    .filter(Boolean)
const singular = (t: string) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t)
const igual = (a: string, b: string) => a === b || singular(a) === singular(b)

const UNIDADES: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quinhentos: 500,
  seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900, mil: 1000, zero: 0,
}
const valorPalavra = (t: string): number | null => {
  if (/^\d+(,\d+)?$/.test(t)) return Number(t.replace(',', '.'))
  if (t === 'meio' || t === 'meia' || t === '½') return 0.5
  return t in UNIDADES ? UNIDADES[t] : null
}

// Lê um número a partir da posição i ("vinte e cinco", "3 e meio", "1,5"). Devolve o valor e quantas palavras usou.
function lerNumero(t: string[], i: number): { valor: number; usadas: number } | null {
  let v = valorPalavra(t[i])
  if (v === null) return null
  let j = i + 1
  // "vinte e cinco", "cento e vinte", "dois e meio"
  while (t[j] === 'e' && j + 1 < t.length) {
    const prox = valorPalavra(t[j + 1])
    if (prox === null) break
    v = prox === 1000 ? v * 1000 : v + prox
    j += 2
  }
  if (t[j] === 'mil') {
    v *= 1000
    j++
  }
  return { valor: v, usadas: j - i }
}

const PESO_G = new Set(['grama', 'gramas', 'g', 'gr'])
const PESO_KG = new Set(['quilo', 'quilos', 'kg', 'kilo', 'kilos', 'k'])
const VOL_ML = new Set(['ml', 'mililitro', 'mililitros'])
const VOL_L = new Set(['litro', 'litros', 'l'])
const EMBALAGEM = new Set(['caixa', 'caixas', 'fardo', 'fardos', 'pacote', 'pacotes', 'balde', 'baldes', 'pote', 'potes', 'saco', 'sacos', 'lata', 'latas', 'galao', 'galoes'])
const LIGACAO = new Set(['de', 'do', 'da', 'e', 'com', 'tem', 'sobrou', 'sobraram', 'mais', 'ainda', 'so', 'tenho', 'temos'])

// Formas de chamar cada item: o nome inteiro, sem medidas ("2.55kg", "80g", "lata"), e as duas primeiras palavras.
const SEP = '|'
function apelidos(nome: string) {
  const t = normalizar(nome)
  const limpo = t.filter((x) => !/\d/.test(x) && !['lata', 'pacote', 'un', 'unidade', 'ml', 'kg', 'g'].includes(x))
  const r = [t, limpo]
  // Começos do nome ("creme de queijo" para "Creme de queijo (exemplo)"); só valem se forem de um item só.
  for (let n = limpo.length - 1; n >= 1; n--) if (n > 1 || limpo[0].length > 3) r.push(limpo.slice(0, n))
  return r.filter((a) => a.length)
}

export interface LidoPorVoz {
  chave: ChaveItem
  nome: string
  quantidade: number
  // Trecho que deu origem (para conferir).
  trecho: string
}

export function lerContagem(fala: string, itens: ItemContagem[]): { lidos: LidoPorVoz[]; naoEntendi: string[] } {
  const t = normalizar(fala)
  // Apelidos ambíguos (iguais para dois itens) não valem.
  const contagem = new Map<string, number>()
  const lista = itens.flatMap((it) => apelidos(it.nome).map((a) => ({ it, a })))
  for (const { a } of lista) contagem.set(a.map(singular).join(' '), (contagem.get(a.map(singular).join(' ')) ?? 0) + 1)
  const unicos = lista.filter(({ it, a }) => contagem.get(a.map(singular).join(' ')) === 1 || a.join(' ') === normalizar(it.nome).join(' '))
    .sort((x, y) => y.a.length - x.a.length)

  type Marca = { tipo: 'item'; it: ItemContagem; ini: number; fim: number } | { tipo: 'num'; valor: number; ini: number; fim: number }
  const marcas: Marca[] = []
  const usado = new Array(t.length).fill(false)
  for (const { it, a } of unicos)
    for (let i = 0; i + a.length <= t.length; i++)
      if (!usado.slice(i, i + a.length).some(Boolean) && a.every((p, k) => igual(p, t[i + k]))) {
        marcas.push({ tipo: 'item', it, ini: i, fim: i + a.length })
        for (let k = i; k < i + a.length; k++) usado[k] = true
      }
  for (let i = 0; i < t.length; i++) {
    if (usado[i]) continue
    const n = lerNumero(t, i)
    if (!n) continue
    let fim = i + n.usadas
    let valor = n.valor
    // Unidade falada logo depois do número.
    const u = t[fim]
    if (u && (PESO_G.has(u) || VOL_ML.has(u))) (valor /= 1000), fim++
    else if (u && (PESO_KG.has(u) || VOL_L.has(u) || u === 'unidade' || u === 'unidades' || u === 'un')) fim++
    // "3 quilos e meio"
    if (fim > i + n.usadas && t[fim] === 'e' && (t[fim + 1] === 'meio' || t[fim + 1] === 'meia')) (valor += 0.5), (fim += 2)
    else if (u && EMBALAGEM.has(u)) {
      marcas.push({ tipo: 'num', valor: -valor, ini: i, fim: fim + 1 }) // negativo = em embalagens; converte ao achar o item
      for (let k = i; k <= fim; k++) usado[k] = true
      i = fim
      continue
    }
    // "3 e meio quilos"
    marcas.push({ tipo: 'num', valor, ini: i, fim })
    for (let k = i; k < fim; k++) usado[k] = true
    i = fim - 1
  }
  marcas.sort((a, b) => a.ini - b.ini)

  const lidos = new Map<ChaveItem, LidoPorVoz>()
  const naoEntendi: string[] = []
  const valorPara = (it: ItemContagem, v: number) => (v < 0 ? -v * (it.embalagemQtd ?? 1) : v)
  // Primeiro o número logo depois do item ("mussarela 3"); depois o número logo antes ("3 quilos de mussarela").
  const par = new Map<number, number>() // índice do item -> índice do número
  const numUsado = new Set<number>()
  // "2 quilos de mussarela": número seguido de "de" + item é desse item.
  marcas.forEach((m, k) => {
    const prox = marcas[k + 1]
    if (m.tipo === 'num' && prox?.tipo === 'item' && prox.ini === m.fim + 1 && ['de', 'do', 'da'].includes(t[m.fim]))
      (par.set(k + 1, k), numUsado.add(k))
  })
  marcas.forEach((m, k) => {
    const prox = marcas[k + 1]
    if (m.tipo === 'item' && !par.has(k) && prox?.tipo === 'num' && !numUsado.has(k + 1) && !t.slice(m.fim, prox.ini).includes(SEP)) (par.set(k, k + 1), numUsado.add(k + 1))
  })
  marcas.forEach((m, k) => {
    const ant = marcas[k - 1]
    if (m.tipo === 'item' && !par.has(k) && ant?.tipo === 'num' && !numUsado.has(k - 1) && !t.slice(ant.fim, m.ini).includes(SEP)) (par.set(k, k - 1), numUsado.add(k - 1))
  })
  marcas.forEach((m, k) => {
    if (m.tipo === 'item') {
      const j = par.get(k)
      if (j === undefined) naoEntendi.push(`${m.it.nome} (sem quantidade)`)
      else {
        const n = marcas[j] as Extract<Marca, { tipo: 'num' }>
        lidos.set(m.it.chave, {
          chave: m.it.chave, nome: m.it.nome, quantidade: Math.round(valorPara(m.it, n.valor) * 1000) / 1000,
          trecho: t.slice(Math.min(m.ini, n.ini), Math.max(m.fim, n.fim)).join(' '),
        })
      }
    } else if (!numUsado.has(k)) naoEntendi.push(t.slice(m.ini, m.fim).join(' '))
  })
  // Palavras que não viraram item nem número.
  const sobras: string[] = []
  let atual: string[] = []
  t.forEach((p, i) => {
    if (usado[i] || LIGACAO.has(p) || p === SEP) {
      if (atual.length) sobras.push(atual.join(' '))
      atual = []
    } else atual.push(p)
  })
  if (atual.length) sobras.push(atual.join(' '))
  return { lidos: [...lidos.values()], naoEntendi: [...naoEntendi, ...sobras.filter((x) => !PESO_KG.has(x) && !VOL_L.has(x) && x.length > 1)] }
}

// Reconhecimento de fala do navegador (Web Speech API).
type Reconhecedor = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: (e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void
  onerror: (e: { error: string }) => void
  onend: () => void
  start: () => void
  stop: () => void
}
export function criarReconhecedor(): Reconhecedor | null {
  const w = window as unknown as { SpeechRecognition?: new () => Reconhecedor; webkitSpeechRecognition?: new () => Reconhecedor }
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition
  if (!C) return null
  const r = new C()
  r.lang = 'pt-BR'
  r.continuous = true
  r.interimResults = true
  return r
}
