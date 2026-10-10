// Datas como texto 'AAAA-MM-DD' no horário local, para não errar o dia por fuso.
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const deIso = (s: string) => {
  const [a, m, d] = s.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export const hoje = () => iso(new Date())

export const addDias = (s: string, n: number) => {
  const d = deIso(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}

// Semana começa na segunda-feira.
// Dias de a até b (datas AAAA-MM-DD; negativo se b vem antes).
export const diasEntre = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86400000)
export const inicioDaSemana = (s: string) => {
  const d = deIso(s)
  return addDias(s, -((d.getDay() + 6) % 7))
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const diaSemana = (s: string) => DIAS[deIso(s).getDay()]
// Posição na semana dos turnos: 0 = segunda … 6 = domingo.
export const indiceSemana = (s: string) => (deIso(s).getDay() + 6) % 7

export const dataCurta = (s: string) => {
  const [, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}`
}

export const dataLonga = (s: string) => {
  const [a, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export const tempoDesde = (isoDataHora: string) => {
  const min = Math.round((Date.now() - new Date(isoDataHora).getTime()) / 60000)
  if (min < 60) return `há ${Math.max(min, 1)} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ontem' : `há ${d} dias`
}

// Mês como 'AAAA-MM'.
export const mesDe = (s: string) => s.slice(0, 7)
export const addMeses = (mes: string, n: number) => {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export const primeiroDia = (mes: string) => `${mes}-01`
export const ultimoDia = (mes: string) => addDias(primeiroDia(addMeses(mes, 1)), -1)

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const nomeMes = (mes: string) => MESES[Number(mes.slice(5, 7)) - 1]
export const nomeMesAno = (mes: string) => `${nomeMes(mes)} de ${mes.slice(0, 4)}`

// Um dia de N meses atrás (sem passar de hoje), para dados de exemplo.
export const diaNoMes = (mesesAtras: number, dia: number) => {
  const mes = addMeses(mesDe(hoje()), -mesesAtras)
  const d = `${mes}-${String(Math.min(dia, Number(ultimoDia(mes).slice(8)))).padStart(2, '0')}`
  return d > hoje() ? hoje() : d
}
