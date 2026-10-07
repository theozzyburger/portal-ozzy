import { addDias } from './datas'
import type { Ferias, Funcionario } from './types'
import { addMesesData } from './vencimentos'

// CLT: a cada 12 meses de trabalho (período aquisitivo) a pessoa ganha 30 dias de férias,
// que precisam ser tiradas nos 12 meses seguintes (período concessivo). Depois disso, vencem.
export const DIAS_FERIAS = 30
export const AVISO_FERIAS_MESES = 3

export type SituacaoFerias = 'em_aquisicao' | 'em_dia' | 'vence_logo' | 'vencida' | 'quitada'

export interface PeriodoFerias {
  inicio: string
  fim: string
  concessivoFim: string
  gozos: Ferias[]
  usados: number
  saldo: number
  // Último dia para começar as férias e terminar dentro do prazo.
  comecarAte: string
  situacao: SituacaoFerias
}

export function periodosFerias(admissao: string, registros: Ferias[], hoje: string): PeriodoFerias[] {
  const lista: PeriodoFerias[] = []
  for (let inicio = admissao; inicio <= hoje; inicio = addMesesData(inicio, 12)) {
    const proximo = addMesesData(inicio, 12)
    const fim = addDias(proximo, -1)
    const concessivoFim = addDias(addMesesData(inicio, 24), -1)
    const gozos = registros.filter((r) => r.aquisitivoInicio === inicio).sort((a, b) => a.inicio.localeCompare(b.inicio))
    const usados = gozos.reduce((t, g) => t + g.dias + g.abonoDias, 0)
    const saldo = Math.max(0, DIAS_FERIAS - usados)
    const comecarAte = addDias(concessivoFim, -saldo + 1)
    const situacao: SituacaoFerias =
      saldo === 0 ? 'quitada'
        : fim >= hoje ? 'em_aquisicao'
          : concessivoFim < hoje ? 'vencida'
            : concessivoFim <= addMesesData(hoje, AVISO_FERIAS_MESES) ? 'vence_logo'
              : 'em_dia'
    lista.push({ inicio, fim, concessivoFim, gozos, usados, saldo, comecarAte, situacao })
  }
  return lista.reverse()
}

export const TEXTO_SITUACAO: Record<SituacaoFerias, string> = {
  em_aquisicao: 'Em aquisição',
  em_dia: 'A tirar',
  vence_logo: 'Vence em breve',
  vencida: 'Vencida',
  quitada: 'Tiradas',
}
export const COR_SITUACAO: Record<SituacaoFerias, 'cinza' | 'verde' | 'ambar' | 'vermelho' | 'azul'> = {
  em_aquisicao: 'cinza', em_dia: 'azul', vence_logo: 'ambar', vencida: 'vermelho', quitada: 'verde',
}

export interface AlertaFerias {
  pessoa: Funcionario
  periodo: PeriodoFerias
}

// Quem tem férias vencidas ou vencendo nos próximos 3 meses.
export function alertasFerias(pessoas: Funcionario[], registros: Ferias[], hoje: string): AlertaFerias[] {
  return pessoas
    .filter((p) => p.status === 'ativo' && p.nivel !== 'proprietario')
    .flatMap((p) =>
      periodosFerias(p.dataAdmissao, registros.filter((r) => r.funcionarioId === p.id), hoje)
        .filter((x) => x.situacao === 'vence_logo' || x.situacao === 'vencida')
        .map((periodo) => ({ pessoa: p, periodo })),
    )
    .sort((a, b) => a.periodo.concessivoFim.localeCompare(b.periodo.concessivoFim))
}
