import { addMeses, hoje, mesDe } from './datas'
import type { Ficha, ItemFicha, ResultadoMes } from './types'

// Dados de EXEMPLO do Lucro Fácil para o modo demonstração.

type Linha = [nome: string, unidade: string, qtd: number, custoUnit: number, preparoId?: number, tamanho?: string]

const ficha = (produtoId: number, nome: string, preco: number, linhas: Linha[], categoria: string | null = null, preparo = false): Ficha => {
  const itens: ItemFicha[] = linhas.map(([n, unidade, qtd, , preparoId, tamanho]) => ({ nome: n, unidade, qtd, tamanho: tamanho ?? null, preparoId: preparoId ?? null }))
  const custos = linhas.map(([, , qtd, custoUnit]) => ({ custoUnit, total: Math.round(qtd * custoUnit * 10000) / 10000 }))
  const total = Math.round(custos.reduce((s, c) => s + c.total, 0) * 100) / 100
  return { produtoId, nome, categoria, preparo, itens, custo: { total, preco, itens: custos } }
}

export const fichasDemo = (): Ficha[] => [
  ficha(9001, 'Molho Especial', 0, [
    ['Maionese', 'kg', 0.7, 14.9], ['Ketchup', 'kg', 0.15, 8.73], ['Mostarda', 'kg', 0.1, 8.51], ['Picles picado', 'kg', 0.05, 45.03],
  ], null, true),
  ficha(9002, 'Base Pizza Calabresa', 0, [
    ['Molho de Tomate Pizza', 'l', 0.12, 39.02], ['Calabresa Linguiça', 'kg', 0.12, 22.19], ['Cebola', 'kg', 0.05, 6.79],
  ], null, true),
  ficha(15405, 'MELBOURNE', 35.9, [
    ['Pão de Leite (pct c/4)', 'unit', 1, 1.92], ['Blend burger (100g)', 'unit', 1, 3.33], ['American Cheese', 'kg', 0.02, 42.61],
    ['Alface Americana', 'unit', 0.02, 18.02], ['Tomate Carmen', 'kg', 0.02, 10.1], ['Molho Especial', 'kg', 0.02, 11.76, 9001],
    ['Picles Burgers', 'kg', 0.01, 45.03], ['Kit Embalagens Genéricas', 'unit', 1, 1.2],
  ]),
  ficha(15406, '2 MELBOURNE', 69.9, [
    ['Pão de Leite (pct c/4)', 'unit', 2, 1.92], ['Blend burger (100g)', 'unit', 2, 3.33], ['American Cheese', 'kg', 0.04, 42.61],
    ['Alface Americana', 'unit', 0.04, 18.02], ['Tomate Carmen', 'kg', 0.04, 10.1], ['Molho Especial', 'kg', 0.04, 11.76, 9001],
    ['Picles Burgers', 'kg', 0.02, 45.03], ['Sal Refinado', 'kg', 0.001, 15.18], ['Papel Térmico Delivery', 'unit', 2, 0.92],
    ['Kit Embalagens Genéricas', 'unit', 1, 1.2],
  ]),
  ficha(15949, 'Combo Tasmania', 56.9, [
    ['Pão Australiano (pct c/4)', 'unit', 1, 1.8], ['Blend burger (100g)', 'unit', 2, 3.33], ['Bacon Fatiado', 'kg', 0.03, 42],
    ['Cebola Caramelizada', 'kg', 0.03, 9.49], ['American Cheese', 'kg', 0.04, 42.61], ['Batata Frita Congelada', 'kg', 0.15, 23.9],
    ['Coca Cola 350ml', 'unit', 1, 3.2], ['Kit Embalagens Genéricas', 'unit', 1, 1.2],
  ], 'outro'),
  ficha(15876, 'Pizza Calabresa', 74.9, [
    ['Massa de Pizza 420g', 'unit', 1, 6.53, undefined, 'grande'], ['Base Pizza Calabresa', 'unit', 1, 6.61, 9002, 'grande'],
    ['Mussarela', 'kg', 0.18, 38.58, undefined, 'grande'], ['Caixa de Pizza Nº35', 'unit', 1, 0.07, undefined, 'grande'],
    ['Massa de Pizza 420g', 'unit', 0.5, 6.53, undefined, 'broto'], ['Base Pizza Calabresa', 'unit', 0.5, 6.61, 9002, 'broto'],
    ['Mussarela', 'kg', 0.09, 38.58, undefined, 'broto'],
  ], 'pizza'),
  ficha(15625, 'ADC Extra Piscina de Cheddar', 12.9, [['Creme de Cheddar', 'kg', 0.08, 16.9]]),
  ficha(15602, 'Água com gás 500 ml', 5, [['Água com gás 500 ml', 'unit', 1, 1.66]], 'bebida'),
]

// Resultado do mês por loja: números de exemplo.
export const resultadosDemo = (): ResultadoMes[] => {
  const base: Record<string, [pedidos: number, ticket: number]> = { 'burger-psd': [3000, 70], 'burger-va': [2100, 64], pizza: [1600, 92] }
  const linhas: ResultadoMes[] = []
  for (let i = 3; i >= 0; i--) {
    const mes = addMeses(mesDe(hoje()), -i)
    // O mês corrente vem parcial.
    const parte = i === 0 ? Number(hoje().slice(8, 10)) / 30 : 1
    for (const [unidadeId, [p, t]] of Object.entries(base)) {
      const pedidos = Math.round(p * parte * (1 + ((i * 7 + unidadeId.length) % 9) / 100))
      const faturamento = Math.round(pedidos * t * 100) / 100
      const cmv = Math.round(faturamento * (0.36 + (i % 3) / 100) * 100) / 100
      const impostos = Math.round(faturamento * 0.08 * 100) / 100
      const comissoes = Math.round(faturamento * 0.06 * 100) / 100
      const taxasPagamento = Math.round(faturamento * 0.012 * 100) / 100
      const custosOperacionais = Math.round(faturamento * 0.04 * 100) / 100
      linhas.push({
        unidadeId, mes, pedidos, faturamento, cmv, impostos, comissoes, taxasPagamento, custosOperacionais,
        lucroOperacional: Math.round((faturamento - cmv - impostos - comissoes - taxasPagamento - custosOperacionais) * 100) / 100,
        ticketMedio: t,
      })
    }
  }
  return linhas
}
