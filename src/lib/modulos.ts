import { podeGerenciar } from './permissoes'
import type { Nivel } from './types'

export type IdIcone =
  | 'inicio' | 'rh' | 'financeiro' | 'administrativo' | 'compras' | 'estoque'
  | 'checklists' | 'regras' | 'treinamentos' | 'manutencao' | 'eventos'

export interface Modulo {
  id: IdIcone
  nome: string
  pronto: boolean
  // Para os módulos "em breve": o que vai ter e de onde vêm os dados.
  resumo?: string
  itens?: string[]
  origem?: string
  soGestao?: boolean
}

// Ordem do menu lateral. Os "em breve" seguem o plano e o roteiro da reunião de regras.
export const MODULOS: Modulo[] = [
  { id: 'inicio', nome: 'Início', pronto: true },
  { id: 'rh', nome: 'RH', pronto: true },
  {
    id: 'financeiro', nome: 'Financeiro', pronto: false, soGestao: true,
    resumo: 'Custos e resultados das duas unidades num só lugar.',
    itens: ['CMV atualizado por produto', 'Fichas técnicas e custo de cada item', 'Faturamento e despesas por unidade'],
    origem: 'Dados puxados do Lucro Fácil, sem tirar nada do sistema atual.',
  },
  {
    id: 'administrativo', nome: 'Administrativo', pronto: false,
    resumo: 'Rotina do escritório e quem pode decidir o quê.',
    itens: ['Contas a pagar e aprovações', 'Pedidos de reembolso com comprovante', 'Matriz de autoridade com limites de valor'],
    origem: 'Regras definidas na reunião de estrutura e processos.',
  },
  {
    id: 'compras', nome: 'Compras', pronto: false,
    resumo: 'Do pedido de compra até a conferência da nota.',
    itens: ['Solicitação de compra por unidade', 'Cotação e aprovação por valor', 'Recebimento com conferência e fotos'],
  },
  {
    id: 'estoque', nome: 'Estoque', pronto: false,
    resumo: 'Entradas, saídas e perdas sob controle.',
    itens: ['Inventário semanal', 'Transferências entre Burger e Pizza', 'Registro de perdas com motivo'],
  },
  {
    id: 'checklists', nome: 'Checklists', pronto: false,
    resumo: 'Abertura, fechamento e limpeza de cada pessoa.',
    itens: ['Checklists do dia por cargo', 'Quem fez e quem ficou pendente', 'Controle de temperatura dos equipamentos'],
    origem: 'Integração com o Conclui.',
  },
  {
    id: 'regras', nome: 'Regras e processos', pronto: false,
    resumo: 'A versão oficial de como a The Ozzy funciona.',
    itens: ['POPs e políticas por área', 'Manual de exceções', 'Assistente que responde dúvidas só com base nas regras oficiais'],
    origem: 'Conteúdo da reunião de estrutura, regras e processos.',
  },
  {
    id: 'treinamentos', nome: 'Treinamentos', pronto: false,
    resumo: 'Vídeos curtos, gravados pela própria equipe.',
    itens: ['Trilhas por cargo', 'Treinamento obrigatório para quem entra', 'Progresso de cada funcionário'],
  },
  {
    id: 'manutencao', nome: 'Manutenção', pronto: false,
    resumo: 'Equipamento parado não pode esperar.',
    itens: ['Cadastro de equipamentos críticos', 'Abertura e acompanhamento de chamados', 'Agenda de manutenção preventiva'],
  },
  {
    id: 'eventos', nome: 'Eventos', pronto: false,
    resumo: 'Do orçamento ao resultado de cada evento.',
    itens: ['Orçamento e cálculo de custo', 'Checklist de pré-evento', 'Resultado e aprendizados'],
  },
]

export const modulosVisiveis = (n: Nivel) => MODULOS.filter((m) => !m.soGestao || podeGerenciar(n))
