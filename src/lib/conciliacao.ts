import type { CentroCusto, ContaContabil, ContaPagar, Fornecedor, Funcionario, MovimentoExtrato, PedidoCompra } from './types'
import { chaveExtrato, partesExtrato } from './ofx'

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
  if (tipo === 'moto') return `Motoboys pagos em ${a.split('-').reverse().join('/')}`
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

// Fornecedor que parece ser o do extrato (Heitor, 09/10). Nesta ordem:
// 1) o que já foi usado antes para o mesmo nome no extrato (aprende com as correções: "GAIVOTA" → Pama);
// 2) o CPF/CNPJ do texto; 3) o nome fantasia ou a razão social parecidos.
const SEM_PESO = new Set(['ltda', 'me', 'epp', 'eireli', 'sa', 'cia', 'de', 'da', 'do', 'das', 'dos', 'e', 'com', 'comercio', 'servicos', 'industria', 'pix', 'enviado'])
const palavrasNome = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !SEM_PESO.has(w))
export const chaveNomeExtrato = (descricao: string) => palavrasNome(partesExtrato(descricao).nome).join(' ')

// Nome no extrato → quem foi escolhido da última vez (das saídas já conciliadas): fornecedor, funcionário ou motoboy.
export function aprendidosDe(movs: MovimentoExtrato[], contas: ContaPagar[]) {
  const porId = new Map(contas.map((c) => [c.id, c]))
  const fornecedores = new Map<string, string>()
  const pessoas = new Map<string, string>()
  const motoboys = new Map<string, string>()
  for (const m of [...movs].sort((a, b) => a.data.localeCompare(b.data))) {
    if (m.status !== 'conciliado' || !m.contaPagarId) continue
    const c = porId.get(m.contaPagarId)
    const k = chaveNomeExtrato(m.descricao)
    if (!c || !k) continue
    const [mapa, id] = c.fornecedorId ? [fornecedores, c.fornecedorId] : c.funcionarioId ? [pessoas, c.funcionarioId] : c.motoboyId ? [motoboys, c.motoboyId] : [null, null]
    if (!mapa || !id) continue
    for (const x of [fornecedores, pessoas, motoboys]) x.delete(k)
    mapa.set(k, id)
  }
  return { fornecedores, pessoas, motoboys }
}
export type Aprendidos = ReturnType<typeof aprendidosDe>

const notaNome = (ext: string[], nome: string | null | undefined) => {
  const fw = palavrasNome(nome ?? '')
  if (!fw.length) return 0
  const bate = (w: string) => ext.some((e) => e === w || (e.length >= 4 && w.startsWith(e)) || (w.length >= 4 && e.startsWith(w)))
  // A primeira palavra tem que estar no extrato ("Distribuidora Exemplo" não vale para "IMOBILIARIA EXEMPLO").
  if (!bate(fw[0])) return 0
  return fw.filter(bate).length / Math.max(fw.length, Math.min(ext.length, 3))
}

type Parecivel = { id: string; nome: string; cnpj?: string | null; ativo: boolean; razaoSocial?: string | null }

// Nota de 0 a 3: 3 = usado da última vez para este nome, 2 = CPF/CNPJ igual, até 1 = nome parecido.
function parecidoComNota<F extends Parecivel>(descricao: string, itens: F[], aprendidos?: Map<string, string>): { item: F; nota: number } | null {
  const { nome, documento } = partesExtrato(descricao)
  const ativos = itens.filter((f) => f.ativo)
  const ext = palavrasNome(nome)
  const usado = aprendidos?.get(ext.join(' '))
  if (usado) {
    const f = ativos.find((x) => x.id === usado)
    if (f) return { item: f, nota: 3 }
  }
  const doc = documento?.replace(/\D/g, '')
  if (doc && doc.length >= 11) {
    const f = ativos.find((x) => x.cnpj?.replace(/\D/g, '') === doc)
    if (f) return { item: f, nota: 2 }
  }
  if (!ext.length) return null
  let melhor: F | null = null
  let nota = 0
  for (const f of ativos) {
    // Nome fantasia vale um pouco mais que a razão social no empate.
    const n = Math.max(notaNome(ext, f.nome) + 0.01, notaNome(ext, f.razaoSocial))
    if (n > nota) { nota = n; melhor = f }
  }
  return melhor && nota >= 0.5 ? { item: melhor, nota } : null
}

export function fornecedorParecido<F extends Pick<Fornecedor, 'id' | 'nome' | 'cnpj' | 'ativo' | 'razaoSocial'>>(
  descricao: string, fornecedores: F[], aprendidos?: Map<string, string>,
): F | null {
  return parecidoComNota(descricao, fornecedores, aprendidos)?.item ?? null
}

// Procura nas três listas juntas (Heitor, 09/10: "Ana Paula" é funcionária, não fornecedor) e fica com a nota maior.
// No empate ganha a pessoa (motoboy ou funcionário): nome de gente no extrato quase sempre é Pix para alguém da casa.
export type TipoQuem = 'fornecedor' | 'funcionario' | 'motoboy'
export function quemParece(
  descricao: string,
  listas: { fornecedores: Parecivel[]; pessoas: Parecivel[]; motoboys: Parecivel[] },
  aprendidos: Aprendidos,
): { tipo: TipoQuem; id: string; nome: string; aprendido: boolean } | null {
  const opcoes = [
    { tipo: 'motoboy' as const, r: parecidoComNota(descricao, listas.motoboys, aprendidos.motoboys) },
    { tipo: 'funcionario' as const, r: parecidoComNota(descricao, listas.pessoas, aprendidos.pessoas) },
    { tipo: 'fornecedor' as const, r: parecidoComNota(descricao, listas.fornecedores, aprendidos.fornecedores) },
  ]
  let melhor: (typeof opcoes)[number] | null = null
  for (const o of opcoes) if (o.r && (!melhor || o.r.nota > melhor.r!.nota + 0.011)) melhor = o
  return melhor?.r ? { tipo: melhor.tipo, id: melhor.r.item.id, nome: melhor.r.item.nome, aprendido: melhor.r.nota === 3 } : null
}

// Pagamento para funcionário (Heitor, 09/10): valor baixo (até R$ 400) é diária de freela; acima disso é salário,
// na conta do setor da pessoa. A loja vem do cadastro (Produção vai para a Central).
const CONTAS_SETOR: Record<string, { salario: string; freela: string }> = {
  cozinha: { salario: '2.6', freela: '2.4' },
  pizzaria: { salario: '2.6', freela: '2.4' },
  atendimento: { salario: '2.7', freela: '2.10' },
  producao: { salario: '2.8', freela: '2.11' },
  escritorio: { salario: '2.9', freela: '2.10' },
}
export const LIMITE_DIARIA = 400
export function sugestaoPessoal(
  p: Pick<Funcionario, 'setor' | 'unidadeId'>,
  valor: number,
  plano: Pick<ContaContabil, 'id' | 'codigo'>[],
  centros: Pick<CentroCusto, 'id'>[],
) {
  const freela = valor <= LIMITE_DIARIA
  const c = CONTAS_SETOR[p.setor ?? ''] ?? { salario: '2.1', freela: '2.4' }
  const conta = plano.find((x) => x.codigo === (freela ? c.freela : c.salario))?.id ?? ''
  const centro = p.setor === 'producao' && centros.some((x) => x.id === 'central') ? 'central' : centros.some((x) => x.id === p.unidadeId) ? p.unidadeId : ''
  return { conta, centro, tipo: freela ? ('Diária' as const) : ('Salário' as const) }
}

// Pedido de compra parecido com uma saída do banco (Heitor, 09/10: só sugestão). Vale o pedido feito antes do débito,
// até 60 dias depois da entrega, com valor igual (até 2% ou R$ 0,50 de diferença) e do fornecedor que o extrato parece,
// ou com valor exato quando não deu para saber o fornecedor. Pedido já lançado ("Pedido de compra #N" numa conta) sai.
export function pedidoParecido(
  m: { data: string; valor: number },
  pedidos: PedidoCompra[],
  contas: { descricao: string }[],
  fornecedorId: string | null,
): PedidoCompra | null {
  const valor = Math.abs(m.valor)
  const usados = new Set(contas.map((c) => /Pedido de compra #(\d+)/.exec(c.descricao)?.[1]).filter(Boolean))
  const limite = (p: PedidoCompra) => {
    const d = new Date(p.previsaoEntrega + 'T12:00:00')
    d.setDate(d.getDate() + 60)
    return d.toISOString().slice(0, 10)
  }
  const candidatos = pedidos.filter((p) =>
    (p.status === 'pedido' || p.status === 'recebido') && p.total > 0 && !usados.has(String(p.numero)) &&
    p.dataPedido <= m.data && m.data <= limite(p))
  const diferenca = (p: PedidoCompra) => Math.abs(p.total - valor)
  const doFornecedor = fornecedorId ? candidatos.filter((p) => p.fornecedorId === fornecedorId && diferenca(p) <= Math.max(0.5, p.total * 0.02)) : []
  const exatos = candidatos.filter((p) => diferenca(p) < 0.01)
  const lista = doFornecedor.length ? doFornecedor : exatos.length === 1 ? exatos : []
  return lista.sort((a, b) => diferenca(a) - diferenca(b))[0] ?? null
}
