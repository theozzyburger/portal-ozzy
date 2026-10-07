import type { Funcionario, Ocorrencia } from './types'

// Regras da caixinha, iguais às da planilha "Caixinha The Ozzy" (conferido com set/2026).
// Detalhes em docs/caixinha-regras.md.

// Só as lojas com salão têm caixinha (a Pizza é só delivery).
export const UNIDADES_CAIXINHA = ['burger-psd', 'burger-va']
export const RETENCAO = 0.2 // separado para impostos
export const PONTOS_BONUS = 2 // cada bônus vale 2 pontos
export const PESO_ADVERTENCIA = 3 // na disputa do bônus, 1 advertência = 3 faltas
export const MINIMO_BONUS_POR_SETOR = 6 // com menos gente que isso, a loja tem um bônus só

export const PONTOS_CARGO: { cargo: string; pontos: number }[] = [
  { cargo: 'Auxiliar', pontos: 1.0 },
  { cargo: 'Chapeiro', pontos: 1.0 }, // conta como Auxiliar
  { cargo: 'Atendente', pontos: 1.3 },
  { cargo: 'Supervisor', pontos: 1.4 },
  { cargo: 'Gerente', pontos: 2.6 },
]

// Compara pelo começo do nome, para "Supervisora de cozinha" contar como Supervisor.
const radical = (s: string) => s.toLowerCase().slice(0, 7)
export const pontosDoCargo = (cargo: string) => PONTOS_CARGO.find((p) => radical(cargo) === radical(p.cargo))?.pontos ?? 0
const ehGerente = (cargo: string) => radical(cargo) === radical('Gerente')

export interface GrupoBonus {
  nome: string
  membros: string[]
  valor: number
  vencedores: string[]
  menorNota: number
}

export interface ResumoUnidade {
  unidadeId: string
  total: number
  retido: number
  aDividir: number
  pontos: number
  valorPonto: number
  grupos: GrupoBonus[]
}

export interface LinhaCaixinha {
  pessoa: Funcionario
  pontos: number
  parte: number
  faltas: number
  advertencias: number
  nota: number
  bonus: number
  total: number
}

// Setores que não entram na caixinha da planilha (a Produção não participa).
// A pizzaria não tem caixinha (só delivery).
export const SETORES_FORA = ['producao', 'manutencao', 'escritorio', 'pizzaria']

export function calcularCaixinha(pessoas: Funcionario[], ocorrenciasDoMes: Ocorrencia[], totais: Record<string, number>) {
  const participantes = pessoas.filter((p) => p.status === 'ativo' && pontosDoCargo(p.cargo) > 0 && !SETORES_FORA.includes(p.setor ?? '') && (p.setor === 'geral' || UNIDADES_CAIXINHA.includes(p.unidadeId)))
  const gerais = participantes.filter((p) => p.setor === 'geral')
  const conta = (id: string, tipo: string) => ocorrenciasDoMes.filter((o) => o.funcionarioId === id && o.tipo === tipo).length
  // Suspensão pesa igual a advertência (Heitor, 07/10).
  const advertencias = (id: string) => conta(id, 'advertencia') + conta(id, 'suspensao')
  const nota = (id: string) => conta(id, 'falta') + PESO_ADVERTENCIA * advertencias(id)
  const bonus = new Map<string, number>()

  const unidades: ResumoUnidade[] = UNIDADES_CAIXINHA.map((u) => {
    const membros = participantes.filter((p) => p.unidadeId === u && p.setor !== 'geral')
    const elegiveis = membros.filter((p) => !ehGerente(p.cargo))
    const gruposBase =
      elegiveis.length < MINIMO_BONUS_POR_SETOR
        ? [{ nome: 'Bônus da loja', membros: elegiveis }]
        : [
            { nome: 'Bônus da cozinha', membros: elegiveis.filter((p) => p.setor === 'cozinha') },
            { nome: 'Bônus do atendimento', membros: elegiveis.filter((p) => p.setor === 'atendimento') },
          ].filter((g) => g.membros.length)
    const total = totais[u] ?? 0
    const aDividir = total * (1 - RETENCAO)
    const pontos =
      membros.reduce((s, p) => s + pontosDoCargo(p.cargo), 0) +
      gerais.reduce((s, p) => s + pontosDoCargo(p.cargo) / UNIDADES_CAIXINHA.length, 0) +
      PONTOS_BONUS * gruposBase.length
    const valorPonto = pontos ? aDividir / pontos : 0
    const grupos = gruposBase.map((g) => {
      const menorNota = Math.min(...g.membros.map((p) => nota(p.id)))
      const vencedores = g.membros.filter((p) => nota(p.id) === menorNota).map((p) => p.id)
      const valor = PONTOS_BONUS * valorPonto
      vencedores.forEach((id) => bonus.set(id, (bonus.get(id) ?? 0) + valor / vencedores.length))
      return { nome: g.nome, membros: g.membros.map((p) => p.id), valor, vencedores, menorNota }
    })
    return { unidadeId: u, total, retido: total - aDividir, aDividir, pontos, valorPonto, grupos }
  })

  const vp = (u: string) => unidades.find((x) => x.unidadeId === u)?.valorPonto ?? 0
  const linhas: LinhaCaixinha[] = participantes.map((p) => {
    const pts = pontosDoCargo(p.cargo)
    const parte = p.setor === 'geral' ? UNIDADES_CAIXINHA.reduce((s, u) => s + (pts / UNIDADES_CAIXINHA.length) * vp(u), 0) : pts * vp(p.unidadeId)
    const b = bonus.get(p.id) ?? 0
    return { pessoa: p, pontos: pts, parte, faltas: conta(p.id, 'falta'), advertencias: advertencias(p.id), nota: nota(p.id), bonus: b, total: parte + b }
  })

  // Quem está ativo mas ficou de fora (cargo sem pontos, loja sem caixinha).
  const foraDaConta = pessoas.filter((p) => p.status === 'ativo' && !participantes.includes(p) && p.nivel !== 'proprietario' && !SETORES_FORA.includes(p.setor ?? '') && UNIDADES_CAIXINHA.includes(p.unidadeId))
  return { unidades, linhas, foraDaConta }
}
