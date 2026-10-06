import { addDias, hoje } from './datas'
import { EXIGENCIAS, type Documento, type Funcionario } from './types'

export type Situacao = 'em_dia' | 'vence_logo' | 'vencido' | 'faltando'

// Quantos dias antes do vencimento o portal começa a avisar.
export const AVISO_DIAS = 30

export interface Item {
  id: string
  nome: string
  base: string
  situacao: Situacao
  doc?: Documento
  vence?: string | null
}

export function situacaoDoc(vence?: string | null): Situacao {
  if (!vence) return 'em_dia'
  if (vence < hoje()) return 'vencido'
  if (vence <= addDias(hoje(), AVISO_DIAS)) return 'vence_logo'
  return 'em_dia'
}

// Para cada exigência, o documento mais recente e se ele está em dia.
export function exigenciasDe(docs: Documento[]): Item[] {
  return EXIGENCIAS.map((e) => {
    const doc = docs
      .filter((d) => e.tipos.includes(d.tipo))
      .sort((a, b) => (b.realizadoEm ?? b.criadoEm).localeCompare(a.realizadoEm ?? a.criadoEm))[0]
    return { id: e.id, nome: e.nome, base: e.base, doc, vence: doc?.vence, situacao: doc ? situacaoDoc(doc.vence) : 'faltando' }
  })
}

export interface Pendencia {
  pessoa: Funcionario
  item: Item
}

// Tudo que está vencido, vencendo ou faltando, dos funcionários ativos. O mais urgente primeiro.
export function pendencias(pessoas: Funcionario[], docs: Documento[]): Pendencia[] {
  const ordem: Record<Situacao, number> = { vencido: 0, faltando: 1, vence_logo: 2, em_dia: 3 }
  return pessoas
    .filter((p) => p.status === 'ativo')
    .flatMap((p) => exigenciasDe(docs.filter((d) => d.funcionarioId === p.id)).map((item) => ({ pessoa: p, item })))
    .filter((x) => x.item.situacao !== 'em_dia')
    .sort((a, b) => ordem[a.item.situacao] - ordem[b.item.situacao] || (a.item.vence ?? '').localeCompare(b.item.vence ?? ''))
}

export const textoSituacao = (i: Item) => {
  const data = i.vence ? i.vence.split('-').reverse().join('/') : ''
  if (i.situacao === 'faltando') return 'Não enviado'
  if (i.situacao === 'vencido') return `Venceu em ${data}`
  if (i.situacao === 'vence_logo') return `Vence em ${data}`
  return i.vence ? `Válido até ${data}` : 'Enviado'
}

export const corSituacao: Record<Situacao, 'verde' | 'ambar' | 'vermelho' | 'cinza'> = {
  em_dia: 'verde', vence_logo: 'ambar', vencido: 'vermelho', faltando: 'vermelho',
}

export const iconeSituacao: Record<Situacao, string> = { em_dia: '✓', vence_logo: '!', vencido: '✕', faltando: '✕' }

export const addMesesData = (data: string, meses: number) => {
  const [a, m, d] = data.split('-').map(Number)
  const r = new Date(a, m - 1 + meses, d)
  return `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, '0')}-${String(r.getDate()).padStart(2, '0')}`
}
