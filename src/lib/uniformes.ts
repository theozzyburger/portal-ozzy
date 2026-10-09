import { TAMANHOS_CALCA, TAMANHOS_CALCADO, TAMANHOS_CAMISETA, type Funcionario, type ItemPedidoUniforme, type Modelagem, type MovimentoUniforme, type VarianteUniforme } from './types'

// Padrão da casa (07/10): supervisores (e quem está acima) usam camiseta branca; funcionários, preta.
// Modelagem feminina ou masculina conforme o sexo do cadastro. Tudo pode ser trocado na linha do pedido.
export function corCamiseta(p: Pick<Funcionario, 'nivel' | 'cargo'>) {
  const operacional = p.nivel === 'funcionario' || p.nivel === 'manutencao'
  return operacional && !/supervisor/i.test(p.cargo) ? 'Preta' : 'Branca'
}
export const modelagemDe = (p: Pick<Funcionario, 'sexo'>): Modelagem => (p.sexo === 'feminino' ? 'feminina' : p.sexo === 'masculino' ? 'masculina' : 'unissex')

export const CORES_CAMISETA = ['Preta', 'Branca']

// Peças que entram num pedido de compra, com o tamanho que vem do cadastro.
export interface Peca {
  item: string
  tamanho: (p: Funcionario) => string | null
  cor?: boolean
  modelagem?: boolean
}
export const PECAS: Peca[] = [
  { item: 'Camiseta', tamanho: (p) => p.tamCamiseta ?? null, cor: true, modelagem: true },
  { item: 'Calça', tamanho: (p) => p.tamCalca ?? null, modelagem: true },
  { item: 'Sapato', tamanho: (p) => (p.tamCalcado ? String(p.tamCalcado) : null) },
  { item: 'Avental', tamanho: () => 'Único' },
  { item: 'Boné', tamanho: () => 'Único' },
]

const NOME_MODELAGEM: Record<Modelagem, string> = { feminina: 'feminina', masculina: 'masculina', unissex: 'unissex' }

export const descricaoPeca = (i: Pick<ItemPedidoUniforme, 'item' | 'cor' | 'modelagem' | 'tamanho'>) =>
  [i.item, i.cor?.toLowerCase(), i.modelagem && i.modelagem !== 'unissex' ? NOME_MODELAGEM[i.modelagem] : null].filter(Boolean).join(' ') +
  (i.tamanho ? ` ${i.tamanho}` : ' (sem tamanho)')

// O que o fornecedor precisa: quantidade por peça, cor, modelagem e tamanho.
export function consolidado(itens: ItemPedidoUniforme[]) {
  const mapa = new Map<string, { item: string; cor: string | null; modelagem: Modelagem | null; tamanho: string | null; quantidade: number }>()
  for (const i of itens) {
    const chave = [i.item, i.cor, i.modelagem, i.tamanho].join('|')
    const atual = mapa.get(chave)
    if (atual) atual.quantidade += i.quantidade
    else mapa.set(chave, { item: i.item, cor: i.cor, modelagem: i.modelagem, tamanho: i.tamanho, quantidade: i.quantidade })
  }
  const ordemTam = (t: string | null) => {
    const n = Number(t)
    if (!Number.isNaN(n) && t) return n
    const i = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'].indexOf(t ?? '')
    return i >= 0 ? i : 999
  }
  return [...mapa.values()].sort(
    (a, b) => a.item.localeCompare(b.item) || (a.cor ?? '').localeCompare(b.cor ?? '') || (a.modelagem ?? '').localeCompare(b.modelagem ?? '') || ordemTam(a.tamanho) - ordemTam(b.tamanho),
  )
}

// ---------- Estoque (09/10) ----------

// Linhas e tamanhos da grade do estoque. Camiseta por cor e modelagem; calça por modelagem.
export interface GradePeca {
  item: string
  tamanhos: string[]
  linhas: { cor: string | null; modelagem: Modelagem | null }[]
}
export const GRADE: GradePeca[] = [
  {
    item: 'Camiseta', tamanhos: TAMANHOS_CAMISETA,
    linhas: CORES_CAMISETA.flatMap((cor) => (['feminina', 'masculina'] as const).map((modelagem) => ({ cor, modelagem }))),
  },
  { item: 'Calça', tamanhos: TAMANHOS_CALCA, linhas: [{ cor: null, modelagem: 'feminina' }, { cor: null, modelagem: 'masculina' }] },
  { item: 'Sapato', tamanhos: TAMANHOS_CALCADO.map(String), linhas: [{ cor: null, modelagem: null }] },
  { item: 'Avental', tamanhos: ['Único'], linhas: [{ cor: null, modelagem: null }] },
  { item: 'Boné', tamanhos: ['Único'], linhas: [{ cor: null, modelagem: null }] },
]

export const chaveVariante = (v: VarianteUniforme) => [v.item, v.cor ?? '', v.modelagem ?? '', v.tamanho].join('|')
export const nomeLinha = (l: { cor: string | null; modelagem: Modelagem | null }) =>
  [l.cor, l.modelagem && l.modelagem !== 'unissex' ? l.modelagem : l.modelagem ? 'unissex' : null].filter(Boolean).join(' ') || ''
export const descricaoVariante = (v: VarianteUniforme) =>
  [v.item, v.cor?.toLowerCase(), v.modelagem && v.modelagem !== 'unissex' ? v.modelagem : null].filter(Boolean).join(' ') + (v.tamanho !== 'Único' ? ` ${v.tamanho}` : '')

// Saldo de cada peça: a última contagem vale como ponto de partida e os movimentos depois dela somam ou tiram.
export function saldosUniforme(movs: MovimentoUniforme[]) {
  const saldo = new Map<string, number>()
  for (const m of [...movs].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))) {
    const k = chaveVariante(m)
    saldo.set(k, m.tipo === 'contagem' ? m.quantidade : (saldo.get(k) ?? 0) + m.quantidade)
  }
  return saldo
}

const simples = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

// Item escrito na entrega ("Camiseta preta", "Calça") → peça do estoque, com a modelagem pelo sexo da pessoa.
// Peças fora da grade (dólmã, luva…) contam no estoque com o nome como foi escrito.
export function varianteDaEntrega(texto: string, tamanho: string | undefined, p: Funcionario): VarianteUniforme | null {
  const t = simples(texto)
  if (!t) return null
  const g = GRADE.find((x) => t.startsWith(simples(x.item)) || (x.item === 'Boné' && t.startsWith('bone')))
  if (!g) return { item: texto.trim(), cor: null, modelagem: null, tamanho: tamanho?.trim() || 'Único' }
  const tam = g.tamanhos.length === 1 ? 'Único' : tamanho?.trim().toUpperCase()
  if (!tam || !g.tamanhos.includes(tam)) return null
  const cor = g.item === 'Camiseta' ? (t.includes('branca') ? 'Branca' : t.includes('preta') ? 'Preta' : corCamiseta(p)) : null
  const mod = g.linhas.some((l) => l.modelagem) ? modelagemDe(p) : null
  return { item: g.item, cor, modelagem: mod, tamanho: tam }
}
