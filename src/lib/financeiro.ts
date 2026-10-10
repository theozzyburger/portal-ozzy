import type { CentroCusto, ContaContabil, ContaPagar, FormaPagamento } from './types'
import { FORMAS_PAGAMENTO } from './types'
import { addDias, hoje } from './datas'

// Formato de dinheiro único do portal (casas = 0 para valores redondos em painéis).
export const reais = (n: number, casas = 2) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: casas })
// Número digitado, a regra única do portal (revisão de 10/10; antes cada tela lia de um jeito):
// com vírgula é o jeito brasileiro ("1.234,56"); sem vírgula, "1.500" (pontos de milhar) é mil e quinhentos e
// "0.5" é meio. Vazio vira null; texto que não é número vira NaN (lerValor devolve null nesse caso).
export const lerNumero = (s: string | null | undefined): number | null => {
  const t = (s ?? '').trim().replace(/\s/g, '').replace(/^R\$/i, '')
  if (!t) return null
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.'))
  if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ''))
  return Number(t)
}
export const lerValor = (s: string) => {
  const n = lerNumero(s)
  return n !== null && Number.isFinite(n) ? n : null
}
export const mostrarValor = (n: number | null | undefined) => (n === null || n === undefined ? '' : n.toFixed(2).replace('.', ','))
export const mostrarQtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
export const r2 = (n: number) => Math.round(n * 100) / 100

// "Parque São Domingos", "Vila Anastácio", "Pizza", "Central de Produção", "Eventos".
export const nomeCentro = (c: Pick<CentroCusto, 'nome'> | undefined) =>
  (c?.nome ?? '').replace(/^The Ozzy Burger /, '').replace(/^The Ozzy /, '')

export const nomeForma = (f: FormaPagamento) => FORMAS_PAGAMENTO.find((x) => x.valor === f)?.nome ?? f

// Contas de lançamento: as filhas, e as mães que não têm filhas (Taxa de Entrega, Juros, Multas).
export function contasLancaveis(plano: ContaContabil[]) {
  const temFilha = new Set(plano.map((c) => c.paiCodigo).filter(Boolean))
  return plano.filter((c) => c.ativo && !temFilha.has(c.codigo))
}
export const nomeConta = (plano: ContaContabil[], id: string | null) => {
  const c = plano.find((x) => x.id === id)
  return c ? `${c.codigo} ${c.nome}` : 'Sem conta'
}
// Grupos para o <select>: mãe como título, filhas como opções.
export function gruposDoPlano(plano: ContaContabil[]) {
  const lancaveis = new Set(contasLancaveis(plano).map((c) => c.id))
  const maes = plano.filter((c) => !c.paiCodigo).sort((a, b) => a.ordem - b.ordem)
  return maes.map((m) => ({
    mae: m,
    contas: (lancaveis.has(m.id) ? [m] : []).concat(plano.filter((c) => c.paiCodigo === m.codigo && lancaveis.has(c.id)).sort((a, b) => a.ordem - b.ordem)),
  })).filter((g) => g.contas.length)
}

export type SituacaoConta = 'paga' | 'vencida' | 'hoje' | 'semana' | 'depois'
export function situacao(c: Pick<ContaPagar, 'pagoEm' | 'vencimento'>): SituacaoConta {
  if (c.pagoEm) return 'paga'
  const h = hoje()
  if (c.vencimento < h) return 'vencida'
  if (c.vencimento === h) return 'hoje'
  if (c.vencimento <= addDias(h, 7)) return 'semana'
  return 'depois'
}

// Mês seguinte mantendo o dia (31/01 vira 28/02).
export function somarMeses(data: string, n: number) {
  const [a, m, d] = data.split('-').map(Number)
  const alvo = new Date(Date.UTC(a, m - 1 + n, 1))
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  alvo.setUTCDate(Math.min(d, ultimo))
  return alvo.toISOString().slice(0, 10)
}

// Divide um valor em n parcelas; a diferença dos centavos vai na última.
export function dividir(total: number, n: number) {
  const base = Math.floor((total / n) * 100) / 100
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? r2(total - base * (n - 1)) : base))
}
