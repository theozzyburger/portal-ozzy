export type Nivel = 'funcionario' | 'supervisor' | 'gerente' | 'administrativo' | 'proprietario' | 'manutencao'

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
  // Turno-padrão em que a pessoa trabalha (Departamento Pessoal › Turnos).
  turnoId?: string | null
  // Chave Pix para pagamentos (só a própria pessoa e a gestão veem).
  pix?: string | null
  // Optou pelo vale-transporte (desconto de até 6% do salário).
  optaVt?: boolean
  // Só números. Sai nos documentos impressos.
  cpf?: string | null
  // Feminino: no desligamento, o portal gera os termos de exame de gravidez.
  sexo?: 'feminino' | 'masculino' | null
  // Para a mensagem de aniversário.
  dataNascimento?: string | null
  // Tamanhos para pedir uniforme.
  tamCamiseta?: string | null
  tamCalca?: string | null
  tamCalcado?: number | null
  // Contrato de experiência: dias do 1º e do 2º período a partir da admissão (padrão 10 + 80). Nulo = sem contrato.
  experienciaDias1?: number | null
  experienciaDias2?: number | null
  // Foto de perfil: caminho no armazenamento e endereço temporário para mostrar.
  foto?: string | null
  fotoUrl?: string | null
}

export type Setor = 'cozinha' | 'atendimento' | 'producao' | 'unidade' | 'geral' | 'manutencao' | 'escritorio' | 'pizzaria'
export const SETORES: { valor: Setor; nome: string }[] = [
  { valor: 'cozinha', nome: 'Cozinha' },
  { valor: 'atendimento', nome: 'Atendimento' },
  { valor: 'pizzaria', nome: 'Pizzaria' },
  { valor: 'producao', nome: 'Produção' },
  { valor: 'unidade', nome: 'Unidade toda' },
  { valor: 'geral', nome: 'Geral (todas as lojas)' },
  { valor: 'manutencao', nome: 'Manutenção' },
  { valor: 'escritorio', nome: 'Escritório' },
]

export type TipoDocumento =
  | 'atestado' | 'contrato' | 'documento_pessoal' | 'exame' | 'outro' | 'termo_gravidez'
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

export type TipoOcorrencia = 'falta' | 'atraso' | 'advertencia' | 'suspensao' | 'orientacao' | 'elogio' | 'outro'

export interface Ocorrencia {
  id: string
  funcionarioId: string
  tipo: TipoOcorrencia
  data: string
  descricao: string
  registradoPor: string
  criadoEm: string
  // Advertência e suspensão: motivo (natureza) e, na suspensão, a partir de quando e por quantos dias.
  natureza?: string | null
  suspensaoInicio?: string | null
  suspensaoDias?: number | null
}

export interface Comunicado {
  id: string
  titulo: string
  corpo: string
  // null = todas as unidades
  unidadeId: string | null
  // Público: setores (null = todos) ou pessoas escolhidas (quando houver, só elas).
  setores?: Setor[] | null
  destinatarios?: string[] | null
  autorId: string
  criadoEm: string
  lidoPor: string[]
}

export type TipoFolga = 'normal' | 'feriado'
export interface Folga {
  id: string
  funcionarioId: string
  data: string
  tipo: TipoFolga
}

export const NIVEIS: { valor: Nivel; nome: string }[] = [
  { valor: 'funcionario', nome: 'Funcionário' },
  { valor: 'supervisor', nome: 'Supervisor' },
  { valor: 'gerente', nome: 'Gerente' },
  { valor: 'administrativo', nome: 'Administrativo' },
  { valor: 'proprietario', nome: 'Proprietário' },
  // Acesso do manutencista (07/10): vê e atende os chamados de todas as lojas.
  { valor: 'manutencao', nome: 'Manutenção' },
]

// validadeMeses: sugestão de vencimento a partir da data do exame (dá para mudar no envio).
// A periodicidade final é a que o médico do PCMSO definir.
export const TIPOS_DOCUMENTO: { valor: TipoDocumento; nome: string; grupo: 'geral' | 'saude'; validadeMeses?: number }[] = [
  { valor: 'atestado', nome: 'Atestado', grupo: 'geral' },
  { valor: 'documento_pessoal', nome: 'Documento pessoal', grupo: 'geral' },
  { valor: 'contrato', nome: 'Contrato', grupo: 'geral' },
  { valor: 'termo_gravidez', nome: 'Termo de exame de gravidez (desligamento)', grupo: 'geral' },
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
// manipulador: só para quem mexe com alimento (o Escritório não precisa, pedido de 07/10).
export const EXIGENCIAS: { id: string; nome: string; tipos: TipoDocumento[]; base: string; manipulador?: boolean }[] = [
  { id: 'aso', nome: 'ASO (exame clínico)', tipos: ['aso_admissional', 'aso_periodico', 'aso_retorno', 'aso_mudanca_funcao'], base: 'NR-7 (PCMSO)' },
  { id: 'coprocultura', nome: 'Coprocultura', tipos: ['coprocultura'], base: 'Portaria CVS 3/2026', manipulador: true },
  { id: 'coproparasitologico', nome: 'Coproparasitológico', tipos: ['coproparasitologico'], base: 'Portaria CVS 3/2026', manipulador: true },
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
  { valor: 'suspensao', nome: 'Suspensão' },
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

// Turnos: horário-padrão de cada posto, da segunda (0) ao domingo (6). null = folga.
// Quem está em cada turno fica em Funcionario.turnoId (a gestão escolhe).
export interface DiaTurno {
  inicio: string // 'HH:MM'
  fim: string // 'HH:MM'; menor que o início = termina depois da meia-noite
  pausaMin: number
}

export interface Turno {
  id: string
  // Loja (id da unidade) ou 'producao' / 'escritorio', que não são lojas.
  local: string
  nome: string
  dias: (DiaTurno | null)[]
}

// Regulamento interno: cada versão publicada e quem assinou cada uma.
export interface VersaoRegulamento {
  id: string
  numero: number
  texto: string
  // Resumo do que mudou, escrito por quem publicou.
  nota: string | null
  publicadoEm: string
  publicadoPor: string | null
  // SHA-256 do texto: prova qual versão exata foi assinada.
  hash: string
}

export interface LeituraRegulamento {
  funcionarioId: string
  versaoId: string
  assinatura: string
  assinadoEm: string
  hash: string
  // Registro para auditoria: navegador/aparelho e IP de onde assinou.
  dispositivo: string | null
  ip: string | null
}

// Primeiro e último nome: "Queli Souza", "Julia Bernardo" (separa as duas Júlias).
export const nomeCurto = (nome: string) => {
  const p = nome.split(' ').filter(Boolean)
  return p.length > 1 ? `${p[0]} ${p[p.length - 1]}` : nome
}

// Chamados de manutenção (07/10): qualquer pessoa abre; o manutencista e a gestão atendem.
export type Gravidade = 'urgente' | 'importante' | 'simples'
export const GRAVIDADES: { valor: Gravidade; nome: string; dica: string }[] = [
  { valor: 'urgente', nome: 'Urgente', dica: 'Parou a operação ou é risco (gás, choque, vazamento grande)' },
  { valor: 'importante', nome: 'Importante', dica: 'Atrapalha o trabalho, resolver nos próximos dias' },
  { valor: 'simples', nome: 'Pode esperar', dica: 'Melhoria ou ajuste sem pressa' },
]

export type CategoriaChamado =
  | 'equipamento' | 'refrigeracao' | 'eletrica' | 'hidraulica' | 'gas' | 'reforma'
  | 'computador' | 'internet' | 'moveis' | 'outro'
export const CATEGORIAS_CHAMADO: { valor: CategoriaChamado; nome: string; exemplos: string }[] = [
  { valor: 'equipamento', nome: 'Equipamento e maquinário', exemplos: 'chapa, fritadeira, forno, coifa, máquinas' },
  { valor: 'refrigeracao', nome: 'Refrigeração', exemplos: 'geladeira, freezer, câmara fria, ar-condicionado' },
  { valor: 'eletrica', nome: 'Elétrica', exemplos: 'tomada, disjuntor, iluminação' },
  { valor: 'hidraulica', nome: 'Hidráulica', exemplos: 'pia, vazamento, esgoto, caixa de gordura' },
  { valor: 'gas', nome: 'Gás', exemplos: 'cheiro de gás, registro, botijão' },
  { valor: 'reforma', nome: 'Reforma e estrutura', exemplos: 'parede, piso, porta, telhado, pintura' },
  { valor: 'computador', nome: 'Computador e sistemas', exemplos: 'PDV Eclética, impressora, tablet, computador' },
  { valor: 'internet', nome: 'Internet e telefone', exemplos: 'Wi-Fi, roteador, telefone' },
  { valor: 'moveis', nome: 'Móveis e utensílios', exemplos: 'mesa, cadeira, prateleira, utensílios' },
  { valor: 'outro', nome: 'Outro', exemplos: '' },
]

export type StatusChamado = 'aberto' | 'andamento' | 'aguardando' | 'resolvido' | 'cancelado'
export const STATUS_CHAMADO: { valor: StatusChamado; nome: string }[] = [
  { valor: 'aberto', nome: 'Aberto' },
  { valor: 'andamento', nome: 'Em andamento' },
  { valor: 'aguardando', nome: 'Aguardando peça ou terceiro' },
  { valor: 'resolvido', nome: 'Resolvido' },
  { valor: 'cancelado', nome: 'Cancelado' },
]
export const chamadoEmAberto = (s: StatusChamado) => s !== 'resolvido' && s !== 'cancelado'

export interface EventoChamado {
  id: string
  autorId: string
  em: string
  texto: string | null
  // Preenchido quando o evento mudou o status.
  status: StatusChamado | null
}

export interface Chamado {
  id: string
  numero: number
  unidadeId: string
  categoria: CategoriaChamado
  gravidade: Gravidade
  titulo: string
  descricao: string
  // Local dentro da loja (ex.: cozinha, salão, banheiro). Opcional.
  local: string | null
  foto: string | null
  status: StatusChamado
  abertoPor: string
  abertoEm: string
  responsavelId: string | null
  fechadoEm: string | null
  eventos: EventoChamado[]
}

// Dados copiados do Lucro Fácil (fichas técnicas e resultado do mês).
export interface ItemFicha {
  nome: string
  unidade: string
  qtd: number
  // Pizzas por tamanho: broto, media, grande, familia.
  tamanho: string | null
  // Quando o item é outro preparo (molho, base), o id da ficha dele.
  preparoId: number | null
}

export interface Ficha {
  produtoId: number
  nome: string
  categoria: string | null
  preparo: boolean
  itens: ItemFicha[]
  // Só chega para a gestão.
  custo?: { total: number; preco: number; itens: { custoUnit: number; total: number }[] }
}

export interface ResultadoMes {
  unidadeId: string
  mes: string
  pedidos: number
  faturamento: number
  cmv: number
  impostos: number
  comissoes: number
  taxasPagamento: number
  custosOperacionais: number
  lucroOperacional: number
  ticketMedio: number
}

// Freelancers: cadastro e diárias. Semana de segunda a domingo, paga na segunda seguinte.
export interface Freelancer {
  id: string
  nome: string
  // Opcional quando é um funcionário fazendo diária na folga.
  cpf: string | null
  pix: string
  celular: string | null
  ativo: boolean
  funcionarioId: string | null
}

export type TurnoFreela = 'manha' | 'noite'

export interface DiariaFreela {
  id: string
  freelancerId: string
  data: string
  turno: TurnoFreela
  unidadeId: string
  funcao: string
  valor: number
  observacao: string | null
  lancadoPor: string | null
}

// Diária que o próprio freelancer (pelo link da loja) ou o funcionário (pelo login) mandou. Vira DiariaFreela
// quando a gestão aprova e põe o valor.
export type StatusEnvioFreela = 'pendente' | 'aprovado' | 'recusado'
export interface EnvioFreela {
  id: string
  cpf: string | null
  celular: string | null
  nome: string
  pix: string
  freelancerId: string | null
  funcionarioId: string | null
  data: string
  turno: TurnoFreela
  unidadeId: string
  funcao: string
  observacao: string | null
  status: StatusEnvioFreela
  motivo: string | null
  enviadoEm: string
}

export interface DiaEnviado {
  data: string
  turno: TurnoFreela
  observacao?: string
}

// O que a página do link sabe de quem digitou CPF e celular (nada além do primeiro nome e do fim do Pix).
export type QuemSouFreela =
  | { tipo: 'invalido' | 'novo' | 'funcionario' }
  | { tipo: 'freelancer'; nome: string; pixFinal: string }

export interface PagamentoFreela {
  freelancerId: string
  // Segunda-feira que abre a semana trabalhada.
  semana: string
  valor: number
  pagoEm: string
  pagoPor: string | null
}

// Pagamento do mês de referência ('AAAA-MM'), com os valores que a contabilidade manda.
// Adiantamento sai no dia 20; salário no dia 05 do mês seguinte. A pessoa só vê depois de liberado.
export type TipoPagamento = 'adiantamento' | 'salario'
// Conta da empresa que paga os salários e as diárias pelo banco.
export interface ContaPagamento {
  id: string
  nome: string
  banco: string
  empresaCnpj: string
  empresaNome: string
  agencia: string
  conta: string
  dac: string
  endereco: string | null
  numero: string | null
  cidade: string | null
  cep: string | null
  estado: string | null
  padrao: boolean
}

// Arquivo (ou envio por API) de pagamento já gerado.
export interface RemessaPagamento {
  id: string
  numero: number
  contaId: string
  tipo: 'salario' | 'adiantamento' | 'freelancer'
  referencia: string
  dataPagamento: string
  quantidade: number
  valorTotal: number
  via: 'arquivo' | 'api'
  arquivo: string | null
  criadoEm: string
}

export interface RubricaHolerite {
  descricao: string
  valor: number
  tipo: 'credito' | 'desconto'
}

export interface Salario {
  funcionarioId: string
  mes: string
  tipo: TipoPagamento
  descAdiantamento: number
  salario: number
  caixinha: number
  bonusCaixinha: number
  bonusConclui: number
  descFaltas: number
  descAtrasos: number
  inss: number
  descVt: number
  // Rubricas do holerite sem campo próprio (adicional noturno, auxílio uniforme, consignado…).
  outrosCreditos: number
  outrosDescontos: number
  rubricas?: RubricaHolerite[] | null
  observacao: string | null
  liberado: boolean
  // PDF do holerite enviado pela contabilidade (caminho no armazenamento).
  holerite?: string | null
}

// Período anterior de quem saiu e voltou (readmissão).
export interface VinculoAnterior {
  id: string
  funcionarioId: string
  admissao: string
  desligamento: string
  tipoDesligamento: string | null
  cargo: string | null
  observacao: string | null
}

// Férias gozadas, ligadas ao período aquisitivo (que começa no aniversário da admissão).
export interface Ferias {
  id: string
  funcionarioId: string
  aquisitivoInicio: string
  inicio: string
  dias: number
  abonoDias: number
  observacao: string | null
}

// Parcela do 13º paga (a 1ª pode ser adiantada).
export interface DecimoTerceiro {
  id: string
  funcionarioId: string
  ano: number
  parcela: 1 | 2
  valor: number
  pagoEm: string
  observacao: string | null
}

// Motivos mais comuns de advertência e suspensão (o documento cita a natureza).
export const NATUREZAS = [
  'Atraso',
  'Falta injustificada',
  'Uso de celular durante o trabalho',
  'Uniforme incompleto ou fora do padrão',
  'Higiene e manipulação de alimentos',
  'Descumprimento de procedimento',
  'Saída sem autorização',
  'Desrespeito a colega ou cliente',
  'Insubordinação',
]

// Desligamento em andamento: a gestão marca cada etapa do checklist até concluir.
export type TipoDesligamento = 'sem_justa_causa' | 'justa_causa' | 'pedido' | 'acordo' | 'fim_experiencia' | 'antecipacao_experiencia'
export const TIPOS_DESLIGAMENTO: { valor: TipoDesligamento; nome: string }[] = [
  { valor: 'sem_justa_causa', nome: 'Dispensa sem justa causa' },
  { valor: 'justa_causa', nome: 'Dispensa por justa causa' },
  { valor: 'pedido', nome: 'Pedido de demissão' },
  { valor: 'acordo', nome: 'Acordo (art. 484-A)' },
  { valor: 'fim_experiencia', nome: 'Fim do contrato de experiência' },
  { valor: 'antecipacao_experiencia', nome: 'Rescisão antecipada da experiência' },
]
export interface Desligamento {
  id: string
  funcionarioId: string
  data: string
  tipo: TipoDesligamento
  // Etapas feitas: chave da etapa → quem marcou e quando.
  itens: Record<string, { por: string; em: string }>
  observacao: string | null
  concluido: boolean
}

// Equipamentos mais caros de cada loja, com histórico de manutenções (inventário).
export interface Equipamento {
  id: string
  unidadeId: string
  nome: string
  marcaModelo: string | null
  numeroSerie: string | null
  local: string | null
  dataCompra: string | null
  valorCompra: number | null
  valorAtual: number | null
  foto: string | null
  observacao: string | null
  ativo: boolean
}
export type TipoManutencao = 'corretiva' | 'preventiva'
export interface ManutencaoEquipamento {
  id: string
  equipamentoId: string
  data: string
  tipo: TipoManutencao
  descricao: string
  prestador: string | null
  custo: number | null
  chamadoId: string | null
  registradoPor: string | null
}
// Item de manutenção preventiva: o que verificar e a cada quantos dias. unidadeId nulo = todas as lojas.
export interface Preventiva {
  id: string
  unidadeId: string | null
  equipamentoId: string | null
  titulo: string
  descricao: string | null
  frequenciaDias: number
  primeiraEm: string
  ativo: boolean
}
export interface ExecucaoPreventiva {
  id: string
  preventivaId: string
  unidadeId: string | null
  feitoEm: string
  observacao: string | null
  feitoPor: string | null
}

// Tamanhos do cadastro.
export const TAMANHOS_CAMISETA = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG']
export const TAMANHOS_CALCA = ['34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54']
export const TAMANHOS_CALCADO = Array.from({ length: 13 }, (_, i) => 34 + i)

// Pedido de troca de uniforme feito pelo próprio funcionário.
export const ITENS_TROCA = ['Camiseta', 'Calça', 'Sapato', 'Avental', 'Boné / touca', 'Outro']
export type StatusTroca = 'aberta' | 'atendida' | 'recusada'
export interface SolicitacaoUniforme {
  id: string
  funcionarioId: string
  itens: string[]
  motivo: string
  foto: string | null
  status: StatusTroca
  resposta: string | null
  respondidoPor: string | null
  respondidoEm: string | null
  criadoEm: string
}

// Pedido de compra de uniformes (por leva), para orçamento com o fornecedor.
export type StatusPedidoUniforme = 'rascunho' | 'orcamento' | 'pedido' | 'recebido'
export const STATUS_PEDIDO_UNIFORME: { valor: StatusPedidoUniforme; nome: string }[] = [
  { valor: 'rascunho', nome: 'Montando' },
  { valor: 'orcamento', nome: 'Em orçamento' },
  { valor: 'pedido', nome: 'Pedido feito' },
  { valor: 'recebido', nome: 'Recebido' },
]
export type Modelagem = 'feminina' | 'masculina' | 'unissex'
export interface PedidoUniforme {
  id: string
  numero: number
  titulo: string
  status: StatusPedidoUniforme
  fornecedor: string | null
  observacao: string | null
  // Valor combinado com o fornecedor, quando o pedido foi fechado e quando deve chegar.
  valorTotal?: number | null
  fechadoEm?: string | null
  previsaoEntrega?: string | null
  criadoEm: string
}
export interface ItemPedidoUniforme {
  id: string
  pedidoId: string
  funcionarioId: string | null
  item: string
  cor: string | null
  modelagem: Modelagem | null
  tamanho: string | null
  quantidade: number
}
