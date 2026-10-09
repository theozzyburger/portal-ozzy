import { custoFicha, type Catalogo } from './custos'
import type { Evento, VendaEvento } from './types'

// Contas do painel de eventos (pedido de 08/10): faturamento por evento, gastronomia, dia da semana e ano,
// produtos (o que mais fatura, o que mais sai por dia, margem pela ficha) e destaques em texto.
// Só olha vendas reais (importadas do DPEN ou lançadas). A taxa do organizador não entra: o faturamento é bruto.

export interface ResumoEvento {
  e: Evento
  fat: number
  itens: number
  dias: number
  ano: number
  porDia: number
  porDiaBarraca: number | null
}
export interface ResumoProduto {
  chave: string
  nome: string
  linha: string
  itens: number
  fat: number
  eventos: number
  // Itens por dia, contando só os dias dos eventos que tiveram o produto (não pune quem entrou em poucos eventos).
  porDia: number
  precoMedio: number
  custoUnit: number | null
  cmvPct: number | null
  // Faturamento menos o custo da ficha de hoje × itens (sem taxa do organizador nem impostos).
  margem: number | null
}
export interface Grupo {
  nome: string
  eventos: number
  dias: number
  fat: number
  porDia: number
  porDiaBarraca: number | null
}
export interface AnoAno {
  nome: string
  antes: ResumoEvento
  depois: ResumoEvento
  variacao: number // % do faturamento por dia
}
export interface Painel {
  eventos: ResumoEvento[]
  produtos: ResumoProduto[]
  gastronomias: Grupo[]
  diasSemana: { nome: string; dias: number; fat: number; porDia: number }[]
  linhas: { nome: string; fat: number; itens: number }[]
  anos: Grupo[]
  anoAno: AnoAno[]
  fat: number
  itens: number
  dias: number
  destaques: string[]
}

const SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const diaDaSemana = (d: string) => new Date(d + 'T12:00:00').getDay()
const mil = (n: number) => (n >= 1000 ? `R$ ${Math.round(n / 1000).toLocaleString('pt-BR')} mil` : `R$ ${Math.round(n).toLocaleString('pt-BR')}`)
// Bebida pelo nome, para as que vieram da planilha sem linha.
const BEBIDA = /\b(coca|guaran|agua|água|refri|suco|ch[aá]|cerveja|lemonade|soda|t[oô]nica|energ)/i
const pct = (n: number) => `${Math.round(n).toLocaleString('pt-BR')}%`

// Mesmo evento em anos diferentes: tira o ano, o que está entre parênteses e acentos.
export function chaveEvento(nome: string) {
  return nome
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function agrupar(lista: ResumoEvento[], chave: (r: ResumoEvento) => string): Grupo[] {
  const m = new Map<string, ResumoEvento[]>()
  for (const r of lista) m.set(chave(r), [...(m.get(chave(r)) ?? []), r])
  return [...m.entries()]
    .map(([nome, rs]) => {
      const fat = rs.reduce((s, r) => s + r.fat, 0)
      const dias = rs.reduce((s, r) => s + r.dias, 0)
      const comBarraca = rs.filter((r) => r.porDiaBarraca !== null)
      const diasBarraca = comBarraca.reduce((s, r) => s + r.dias * (r.e.barracas ?? 0), 0)
      return {
        nome, eventos: rs.length, dias, fat, porDia: dias ? fat / dias : 0,
        porDiaBarraca: diasBarraca ? comBarraca.reduce((s, r) => s + r.fat, 0) / diasBarraca : null,
      }
    })
    .sort((a, b) => b.fat - a.fat)
}

export function montarPainel(eventos: Evento[], vendas: VendaEvento[], cat: Catalogo | null): Painel {
  const porEvento = new Map<string, VendaEvento[]>()
  for (const v of vendas) porEvento.set(v.eventoId, [...(porEvento.get(v.eventoId) ?? []), v])

  const resumos: ResumoEvento[] = eventos
    .filter((e) => porEvento.has(e.id))
    .map((e) => {
      const vs = porEvento.get(e.id)!
      const fat = vs.reduce((s, v) => s + (v.total ?? 0), 0)
      const dias = new Set(vs.map((v) => v.data)).size
      const primeiro = vs.reduce((m, v) => (v.data < m ? v.data : m), vs[0].data)
      return {
        e, fat, dias, itens: vs.reduce((s, v) => s + v.quantidade, 0), ano: Number(primeiro.slice(0, 4)),
        porDia: fat / dias, porDiaBarraca: e.barracas ? fat / dias / e.barracas : null,
      }
    })
    .sort((a, b) => b.fat - a.fat)
  const ids = new Set(resumos.map((r) => r.e.id))
  const vendasOk = vendas.filter((v) => ids.has(v.eventoId))
  const diasDoEvento = new Map(resumos.map((r) => [r.e.id, r.dias]))

  // Produtos
  const prod = new Map<string, { nome: string; receitaId: string | null; itens: number; fat: number; eventos: Set<string> }>()
  for (const v of vendasOk) {
    const k = v.receitaId ?? 'n:' + v.produto.toLowerCase()
    const p = prod.get(k) ?? { nome: cat?.receitas.get(v.receitaId ?? '')?.nome ?? v.produto, receitaId: v.receitaId, itens: 0, fat: 0, eventos: new Set<string>() }
    p.itens += v.quantidade
    p.fat += v.total ?? 0
    p.eventos.add(v.eventoId)
    prod.set(k, p)
  }
  const produtos: ResumoProduto[] = [...prod.entries()]
    .map(([chave, p]) => {
      const dias = [...p.eventos].reduce((s, id) => s + (diasDoEvento.get(id) ?? 0), 0)
      const c = cat && p.receitaId ? custoFicha(cat, p.receitaId) : null
      // Ficha sem itens ou com custo zero não serve para margem.
      const custoUnit = c && c.total > 0 ? c.porUnidade : null
      const precoMedio = p.itens ? p.fat / p.itens : 0
      const r = cat && p.receitaId ? cat.receitas.get(p.receitaId) : undefined
      return {
        chave, nome: p.nome, linha: r?.linha ?? (r?.origem === 'revenda' || BEBIDA.test(p.nome) ? 'Bebidas' : 'Outros'), itens: p.itens, fat: p.fat, eventos: p.eventos.size,
        porDia: dias ? p.itens / dias : 0, precoMedio, custoUnit,
        cmvPct: custoUnit !== null && precoMedio ? (custoUnit / precoMedio) * 100 : null,
        margem: custoUnit !== null ? p.fat - custoUnit * p.itens : null,
      }
    })
    .sort((a, b) => b.fat - a.fat)

  const linhas = new Map<string, { fat: number; itens: number }>()
  for (const p of produtos) {
    const l = linhas.get(p.linha) ?? { fat: 0, itens: 0 }
    l.fat += p.fat
    l.itens += p.itens
    linhas.set(p.linha, l)
  }

  // Dia da semana: faturamento médio por dia de evento.
  const semana = new Map<number, { fat: number; dias: Set<string> }>()
  for (const v of vendasOk) {
    const d = diaDaSemana(v.data)
    const s = semana.get(d) ?? { fat: 0, dias: new Set<string>() }
    s.fat += v.total ?? 0
    s.dias.add(v.eventoId + v.data)
    semana.set(d, s)
  }
  const diasSemana = [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => semana.has(d))
    .map((d) => ({ nome: SEMANA[d], dias: semana.get(d)!.dias.size, fat: semana.get(d)!.fat, porDia: semana.get(d)!.fat / semana.get(d)!.dias.size }))

  // Mesmo evento, ano a ano (o mais recente contra o anterior).
  const porChave = new Map<string, ResumoEvento[]>()
  for (const r of resumos) porChave.set(chaveEvento(r.e.nome), [...(porChave.get(chaveEvento(r.e.nome)) ?? []), r])
  const anoAno: AnoAno[] = []
  for (const rs of porChave.values()) {
    const ord = [...rs].sort((a, b) => (a.e.dias[0]?.data ?? '').localeCompare(b.e.dias[0]?.data ?? ''))
    for (let i = ord.length - 1; i > 0; i--) {
      const depois = ord[i]
      const antes = [...ord.slice(0, i)].reverse().find((x) => x.ano < depois.ano)
      if (antes) {
        anoAno.push({ nome: depois.e.nome.replace(/\s*\b(19|20)\d{2}\b/, ''), antes, depois, variacao: (depois.porDia / antes.porDia - 1) * 100 })
        break
      }
    }
  }
  anoAno.sort((a, b) => b.variacao - a.variacao)

  const fat = resumos.reduce((s, r) => s + r.fat, 0)
  const dias = resumos.reduce((s, r) => s + r.dias, 0)
  const gastronomias = agrupar(resumos, (r) => r.e.gastronomia ?? 'Sem gastronomia')
  const anos = agrupar(resumos, (r) => String(r.ano)).sort((a, b) => a.nome.localeCompare(b.nome))

  // Destaques em texto, do mais útil para decidir para o menos.
  const destaques: string[] = []
  const gs = gastronomias.filter((g) => g.nome !== 'Sem gastronomia' && g.dias >= 2).sort((a, b) => b.porDia - a.porDia)
  if (gs.length >= 2) {
    const resto = gs.slice(1)
    const mediaResto = resto.reduce((s, g) => s + g.fat, 0) / resto.reduce((s, g) => s + g.dias, 0)
    destaques.push(`${gs[0].nome} é a gastronomia que mais fatura: ${mil(gs[0].porDia)} por dia, ${(gs[0].porDia / mediaResto).toFixed(1).replace('.', ',')} vezes a média das outras.`)
  }
  const sab = diasSemana.find((d) => d.nome === 'Sábado')
  const dom = diasSemana.find((d) => d.nome === 'Domingo')
  const sex = diasSemana.find((d) => d.nome === 'Sexta')
  if (sab && dom) {
    const dif = (sab.porDia / dom.porDia - 1) * 100
    const t = Math.abs(dif) < 5
      ? `Sábado e domingo faturam quase igual: ${mil(sab.porDia)} e ${mil(dom.porDia)} por dia`
      : `O sábado fatura em média ${mil(sab.porDia)}, ${pct(Math.abs(dif))} ${dif > 0 ? 'a mais' : 'a menos'} que o domingo (${mil(dom.porDia)})`
    destaques.push(sex ? `${t}. A sexta fica em ${mil(sex.porDia)}.` : `${t}.`)
  }
  if (produtos.length >= 5) {
    const top3 = produtos.slice(0, 3)
    destaques.push(`${top3.map((p) => p.nome).join(', ')} somam ${pct((top3.reduce((s, p) => s + p.fat, 0) / fat) * 100)} do faturamento.`)
  }
  if (anoAno.length) {
    const sobe = anoAno[0]
    const desce = anoAno[anoAno.length - 1]
    if (sobe.variacao > 0) destaques.push(`Maior crescimento de um ano para o outro: ${sobe.nome}, ${pct(sobe.variacao)} a mais por dia (${mil(sobe.antes.porDia)} para ${mil(sobe.depois.porDia)}).`)
    if (desce.variacao < 0) destaques.push(`Maior queda: ${desce.nome}, ${pct(-desce.variacao)} a menos por dia (${mil(desce.antes.porDia)} para ${mil(desce.depois.porDia)}).`)
  }
  if (anos.length >= 2) {
    const [a, b] = anos.slice(-2)
    destaques.push(`Média por evento: ${mil(a.fat / a.eventos)} em ${a.nome} e ${mil(b.fat / b.eventos)} em ${b.nome} (${a.eventos} e ${b.eventos} eventos).`)
  }
  // Comida (sem bebidas) que mais sai por dia, entre as que estiveram em pelo menos 3 eventos.
  const giro = produtos.filter((p) => p.eventos >= 3 && p.linha !== 'Bebidas').sort((a, b) => b.porDia - a.porDia)[0]
  if (giro) destaques.push(`O prato que mais sai quando está no cardápio é ${giro.nome}: ${Math.round(giro.porDia).toLocaleString('pt-BR')} por dia de evento.`)
  const bebidas = linhas.get('Bebidas')
  if (bebidas && fat) destaques.push(`Bebidas são ${pct((bebidas.fat / fat) * 100)} do faturamento.`)
  const caros = produtos.slice(0, 10).filter((p) => p.cmvPct !== null && p.linha !== 'Bebidas').sort((a, b) => b.cmvPct! - a.cmvPct!)
  if (caros.length) destaques.push(`Entre os 10 que mais faturam, o prato de custo mais alto pela ficha é ${caros[0].nome}: ${pct(caros[0].cmvPct!)} do preço médio.`)

  return {
    eventos: resumos, produtos, gastronomias, diasSemana, anos, anoAno, fat, dias, itens: resumos.reduce((s, r) => s + r.itens, 0), destaques,
    linhas: [...linhas.entries()].map(([nome, l]) => ({ nome, ...l })).sort((a, b) => b.fat - a.fat),
  }
}

export interface PosicaoEvento {
  porDia: number
  // Faturamento por dia ÷ mediana da mesma gastronomia (null quando a gastronomia tem menos de 3 eventos).
  relacao: number | null
  // 'acima' ou 'abaixo' quando o evento está muito longe do normal da gastronomia (sugestão para tirar da média).
  aviso: 'acima' | 'abaixo' | null
}

// Onde cada evento com vendas fica em relação aos parecidos: ajuda a decidir o que tirar da média.
export function posicaoEventos(eventos: Evento[], vendas: VendaEvento[]): Map<string, PosicaoEvento> {
  const fat = new Map<string, number>()
  const dias = new Map<string, Set<string>>()
  for (const v of vendas) {
    fat.set(v.eventoId, (fat.get(v.eventoId) ?? 0) + (v.total ?? 0))
    dias.set(v.eventoId, (dias.get(v.eventoId) ?? new Set()).add(v.data))
  }
  const porDia = new Map([...fat.entries()].map(([id, f]) => [id, f / dias.get(id)!.size]))
  const grupos = new Map<string, number[]>()
  for (const e of eventos) if (porDia.has(e.id)) grupos.set(e.gastronomia ?? '', [...(grupos.get(e.gastronomia ?? '') ?? []), porDia.get(e.id)!])
  const mediana = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b)
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
  }
  const r = new Map<string, PosicaoEvento>()
  for (const e of eventos) {
    const pd = porDia.get(e.id)
    if (pd === undefined) continue
    const g = grupos.get(e.gastronomia ?? '') ?? []
    const relacao = e.gastronomia && g.length >= 3 ? pd / mediana(g) : null
    r.set(e.id, { porDia: pd, relacao, aviso: relacao === null ? null : relacao >= 1.6 ? 'acima' : relacao <= 0.6 ? 'abaixo' : null })
  }
  return r
}
