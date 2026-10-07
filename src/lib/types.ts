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
  // Setor, usado na caixinha (grupos de bônus). 'geral' = gerente que atende as duas lojas.
  setor?: Setor | null
}

export type Setor = 'cozinha' | 'atendimento' | 'producao' | 'unidade' | 'geral'
export const SETORES: { valor: Setor; nome: string }[] = [
  { valor: 'cozinha', nome: 'Cozinha' },
  { valor: 'atendimento', nome: 'Atendimento' },
  { valor: 'producao', nome: 'Produção' },
  { valor: 'unidade', nome: 'Unidade toda' },
  { valor: 'geral', nome: 'Geral (todas as lojas)' },
]

export type TipoDocumento =
  | 'atestado' | 'contrato' | 'documento_pessoal' | 'exame' | 'outro'
  // Saúde ocupacional (NR-7 e Portaria CVS 3/2026 para manipuladores de alimentos).
  | 'aso_admissional' | 'aso_periodico' | 'aso_retorno' | 'aso_mudanca_funcao' | 'aso_demissional'
  | 'coprocultura' | 'coproparasitologico' | 'curso_manipulador'

export interface Documento {
  id: string
  funcionarioId: string
  tipo: TipoDocumento
  nomeArquivo: string
  observacao?: string | null
  // Atestado: período de afastamento.
  inicio?: string | null
  fim?: string | null
  // Exames e cursos: quando foi feito e quando vence.
  realizadoEm?: string | null
  vence?: string | null
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

// validadeMeses: sugestão de vencimento a partir da data do exame (dá para mudar no envio).
// A periodicidade final é a que o médico do PCMSO definir.
export const TIPOS_DOCUMENTO: { valor: TipoDocumento; nome: string; grupo: 'geral' | 'saude'; validadeMeses?: number }[] = [
  { valor: 'atestado', nome: 'Atestado', grupo: 'geral' },
  { valor: 'documento_pessoal', nome: 'Documento pessoal', grupo: 'geral' },
  { valor: 'contrato', nome: 'Contrato', grupo: 'geral' },
  { valor: 'outro', nome: 'Outro', grupo: 'geral' },
  { valor: 'aso_admissional', nome: 'ASO admissional', grupo: 'saude', validadeMeses: 12 },
  { valor: 'aso_periodico', nome: 'ASO periódico', grupo: 'saude', validadeMeses: 12 },
  { valor: 'aso_retorno', nome: 'ASO retorno ao trabalho', grupo: 'saude', validadeMeses: 12 },
  { valor: 'aso_mudanca_funcao', nome: 'ASO mudança de função', grupo: 'saude', validadeMeses: 12 },
  { valor: 'aso_demissional', nome: 'ASO demissional', grupo: 'saude' },
  { valor: 'coprocultura', nome: 'Coprocultura', grupo: 'saude', validadeMeses: 12 },
  { valor: 'coproparasitologico', nome: 'Coproparasitológico (fezes)', grupo: 'saude', validadeMeses: 12 },
  { valor: 'curso_manipulador', nome: 'Curso de boas práticas (manipulador)', grupo: 'saude', validadeMeses: 12 },
  { valor: 'exame', nome: 'Outro exame', grupo: 'saude' },
]

export const ehSaude = (t: TipoDocumento) => TIPOS_DOCUMENTO.find((x) => x.valor === t)?.grupo === 'saude'

// O que todo funcionário ativo precisa ter em dia. Todos aqui manipulam alimentos.
export const EXIGENCIAS: { id: string; nome: string; tipos: TipoDocumento[]; base: string }[] = [
  { id: 'aso', nome: 'ASO (exame clínico)', tipos: ['aso_admissional', 'aso_periodico', 'aso_retorno', 'aso_mudanca_funcao'], base: 'NR-7 (PCMSO)' },
  { id: 'coprocultura', nome: 'Coprocultura', tipos: ['coprocultura'], base: 'Portaria CVS 3/2026' },
  { id: 'coproparasitologico', nome: 'Coproparasitológico', tipos: ['coproparasitologico'], base: 'Portaria CVS 3/2026' },
]

// Entrega de uniforme com termo assinado na tela.
export interface ItemUniforme {
  item: string
  tamanho?: string
  quantidade: number
}

export interface EntregaUniforme {
  id: string
  funcionarioId: string
  data: string
  itens: ItemUniforme[]
  observacao?: string | null
  entreguePor: string
  // Imagem da assinatura (PNG em base64). Nulo enquanto a pessoa não assina.
  assinatura: string | null
  assinadoEm: string | null
  // 'presencial': assinou no aparelho de quem entregou; 'portal': assinou no próprio login.
  assinadoVia: 'presencial' | 'portal' | null
  criadoEm: string
}

export const ITENS_UNIFORME = ['Camiseta', 'Dólmã', 'Avental', 'Boné', 'Touca', 'Calça', 'Jaqueta', 'Bota de segurança (EPI)', 'Luva térmica (EPI)']
export const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'Único']

export const termoUniforme = (nome: string, data: string, itens: ItemUniforme[]) =>
  `Eu, ${nome}, declaro que recebi da empresa, gratuitamente, em ${data.split('-').reverse().join('/')}, os itens de uniforme e equipamentos listados abaixo, ` +
  `em bom estado: ${itens.map((i) => `${i.quantidade}x ${i.item}${i.tamanho ? ` (${i.tamanho})` : ''}`).join('; ')}. ` +
  `Comprometo-me a usá-los somente durante o trabalho, a conservá-los e a devolvê-los quando for desligado(a) ou quando forem substituídos.`

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
