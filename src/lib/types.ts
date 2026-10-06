export type Nivel = 'funcionario' | 'supervisor' | 'gerente' | 'administrativo' | 'proprietario'

export type Status = 'ativo' | 'inativo'

export interface Unidade {
  id: string
  nome: string
}

export interface Funcionario {
  id: string
  nome: string
  celular: string
  cargo: string
  unidadeId: string
  nivel: Nivel
  status: Status
  dataAdmissao: string
  dataDesligamento?: string | null
  respondePara?: string | null
}

export type TipoDocumento = 'atestado' | 'contrato' | 'documento_pessoal' | 'exame' | 'outro'

export interface Documento {
  id: string
  funcionarioId: string
  tipo: TipoDocumento
  nomeArquivo: string
  observacao?: string | null
  // Atestado: período de afastamento.
  inicio?: string | null
  fim?: string | null
  enviadoPor: string
  criadoEm: string
}

export type TipoOcorrencia = 'falta' | 'atraso' | 'advertencia' | 'orientacao' | 'elogio' | 'outro'

export interface Ocorrencia {
  id: string
  funcionarioId: string
  tipo: TipoOcorrencia
  data: string
  descricao: string
  registradoPor: string
  criadoEm: string
}

export interface Comunicado {
  id: string
  titulo: string
  corpo: string
  // null = todas as unidades
  unidadeId: string | null
  autorId: string
  criadoEm: string
  lidoPor: string[]
}

export interface Folga {
  id: string
  funcionarioId: string
  data: string
}

export const NIVEIS: { valor: Nivel; nome: string }[] = [
  { valor: 'funcionario', nome: 'Funcionário' },
  { valor: 'supervisor', nome: 'Supervisor' },
  { valor: 'gerente', nome: 'Gerente' },
  { valor: 'administrativo', nome: 'Administrativo' },
  { valor: 'proprietario', nome: 'Proprietário' },
]

export const TIPOS_DOCUMENTO: { valor: TipoDocumento; nome: string }[] = [
  { valor: 'atestado', nome: 'Atestado' },
  { valor: 'documento_pessoal', nome: 'Documento pessoal' },
  { valor: 'contrato', nome: 'Contrato' },
  { valor: 'exame', nome: 'Exame' },
  { valor: 'outro', nome: 'Outro' },
]

export const TIPOS_OCORRENCIA: { valor: TipoOcorrencia; nome: string }[] = [
  { valor: 'falta', nome: 'Falta' },
  { valor: 'atraso', nome: 'Atraso' },
  { valor: 'advertencia', nome: 'Advertência' },
  { valor: 'orientacao', nome: 'Orientação' },
  { valor: 'elogio', nome: 'Elogio' },
  { valor: 'outro', nome: 'Outro' },
]

export const nomeNivel = (n: Nivel) => NIVEIS.find((x) => x.valor === n)?.nome ?? n
export const nomeTipoDocumento = (t: TipoDocumento) => TIPOS_DOCUMENTO.find((x) => x.valor === t)?.nome ?? t
export const nomeTipoOcorrencia = (t: TipoOcorrencia) => TIPOS_OCORRENCIA.find((x) => x.valor === t)?.nome ?? t

// Nome curto da loja, para selos e gráficos: "Parque São Domingos", "Vila Anastácio", "Pizza".
export const apelidoUnidade = (nome: string) => nome.replace(/^The Ozzy Burger /, '').replace(/^The Ozzy /, '')

// Vendas por dia, loja e canal. Vão vir do PDV / iFood / 99Food; por enquanto, exemplo.
export type Canal = 'salao' | 'ifood' | 'proprio' | '99food'

// A ordem é fixa: é ela que define a cor de cada canal nos gráficos.
export const CANAIS: { valor: Canal; nome: string; cor: string }[] = [
  { valor: 'salao', nome: 'Salão', cor: '#2a78d6' },
  { valor: 'ifood', nome: 'iFood', cor: '#eb6834' },
  { valor: 'proprio', nome: 'Delivery próprio', cor: '#1baf7a' },
  { valor: '99food', nome: '99Food', cor: '#eda100' },
]

export interface VendaDia {
  unidadeId: string
  data: string
  canal: Canal
  pedidos: number
  faturamento: number
}

export type Plataforma = 'ifood' | '99food'

export interface Avaliacao {
  unidadeId: string
  plataforma: Plataforma
  nota: number
  totalAvaliacoes: number
  notaHa30Dias: number | null
  atualizadoEm: string
}
