import type { EnvioFreela, DiaEnviado, QuemSouFreela, StatusEnvioFreela, ContaPagamento, RemessaPagamento, Setor, VinculoAnterior, SolicitacaoUniforme, PedidoUniforme, ItemPedidoUniforme, StatusTroca, Equipamento, ManutencaoEquipamento, Preventiva, ExecucaoPreventiva, Desligamento, DecimoTerceiro, Ferias, TipoFolga, Salario, TipoPagamento, Freelancer, DiariaFreela, PagamentoFreela, Ficha, ResultadoMes, Avaliacao, Chamado, CategoriaChamado, Gravidade, StatusChamado, LeituraRegulamento, Turno, VersaoRegulamento, Comunicado, Documento, EntregaUniforme, ItemUniforme, Folga, Funcionario, Ocorrencia, TipoDocumento, TipoOcorrencia, Unidade, VendaDia } from './types'

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
  natureza?: string | null
  suspensaoInicio?: string | null
  suspensaoDias?: number | null
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
  setores?: Setor[] | null
  destinatarios?: string[] | null
}

// Tudo que as telas precisam. Há duas implementações: demonstração (dados de exemplo
// em memória) e Supabase (dados reais, com as regras de acesso aplicadas no banco).
export interface Store {
  modo: 'demo' | 'supabase'
  sessaoAtual(): Promise<Funcionario | null>
  // lembrar: mantém o acesso neste aparelho até a pessoa tocar em Sair.
  entrar(celular: string, senha: string, lembrar?: boolean): Promise<Funcionario>
  sair(): Promise<void>

  unidades(): Promise<Unidade[]>
  // Só id e nome de todos (inclusive inativos), para mostrar quem publicou um aviso ou registrou algo.
  nomes(): Promise<{ id: string; nome: string }[]>
  funcionarios(): Promise<Funcionario[]>
  salvarFuncionario(f: NovoFuncionario, senhaInicial?: string): Promise<Funcionario>
  // Foto de perfil (já recortada e reduzida). A própria pessoa ou a gestão.
  definirFoto(funcionarioId: string, imagem: Blob): Promise<void>

  documentos(funcionarioId: string): Promise<Documento[]>
  enviarDocumento(d: NovoDocumento): Promise<Documento>
  abrirDocumento(d: Documento): Promise<string | null>
  // Todos os documentos que eu posso ver (para o controle de vencimentos).
  documentosTodos(): Promise<Documento[]>

  uniformes(funcionarioId: string): Promise<EntregaUniforme[]>
  registrarUniforme(e: NovaEntregaUniforme): Promise<EntregaUniforme>
  // Só a própria pessoa assina pelo portal.
  assinarUniforme(entregaId: string, assinatura: string): Promise<void>
  // Pedido de troca: a pessoa pede pelo próprio cadastro; a gestão vê todos e responde.
  solicitacoesUniforme(funcionarioId?: string): Promise<SolicitacaoUniforme[]>
  pedirTrocaUniforme(s: { funcionarioId: string; itens: string[]; motivo: string; foto?: Blob }): Promise<void>
  responderTrocaUniforme(id: string, status: StatusTroca, resposta: string): Promise<void>
  fotoSolicitacao(s: SolicitacaoUniforme): Promise<string | null>
  // Pedidos de compra de uniformes por leva (só a gestão).
  // Pagamento pelo banco (arquivo do Itaú hoje; a API quando estiver liberada).
  contasPagamento(): Promise<ContaPagamento[]>
  salvarContaPagamento(c: Omit<ContaPagamento, 'id'> & { id?: string }): Promise<ContaPagamento>
  remessasPagamento(tipo: RemessaPagamento['tipo'], referencia: string): Promise<RemessaPagamento[]>
  registrarRemessa(r: Omit<RemessaPagamento, 'id' | 'numero' | 'criadoEm'>): Promise<RemessaPagamento>
  pedidosUniforme(): Promise<PedidoUniforme[]>
  salvarPedidoUniforme(p: Pick<PedidoUniforme, 'titulo' | 'status' | 'fornecedor' | 'observacao' | 'valorTotal' | 'fechadoEm' | 'previsaoEntrega'> & { id?: string }): Promise<PedidoUniforme>
  excluirPedidoUniforme(id: string): Promise<void>
  itensPedidoUniforme(pedidoId: string): Promise<ItemPedidoUniforme[]>
  // Troca todas as peças de uma pessoa (ou avulsas, funcionarioId null) dentro do pedido.
  definirItensPedido(pedidoId: string, funcionarioId: string | null, itens: Omit<ItemPedidoUniforme, 'id' | 'pedidoId' | 'funcionarioId'>[]): Promise<void>

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
  // Só a gestão: tipo null tira a folga do dia.
  definirFolga(funcionarioId: string, data: string, tipo: TipoFolga | null): Promise<void>

  // Férias e 13º (só a gestão vê e registra).
  ferias(funcionarioId?: string): Promise<Ferias[]>
  registrarFerias(f: Omit<Ferias, 'id'>): Promise<void>
  excluirFerias(id: string): Promise<void>
  decimoTerceiro(funcionarioId: string): Promise<DecimoTerceiro[]>
  registrarDecimoTerceiro(d: Omit<DecimoTerceiro, 'id'>): Promise<void>
  excluirDecimoTerceiro(id: string): Promise<void>

  // Checklist de desligamento (só a gestão). Sem funcionarioId: todos os que eu vejo.
  desligamentos(funcionarioId?: string): Promise<Desligamento[]>
  abrirDesligamento(d: Pick<Desligamento, 'funcionarioId' | 'data' | 'tipo' | 'observacao'>): Promise<Desligamento>
  excluirDesligamento(id: string): Promise<void>
  atualizarDesligamento(id: string, mudanca: Partial<Pick<Desligamento, 'itens' | 'concluido' | 'observacao' | 'data' | 'tipo'>>): Promise<void>

  // Painel (Proprietário e Gerente): pedidos e faturamento por dia/loja/canal, e notas nas plataformas.
  vendasEntre(inicio: string, fim: string): Promise<VendaDia[]>

  // Caixinha: valor total arrecadado no mês ('AAAA-MM') por loja. Só a gestão.
  caixinhaTotais(mes: string): Promise<Record<string, number>>
  salvarCaixinhaTotal(mes: string, unidadeId: string, valor: number): Promise<void>
  avaliacoes(): Promise<Avaliacao[]>

  // Salários do mês. A gestão vê e lança todos; cada pessoa vê os seus meses já liberados.
  salarios(mes: string): Promise<Salario[]>
  salariosDe(funcionarioId: string): Promise<Salario[]>
  salvarSalario(s: Salario): Promise<void>
  liberarSalarios(mes: string, tipo: TipoPagamento, liberado: boolean): Promise<void>
  // Holerite em PDF de um pagamento (a gestão envia; a pessoa abre o seu quando liberado).
  enviarHolerite(s: Salario, pdf: Blob): Promise<void>
  abrirHolerite(s: Salario): Promise<string | null>

  // Readmissão: guarda o período anterior e reativa com a nova data de admissão.
  vinculosAnteriores(funcionarioId: string): Promise<VinculoAnterior[]>
  readmitir(f: Funcionario, novaAdmissao: string, tipoDesligamento: string | null): Promise<void>

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

  // Equipamentos e manutenção preventiva (manutenção e gestão).
  equipamentos(): Promise<Equipamento[]>
  salvarEquipamento(e: Omit<Equipamento, 'id' | 'foto'> & { id?: string }, foto?: Blob): Promise<Equipamento>
  fotoEquipamento(e: Equipamento): Promise<string | null>
  manutencoesEquipamento(equipamentoId?: string): Promise<ManutencaoEquipamento[]>
  registrarManutencaoEquipamento(m: Omit<ManutencaoEquipamento, 'id' | 'registradoPor'>): Promise<void>
  excluirManutencaoEquipamento(id: string): Promise<void>
  preventivas(): Promise<Preventiva[]>
  salvarPreventiva(p: Omit<Preventiva, 'id'> & { id?: string }): Promise<void>
  excluirPreventiva(id: string): Promise<void>
  execucoesPreventiva(): Promise<ExecucaoPreventiva[]>
  registrarExecucao(x: Omit<ExecucaoPreventiva, 'id' | 'feitoPor'>): Promise<void>
  excluirExecucao(id: string): Promise<void>

  // Copiados do Lucro Fácil por uma rotina. atualizadoEm = última cópia (null se nunca).
  // Fichas: todos veem; os custos só chegam para a gestão.
  fichas(): Promise<{ fichas: Ficha[]; atualizadoEm: string | null }>
  // Resultado do mês por loja: só Proprietário e Administrativo.
  resultados(): Promise<{ linhas: ResultadoMes[]; atualizadoEm: string | null }>

  // Freelancers (só a gestão). semana = segunda-feira que abre a semana.
  freelancers(): Promise<Freelancer[]>
  salvarFreelancer(f: Omit<Freelancer, 'id'> & { id?: string }): Promise<Freelancer>
  // Leva junto diárias e envios; recusa se já houver pagamento marcado.
  excluirFreelancer(id: string): Promise<void>
  diariasFreela(inicio: string, fim: string): Promise<DiariaFreela[]>
  lancarDiaria(d: Omit<DiariaFreela, 'id' | 'lancadoPor'>): Promise<DiariaFreela>
  excluirDiaria(id: string): Promise<void>
  pagamentosFreela(semana: string): Promise<PagamentoFreela[]>
  marcarPagoFreela(freelancerId: string, semana: string, valor: number): Promise<void>
  desfazerPagoFreela(freelancerId: string, semana: string): Promise<void>
  // Diárias mandadas pelo próprio freelancer (link da loja, sem login) ou pelo funcionário (login).
  lojasParaDiaria(): Promise<Unidade[]>
  freelaQuemSou(cpf: string, celular: string): Promise<QuemSouFreela>
  enviarDiarias(e: { cpf: string; celular: string; nome: string; pix: string; unidadeId: string; funcao: string; dias: DiaEnviado[] }): Promise<number>
  enviarMinhasDiarias(e: { pix: string; unidadeId: string; funcao: string; dias: DiaEnviado[] }): Promise<number>
  enviosFreela(status: StatusEnvioFreela | 'meus'): Promise<EnvioFreela[]>
  aprovarEnvioFreela(id: string, valor: number, funcao: string, usarPixNovo: boolean): Promise<void>
  recusarEnvioFreela(id: string, motivo: string): Promise<void>
}

export const soDigitos = (s: string) => s.replace(/\D/g, '')
