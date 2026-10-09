import type { ContaPagar, Fornecedor, MovimentoExtrato } from './types'
import { chaveExtrato } from './ofx'

const dias = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000)
const palavras = (s: string) => new Set(chaveExtrato(s).split(' ').filter((p) => p.length >= 4))

// Contas que podem ser este pagamento: mesmo valor (centavos) e data perto do vencimento (ou do pagamento já registrado).
// Pontos: quanto mais perto a data, melhor; nome do fornecedor no texto do extrato ajuda.
export function candidatas(m: MovimentoExtrato, contas: ContaPagar[], fornecedores: Fornecedor[], usadas: Set<string>) {
  if (m.valor >= 0) return []
  const valor = -m.valor
  const doExtrato = palavras(m.descricao)
  return contas
    .filter((c) => !c.conciliado && !usadas.has(c.id))
    .map((c) => {
      const alvo = c.valorPago ?? c.valor
      const ref = c.pagoEm ?? c.vencimento
      const distancia = Math.abs(dias(m.data, ref))
      const nome = fornecedores.find((f) => f.id === c.fornecedorId)?.nome ?? c.favorecido ?? ''
      const nomeBate = [...palavras(nome)].some((p) => doExtrato.has(p))
      const exato = Math.abs(alvo - valor) < 0.01
      return { conta: c, distancia, nomeBate, exato, pontos: (exato ? 0 : 50) + distancia - (nomeBate ? 5 : 0) }
    })
    .filter((x) => (x.exato && x.distancia <= 10) || (Math.abs((x.conta.valorPago ?? x.conta.valor) - valor) / valor <= 0.1 && x.distancia <= 40))
    .sort((a, b) => a.pontos - b.pontos)
}

// Sugestões automáticas: só valor exato e data até 10 dias, cada conta para um movimento só (o mais próximo).
export function sugestoes(movs: MovimentoExtrato[], contas: ContaPagar[], fornecedores: Fornecedor[]) {
  const pares: { mov: MovimentoExtrato; conta: ContaPagar; pontos: number }[] = []
  const usadas = new Set(movs.map((m) => m.contaPagarId).filter((x): x is string => !!x))
  for (const m of movs) {
    if (m.status !== 'pendente') continue
    for (const c of candidatas(m, contas, fornecedores, usadas)) if (c.exato && c.distancia <= 10) pares.push({ mov: m, conta: c.conta, pontos: c.pontos })
  }
  pares.sort((a, b) => a.pontos - b.pontos)
  const porMov = new Map<string, ContaPagar>()
  const tomadas = new Set<string>()
  for (const p of pares) {
    if (porMov.has(p.mov.id) || tomadas.has(p.conta.id)) continue
    porMov.set(p.mov.id, p.conta)
    tomadas.add(p.conta.id)
  }
  return porMov
}

// Lotes (fatura do cartão, Pix em lote dos salários, diárias): várias contas saem num débito só.
export interface GrupoLote { lote: string; contas: ContaPagar[]; total: number; vencimento: string }

export function gruposLote(contas: ContaPagar[], usadas: Set<string> = new Set()) {
  const mapa = new Map<string, ContaPagar[]>()
  for (const c of contas) {
    if (!c.lote || c.conciliado || usadas.has(c.id)) continue
    mapa.set(c.lote, [...(mapa.get(c.lote) ?? []), c])
  }
  return [...mapa.entries()].map(([lote, cs]): GrupoLote => ({
    lote,
    contas: cs,
    total: Math.round(cs.reduce((s, c) => s + (c.valorPago ?? c.valor), 0) * 100) / 100,
    vencimento: cs.map((c) => c.vencimento).sort()[0],
  }))
}

export function nomeLote(lote: string) {
  const [tipo, a, b] = lote.split(':')
  if (tipo === 'cartao') return `Fatura do cartão de ${a.split('-').reverse().join('/')}`
  if (tipo === 'sal') return `${b === 'adiantamento' ? 'Adiantamentos' : 'Salários'} de ${a}`
  if (tipo === 'freela') return `Diárias de freelancers da semana de ${a.split('-').reverse().join('/')}`
  if (tipo === 'freelaev') return 'Diárias de freelancers do evento'
  return lote
}

// Lotes perto do valor do débito: exato (diferença zero) ou até 5% a menos (sobra vira diferença: juros, tarifa).
export function lotesPara(m: MovimentoExtrato, grupos: GrupoLote[]) {
  if (m.valor >= 0) return []
  const valor = -m.valor
  return grupos
    .map((g) => ({ grupo: g, diferenca: Math.round((valor - g.total) * 100) / 100, distancia: Math.abs(dias(m.data, g.vencimento)) }))
    .filter((x) => x.diferenca >= 0 && x.diferenca <= valor * 0.05 && x.distancia <= 10)
    .sort((a, b) => a.diferenca - b.diferenca || a.distancia - b.distancia)
}

// Sugestões de lote: só soma exata.
export function sugestoesLote(movs: MovimentoExtrato[], contas: ContaPagar[], jaSugeridas: Set<string>) {
  const grupos = gruposLote(contas, jaSugeridas)
  const porMov = new Map<string, GrupoLote>()
  const tomados = new Set<string>()
  for (const m of movs) {
    if (m.status !== 'pendente') continue
    const x = lotesPara(m, grupos).find((l) => l.diferenca === 0 && !tomados.has(l.grupo.lote))
    if (x) { porMov.set(m.id, x.grupo); tomados.add(x.grupo.lote) }
  }
  return porMov
}
