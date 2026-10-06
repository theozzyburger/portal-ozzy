import type { Comunicado, Documento, Folga, Funcionario, Ocorrencia, TipoDocumento, TipoOcorrencia, Unidade } from './types'

export type NovoFuncionario = Omit<Funcionario, 'id'> & { id?: string }

export interface NovoDocumento {
  funcionarioId: string
  tipo: TipoDocumento
  arquivo: File
  observacao?: string
  inicio?: string
  fim?: string
}

export interface NovaOcorrencia {
  funcionarioId: string
  tipo: TipoOcorrencia
  data: string
  descricao: string
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
}

export const soDigitos = (s: string) => s.replace(/\D/g, '')
