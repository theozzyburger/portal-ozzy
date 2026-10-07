import type { Funcionario, Salario } from './types'

export const PCT_VT = 0.06

export const CREDITOS = [
  { campo: 'salario', nome: 'Salário' },
  { campo: 'caixinha', nome: 'Caixinha' },
  { campo: 'bonusCaixinha', nome: 'Bônus da caixinha' },
  { campo: 'bonusConclui', nome: 'Bônus Conclui' },
] as const

export const DESCONTOS = [
  { campo: 'descFaltas', nome: 'Faltas' },
  { campo: 'descAtrasos', nome: 'Atrasos' },
  { campo: 'inss', nome: 'INSS' },
  { campo: 'descVt', nome: 'Vale-transporte (6%)' },
] as const

export type CampoValor = (typeof CREDITOS)[number]['campo'] | (typeof DESCONTOS)[number]['campo']

export const totalCreditos = (s: Salario) => CREDITOS.reduce((t, c) => t + s[c.campo], 0)
export const totalDescontos = (s: Salario) => DESCONTOS.reduce((t, c) => t + s[c.campo], 0)
export const liquido = (s: Salario) => Math.round((totalCreditos(s) - totalDescontos(s)) * 100) / 100

export const vtDe = (salario: number) => Math.round(salario * PCT_VT * 100) / 100

export const salarioVazio = (p: Funcionario, mes: string): Salario => ({
  funcionarioId: p.id, mes, salario: 0, caixinha: 0, bonusCaixinha: 0, bonusConclui: 0,
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
