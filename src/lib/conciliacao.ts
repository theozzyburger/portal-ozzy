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
