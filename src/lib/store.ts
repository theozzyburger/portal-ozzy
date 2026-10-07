import type { Avaliacao, Chamado, CategoriaChamado, Gravidade, StatusChamado, LeituraRegulamento, Turno, VersaoRegulamento, Comunicado, Documento, EntregaUniforme, ItemUniforme, Folga, Funcionario, Ocorrencia, TipoDocumento, TipoOcorrencia, Unidade, VendaDia } from './types'

export type NovoFuncionario = Omit<Funcionario, 'id'> & { id?: string }

export interface NovoDocumento {
  funcionarioId: string
  tipo: TipoDocumento
  arquivo: File
  observacao?: string
  inicio?: string
  fim?: string
  realizadoEm?: string
  vence?: string
}

export interface NovaEntregaUniforme {
  funcionarioId: string
  data: string
  itens: ItemUniforme[]
  observacao?: string
  // Quando a pessoa assina na hora, no aparelho de quem está entregando.
  assinatura?: string
}

export interface NovaOcorrencia {
  funcionarioId: string
  tipo: TipoOcorrencia
  data: string
  descricao: string
}

export interface NovoChamado {
  unidadeId: string
  categoria: CategoriaChamado
  gravidade: Gravidade
  titulo: string
  descricao: string
  local?: string
  foto?: File
}

export interface NovoComunicado {
  titulo: string
  corpo: string
  unidadeId: string | null
}

// Tudo que as telas precisam. Há duas implementações: demonstração (dados de exemplo
// em memória) e Supabase (dados reais, com as regras de acesso aplicadas no banco).
export interface Store {
  modo: 'demo' | 'supabase'
  sessaoAtual(): Promise<Funcionario | null>
  entrar(celular: string, senha: string): Promise<Funcionario>
  sair(): Promise<void>

  unidades(): Promise<Unidade[]>
  // Só id e nome de todos (inclusive inativos), para mostrar quem publicou um aviso ou registrou algo.
  nomes(): Promise<{ id: string; nome: string }[]>
  funcionarios(): Promise<Funcionario[]>
  salvarFuncionario(f: NovoFuncionario, senhaInicial?: string): Promise<Funcionario>

  documentos(funcionarioId: string): Promise<Documento[]>
  enviarDocumento(d: NovoDocumento): Promise<Documento>
  abrirDocumento(d: Documento): Promise<string | null>
  // Todos os documentos que eu posso ver (para o controle de vencimentos).
  documentosTodos(): Promise<Documento[]>

  uniformes(funcionarioId: string): Promise<EntregaUniforme[]>
  registrarUniforme(e: NovaEntregaUniforme): Promise<EntregaUniforme>
  // Só a própria pessoa assina pelo portal.
  assinarUniforme(entregaId: string, assinatura: string): Promise<void>

  ocorrencias(funcionarioId: string): Promise<Ocorrencia[]>
  // Para o painel da gestão: tudo que eu posso ver num período.
  ocorrenciasEntre(inicio: string, fim: string): Promise<Ocorrencia[]>
  atestadosEntre(inicio: string, fim: string): Promise<Documento[]>
  registrarOcorrencia(o: NovaOcorrencia): Promise<Ocorrencia>

  comunicados(): Promise<Comunicado[]>
  publicarComunicado(c: NovoComunicado): Promise<Comunicado>
  marcarLido(comunicadoId: string): Promise<void>

  folgas(inicio: string, fim: string): Promise<Folga[]>
  alternarFolga(funcionarioId: string, data: string): Promise<void>

  // Painel (Proprietário e Gerente): pedidos e faturamento por dia/loja/canal, e notas nas plataformas.
  vendasEntre(inicio: string, fim: string): Promise<VendaDia[]>

  // Caixinha: valor total arrecadado no mês ('AAAA-MM') por loja. Só a gestão.
  caixinhaTotais(mes: string): Promise<Record<string, number>>
  salvarCaixinhaTotal(mes: string, unidadeId: string, valor: number): Promise<void>
  avaliacoes(): Promise<Avaliacao[]>

  // Turnos-padrão (horários). Todos veem; a gestão coloca cada pessoa no seu turno.
  turnos(): Promise<Turno[]>
  atribuirTurno(funcionarioId: string, turnoId: string | null): Promise<void>
  // Só a gestão: cria (novo = true) ou altera um turno; apagar tira as pessoas dele.
  salvarTurno(t: Turno, novo: boolean): Promise<void>
  excluirTurno(id: string): Promise<void>

  // Regulamento interno: versões (a mais nova primeiro). Todos leem; a gestão publica.
  // Cada pessoa assina a versão vigente; a gestão vê as assinaturas de todos.
  versoesRegulamento(): Promise<VersaoRegulamento[]>
  publicarRegulamento(texto: string, nota: string): Promise<VersaoRegulamento>
  leiturasRegulamento(): Promise<LeituraRegulamento[]>

  // Chamados de manutenção. Quem abre, data e hora são registrados automaticamente.
  // Funcionário vê os da sua loja e os que abriu; manutenção e gestão veem todos.
  chamados(): Promise<Chamado[]>
  abrirChamado(c: NovoChamado): Promise<Chamado>
  // Só manutenção e gestão mudam o status; qualquer um que vê o chamado pode comentar.
  atualizarChamado(id: string, mudanca: { status?: StatusChamado; texto?: string }): Promise<void>
  fotoChamado(c: Chamado): Promise<string | null>
  assinarRegulamento(versaoId: string, assinatura: string): Promise<void>
}

export const soDigitos = (s: string) => s.replace(/\D/g, '')
