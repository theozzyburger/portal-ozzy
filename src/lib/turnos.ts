import type { DiaTurno, Turno } from './types'

export const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

// Limite da CLT (art. 58 e CF art. 7º, XIII): 44 horas semanais.
export const LIMITE_SEMANA_MIN = 44 * 60

export const LOCAIS_EXTRAS: Record<string, string> = { producao: 'Produção', escritorio: 'Escritório' }

const min = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// Fim menor ou igual ao início = vira a noite (ex.: 14:45 às 00:30).
export const viraNoite = (d: DiaTurno) => min(d.fim) <= min(d.inicio)

export const minutosTrabalhados = (d: DiaTurno | null) => {
  if (!d) return 0
  let total = min(d.fim) - min(d.inicio)
  if (total <= 0) total += 24 * 60
  return total - d.pausaMin
}

export const minutosSemana = (t: Pick<Turno, 'dias'>) => t.dias.reduce((s, d) => s + minutosTrabalhados(d), 0)

// Escala 5x2 (08/10): o posto abre até 6 dias, mas cada pessoa trabalha 5 e folga em revezamento (toda segunda
// e um domingo sim, outro não). As horas da pessoa são a média dos dias abertos × 5, não a soma do posto.
export const DIAS_POR_PESSOA = 5
export const diasAbertos = (t: Pick<Turno, 'dias'>) => t.dias.filter(Boolean).length
export const revezado = (t: Pick<Turno, 'dias'>) => diasAbertos(t) > DIAS_POR_PESSOA
export const minutosPessoa = (t: Pick<Turno, 'dias'>) =>
  revezado(t) ? Math.round((minutosSemana(t) * DIAS_POR_PESSOA) / diasAbertos(t)) : minutosSemana(t)

export const horas = (minutos: number) => {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

export const textoPausa = (m: number) => (m >= 60 ? horas(m) : `${m} min`)

const d = (inicio: string, fim: string, pausaMin = 60): DiaTurno => ({ inicio, fim, pausaMin })
const F = null

// Da aba "Horários" do Cronograma 2026 (enviado em 07/10). Só horários: as pessoas a gestão coloca.
export const TURNOS_PADRAO: Turno[] = [
  { id: 't-psd-manha', local: 'burger-psd', nome: 'Manhã', dias: [F, F, d('09:00', '18:45'), d('09:00', '18:45'), d('09:00', '18:45'), d('09:00', '18:45'), d('13:45', '23:30')] },
  { id: 't-psd-cozinha', local: 'burger-psd', nome: 'Cozinha (noite)', dias: [F, F, d('13:30', '23:15'), d('13:30', '23:15'), d('14:45', '00:30'), d('14:45', '00:30'), d('13:45', '23:30')] },
  { id: 't-psd-atendimento', local: 'burger-psd', nome: 'Atendimento (noite)', dias: [F, F, d('13:30', '23:15'), d('13:30', '23:15'), d('14:45', '00:30'), d('14:45', '00:30'), d('13:45', '23:30')] },
  { id: 't-va-cozinha', local: 'burger-va', nome: 'Cozinha', dias: [F, F, d('13:30', '23:15'), d('13:30', '23:15'), d('13:00', '23:45', 120), d('14:00', '23:45'), d('13:30', '23:15')] },
  { id: 't-va-atendimento', local: 'burger-va', nome: 'Atendimento', dias: [F, F, d('13:30', '23:15'), d('13:30', '23:15'), d('14:00', '23:45', 120), d('11:30', '22:15'), d('13:30', '23:15')] },
  { id: 't-pizza-cozinha', local: 'pizza', nome: 'Cozinha', dias: [F, F, d('13:15', '23:00'), d('13:15', '23:00'), d('13:45', '23:30'), d('13:45', '23:30'), d('13:15', '23:00')] },
  { id: 't-producao', local: 'producao', nome: 'Produção', dias: [F, F, d('08:00', '17:45'), d('08:00', '17:45'), d('08:00', '17:45'), d('08:00', '17:45'), d('08:00', '17:45')] },
  { id: 't-escritorio', local: 'escritorio', nome: 'Escritório', dias: [d('08:30', '17:45', 30), d('08:30', '17:45', 30), d('08:30', '17:45', 30), d('08:30', '17:45', 30), d('08:30', '17:45', 30), F, F] },
  { id: 't-manutencao', local: 'escritorio', nome: 'Manutenção', dias: [d('10:00', '19:45'), d('10:00', '19:45'), d('10:00', '19:45'), d('10:00', '19:45'), d('10:00', '19:45'), F, F] },
]
