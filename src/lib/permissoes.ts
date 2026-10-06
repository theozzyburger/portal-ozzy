import type { Funcionario, Nivel } from './types'

// Regra decidida em 06/10: Funcionário e Supervisor só visualizam;
// Gerente, Administrativo e Proprietário cadastram, desligam e publicam.
const GESTAO: Nivel[] = ['gerente', 'administrativo', 'proprietario']

// Painel inicial com indicadores por área (pedido de 06/10: Proprietário e Gerente).
export const podeVerPainel = (n: Nivel) => n === 'proprietario' || n === 'gerente'

export const podeGerenciar = (n: Nivel) => GESTAO.includes(n)

// Supervisor enxerga a equipe da própria unidade, sem editar.
export const podeVerEquipe = (n: Nivel) => n !== 'funcionario'

// Documentos e atestados são dados sensíveis (LGPD): só o próprio funcionário e a gestão.
export const podeVerDocumentosDe = (eu: Funcionario, alvo: Funcionario) =>
  eu.id === alvo.id || podeGerenciar(eu.nivel)

export const podeVerFuncionario = (eu: Funcionario, alvo: Funcionario) =>
  eu.id === alvo.id ||
  podeGerenciar(eu.nivel) ||
  (eu.nivel === 'supervisor' && eu.unidadeId === alvo.unidadeId)
