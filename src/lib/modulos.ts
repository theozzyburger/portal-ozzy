import { podeGerenciar, vejoResultado } from './permissoes'
import type { Nivel } from './types'

export type IdIcone =
  | 'inicio' | 'rh' | 'freelancers' | 'motoboys' | 'producao' | 'fichas' | 'financeiro' | 'administrativo' | 'compras' | 'estoque'
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
  // Regra própria de quem vê (no lugar de soGestao).
  ve?: (n: Nivel) => boolean
}

// Ordem do menu lateral. Funcionário, Supervisor e Manutenção não veem Fichas, Administrativo,
// Compras, Estoque e Eventos (pedido de 07/10). Os "em breve" seguem o plano e o roteiro da reunião de regras.
export const MODULOS: Modulo[] = [
  { id: 'inicio', nome: 'Início', pronto: true },
  { id: 'rh', nome: 'Departamento Pessoal', pronto: true },
  // Menu próprio (pedido de 08/10), para a gestão achar rápido as diárias enviadas.
  { id: 'freelancers', nome: 'Freelancers', pronto: true, soGestao: true },
  // Cadastro e pagamento semanal dos motoboys (09/10), que não são da equipe.
  { id: 'motoboys', nome: 'Motoboys', pronto: true, soGestao: true },
  // Central de produção (09/10): lançar o que foi produzido; depois pedidos das lojas e lista de preparo.
  { id: 'producao', nome: 'Produção', pronto: true, soGestao: true },
  { id: 'fichas', nome: 'Fichas técnicas', pronto: true, soGestao: true },
  {
    id: 'financeiro', nome: 'Financeiro', pronto: true, ve: vejoResultado,
    resumo: 'Contas a pagar, despesas por conta contábil e loja, e o resultado do Lucro Fácil.',
  },
  {
    id: 'administrativo', soGestao: true, nome: 'Administrativo', pronto: false,
    resumo: 'Rotina do escritório e quem pode decidir o quê.',
    itens: ['Contas a pagar e aprovações', 'Pedidos de reembolso com comprovante', 'Matriz de autoridade com limites de valor'],
    origem: 'Regras definidas na reunião de estrutura e processos.',
  },
  {
    id: 'compras', soGestao: true, nome: 'Compras', pronto: true,
    resumo: 'Do pedido de compra até a conferência da nota.',
    itens: ['Solicitação de compra por unidade', 'Cotação e aprovação por valor', 'Recebimento com conferência e fotos'],
  },
  {
    id: 'estoque', soGestao: true, nome: 'Estoque', pronto: true,
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
    id: 'regras', nome: 'Regras e processos', pronto: true,
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
    id: 'manutencao', nome: 'Manutenção', pronto: true,
    resumo: 'Equipamento parado não pode esperar.',
    itens: ['Cadastro de equipamentos críticos', 'Abertura e acompanhamento de chamados', 'Agenda de manutenção preventiva'],
  },
  {
    // Entrega 1 (08/10): cadastro de eventos. Fichas, previsão, insumos e simulador vêm em seguida.
    id: 'eventos', soGestao: true, nome: 'Eventos', pronto: true,
    resumo: 'Do orçamento ao resultado de cada evento.',
    itens: ['Cadastro e status de cada evento', 'Cardápio, fichas e previsão de vendas', 'Insumos, simulador e resultado'],
  },
]

export const modulosVisiveis = (n: Nivel) => MODULOS.filter((m) => (m.ve ? m.ve(n) : !m.soGestao || podeGerenciar(n)))
