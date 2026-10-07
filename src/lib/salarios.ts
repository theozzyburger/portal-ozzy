import { addMeses, mesDe } from './datas'
import type { Funcionario, Salario, TipoPagamento } from './types'

export const PCT_VT = 0.06

// Dois pagamentos por mês de referência: adiantamento no dia 20 e salário no dia 05 do mês seguinte.
export interface Pagamento {
  tipo: TipoPagamento
  mes: string
}

export const nomeTipo = (t: TipoPagamento) => (t === 'adiantamento' ? 'Adiantamento' : 'Salário')
export const dataPagamento = (p: Pagamento) => (p.tipo === 'adiantamento' ? `${p.mes}-20` : `${addMeses(p.mes, 1)}-05`)
export const diaMes = (data: string) => data.slice(8, 10) + '/' + data.slice(5, 7)

export const proximo = (p: Pagamento): Pagamento =>
  p.tipo === 'adiantamento' ? { tipo: 'salario', mes: p.mes } : { tipo: 'adiantamento', mes: addMeses(p.mes, 1) }
export const anterior = (p: Pagamento): Pagamento =>
  p.tipo === 'salario' ? { tipo: 'adiantamento', mes: p.mes } : { tipo: 'salario', mes: addMeses(p.mes, -1) }

// O próximo pagamento a partir de hoje (inclusive).
export function proximoPagamento(hoje: string): Pagamento {
  let p: Pagamento = { tipo: 'salario', mes: addMeses(mesDe(hoje), -2) }
  while (dataPagamento(p) < hoje) p = proximo(p)
  return p
}

type Campo = { campo: CampoValor; nome: string }
export type CampoValor =
  | 'salario' | 'caixinha' | 'bonusCaixinha' | 'bonusConclui'
  | 'descAdiantamento' | 'descFaltas' | 'descAtrasos' | 'inss' | 'descVt'

// No adiantamento, o valor fica no campo "salario".
export const creditosDe = (t: TipoPagamento): Campo[] =>
  t === 'adiantamento'
    ? [{ campo: 'salario', nome: 'Adiantamento' }]
    : [
        { campo: 'salario', nome: 'Salário' },
        { campo: 'caixinha', nome: 'Caixinha' },
        { campo: 'bonusCaixinha', nome: 'Bônus da caixinha' },
        { campo: 'bonusConclui', nome: 'Bônus Conclui' },
      ]

export const descontosDe = (t: TipoPagamento): Campo[] =>
  t === 'adiantamento'
    ? []
    : [
        { campo: 'descAdiantamento', nome: 'Adiantamento (dia 20)' },
        { campo: 'descFaltas', nome: 'Faltas' },
        { campo: 'descAtrasos', nome: 'Atrasos' },
        { campo: 'inss', nome: 'INSS' },
        { campo: 'descVt', nome: 'Vale-transporte (6%)' },
      ]

export const totalCreditos = (s: Salario) => creditosDe(s.tipo).reduce((t, c) => t + s[c.campo], 0)
export const totalDescontos = (s: Salario) => descontosDe(s.tipo).reduce((t, c) => t + s[c.campo], 0)
export const liquido = (s: Salario) => Math.round((totalCreditos(s) - totalDescontos(s)) * 100) / 100

export const vtDe = (salario: number) => Math.round(salario * PCT_VT * 100) / 100

export const salarioVazio = (p: Funcionario, pg: Pagamento): Salario => ({
  funcionarioId: p.id, mes: pg.mes, tipo: pg.tipo, salario: 0, caixinha: 0, bonusCaixinha: 0, bonusConclui: 0, descAdiantamento: 0,
  descFaltas: 0, descAtrasos: 0, inss: 0, descVt: 0, observacao: null, liberado: false,
})

// CSV com ";" e vírgula decimal, que o Excel em português abre direto.
const celula = (v: string | number) => {
  const t = typeof v === 'number' ? v.toFixed(2).replace('.', ',') : v
  return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}
export const csv = (linhas: (string | number)[][]) => '﻿' + linhas.map((l) => l.map(celula).join(';')).join('\r\n')

export function baixar(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
