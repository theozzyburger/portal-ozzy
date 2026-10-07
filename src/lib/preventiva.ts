import { addDias } from './datas'
import type { ExecucaoPreventiva, Preventiva, Unidade } from './types'

// Avisa quando faltam até tantos dias (ou 10% da frequência, o que for maior, até 15 dias).
const antecedencia = (freq: number) => Math.min(15, Math.max(3, Math.round(freq * 0.1)))

export type SituacaoPreventiva = 'vencida' | 'vence_logo' | 'em_dia'

export interface TarefaPreventiva {
  preventiva: Preventiva
  unidadeId: string
  ultima: ExecucaoPreventiva | null
  proxima: string
  // Negativo = atrasada há tantos dias.
  faltam: number
  situacao: SituacaoPreventiva
}

const dias = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)

// Uma tarefa por item e por loja (itens "todas as lojas" viram uma tarefa em cada loja).
export function tarefasPreventiva(itens: Preventiva[], execucoes: ExecucaoPreventiva[], unidades: Unidade[], hoje: string): TarefaPreventiva[] {
  const tarefas: TarefaPreventiva[] = []
  for (const p of itens.filter((x) => x.ativo)) {
    for (const u of p.unidadeId ? [p.unidadeId] : unidades.map((x) => x.id)) {
      const ultima =
        execucoes
          .filter((x) => x.preventivaId === p.id && (x.unidadeId ?? p.unidadeId) === u)
          .sort((a, b) => b.feitoEm.localeCompare(a.feitoEm))[0] ?? null
      const proxima = ultima ? addDias(ultima.feitoEm, p.frequenciaDias) : p.primeiraEm
      const faltam = dias(hoje, proxima)
      tarefas.push({
        preventiva: p, unidadeId: u, ultima, proxima, faltam,
        situacao: faltam < 0 ? 'vencida' : faltam <= antecedencia(p.frequenciaDias) ? 'vence_logo' : 'em_dia',
      })
    }
  }
  return tarefas.sort((a, b) => a.faltam - b.faltam)
}

export function textoFrequencia(d: number) {
  if (d % 365 === 0) return d === 365 ? 'todo ano' : `a cada ${d / 365} anos`
  if (d % 30 === 0) return d === 30 ? 'todo mês' : `a cada ${d / 30} meses`
  if (d % 7 === 0) return d === 7 ? 'toda semana' : `a cada ${d / 7} semanas`
  return d === 1 ? 'todo dia' : `a cada ${d} dias`
}

export function textoPrazo(t: Pick<TarefaPreventiva, 'faltam'>) {
  if (t.faltam < 0) return `atrasada há ${-t.faltam} dia${t.faltam === -1 ? '' : 's'}`
  if (t.faltam === 0) return 'vence hoje'
  return `vence em ${t.faltam} dia${t.faltam === 1 ? '' : 's'}`
}
