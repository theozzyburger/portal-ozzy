import type { Funcionario, ItemPedidoUniforme, Modelagem } from './types'

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
