// Junta o que a rotina copiou do Lucro Fácil num lucro.json para a importação.
// Uso: node scripts/lucro/montar.mjs <pasta-de-dados> <saida.json>
//
// Na pasta de dados (cada arquivo é a resposta da ferramenta, como veio):
//   abc-<empresa>.json     get-abc-curve (dimension=products) de cada loja      (opcional)
//   receitas/<id>.json     get-product-recipe de cada produto                   (opcional)
//   resultado-<empresa>-<AAAA-MM>.json   get-financial-summary                  (opcional)
// Sem receitas, o arquivo sai sem "fichas" e a importação mantém as atuais.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [pasta, saida] = process.argv.slice(2)
if (!pasta || !saida) throw new Error('uso: montar.mjs <pasta> <saida.json>')

// Empresa do Lucro Fácil -> loja do portal. Central de Produção e Eventos não têm loja.
const EMPRESAS = { 410: 'burger-psd', 411: 'burger-va', 412: 'pizza' }
const ler = (f) => JSON.parse(readFileSync(f, 'utf8'))
const arquivos = readdirSync(pasta)

// Preço médio de venda de cada produto nas lojas (faturamento ÷ quantidade da curva ABC):
// o preço cadastrado no Lucro Fácil quase sempre está zerado.
const vendas = new Map()
for (const f of arquivos.filter((a) => /^abc-\d+\.json$/.test(a))) {
  for (const i of ler(join(pasta, f)).items ?? []) {
    if (i.is_unmapped || typeof i.id !== 'number') continue
    const v = vendas.get(i.id) ?? { q: 0, r: 0 }
    v.q += i.quantity
    v.r += i.revenue
    vendas.set(i.id, v)
  }
}

const dirReceitas = join(pasta, 'receitas')
const receitas = existsSync(dirReceitas)
  ? readdirSync(dirReceitas).filter((a) => a.endsWith('.json')).map((a) => ler(join(dirReceitas, a)))
  : []
// Preparo = produto usado dentro de outra ficha.
const usados = new Set(receitas.flatMap((r) => r.recipe.filter((i) => i.ingredient_source === 'product').map((i) => i.ingredient_id)))

const fichas = receitas.map((r) => {
  const v = vendas.get(r.product.id)
  return {
    id: r.product.id,
    nome: r.product.name,
    categoria: null,
    preparo: usados.has(r.product.id) || /^(base |!)/i.test(r.product.name),
    custo: r.product.unit_cost ?? 0,
    preco: v && v.q ? Math.round((v.r / v.q) * 100) / 100 : 0,
    itens: r.recipe.map((i) => ({
      nome: i.name, unidade: i.unit, qtd: i.qty, tamanho: i.size ?? null,
      preparoId: i.ingredient_source === 'product' ? i.ingredient_id : null,
      custoUnit: i.unit_cost ?? 0,
    })),
  }
})

const resultados = []
for (const f of arquivos) {
  const m = f.match(/^resultado-(\d+)-(\d{4}-\d{2})\.json$/)
  if (!m || !EMPRESAS[m[1]]) continue
  const d = ler(join(pasta, f))
  resultados.push({
    unidade: EMPRESAS[m[1]], mes: d.periodo ?? m[2], pedidos: d.pedidos, faturamento: d.faturamento, cmv: d.cmv, impostos: d.impostos,
    comissoes: d.comissoes, taxasPagamento: d.taxas_pagamento, custosOperacionais: d.custos_operacionais,
    lucroOperacional: d.lucro_operacional, ticketMedio: d.ticket_medio,
  })
}

const dados = { geradoEm: new Date().toISOString() }
if (fichas.length) dados.fichas = fichas
if (resultados.length) dados.resultados = resultados
writeFileSync(saida, JSON.stringify(dados))
console.log(`${fichas.length} fichas, ${resultados.length} resultados -> ${saida}`)
