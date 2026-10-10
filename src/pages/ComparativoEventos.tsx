import { useEffect, useState } from 'react'
import { Cartao, Vazio } from '../components/ui'
import { useApp } from '../lib/contexto'
import { reais } from '../lib/custos'
import { dataCurta } from '../lib/datas'
import { ir } from '../lib/rota'
import type { Evento, VendaEvento } from '../lib/types'

const inteiro = (n: number) => Math.round(n).toLocaleString('pt-BR')
const doNumero = (n: number | null) => (n === null ? '—' : String(n).replace('.', ','))

interface Linha {
  e: Evento
  fat: number
  itens: number
  dias: number
}

// Comparativo dos eventos com vendas (inclui os anteriores importados da planilha DPEN).
export default function ComparativoEventos() {
  const { store } = useApp()
  const [dados, setDados] = useState<{ eventos: Evento[]; vendas: VendaEvento[] } | null>(null)
  const [erro, setErro] = useState('')
  const [gastro, setGastro] = useState('')
  const [ordem, setOrdem] = useState<'data' | 'fat' | 'diaBarraca'>('data')
  useEffect(() => {
    Promise.all([store.eventos(), store.vendasEventos()])
      .then(([eventos, vendas]) => setDados({ eventos, vendas }))
      .catch((e) => setErro((e as Error).message))
  }, [store])
  if (erro) return <p className="text-red-600">{erro}</p>
  if (!dados) return <p className="text-stone-400">Carregando…</p>

  const linhas: Linha[] = dados.eventos
    .map((e) => {
      const v = dados.vendas.filter((x) => x.eventoId === e.id)
      return { e, fat: v.reduce((s, x) => s + (x.total ?? 0), 0), itens: v.reduce((s, x) => s + x.quantidade, 0), dias: new Set(v.map((x) => x.data)).size }
    })
    .filter((l) => l.dias > 0)
  if (!linhas.length) return <Vazio>Nenhum evento com vendas ainda.</Vazio>
  const gastronomias = [...new Set(linhas.map((l) => l.e.gastronomia).filter(Boolean))] as string[]
  const filtradas = linhas.filter((l) => !gastro || l.e.gastronomia === gastro)
  const porDiaBarraca = (l: Linha) => (l.e.barracas ? l.fat / l.dias / l.e.barracas : null)
  const ordenadas = [...filtradas].sort((a, b) =>
    ordem === 'fat' ? b.fat - a.fat : ordem === 'diaBarraca' ? (porDiaBarraca(b) ?? 0) - (porDiaBarraca(a) ?? 0) : (b.e.dias[0]?.data ?? '').localeCompare(a.e.dias[0]?.data ?? ''),
  )
  const maxFat = Math.max(1, ...filtradas.map((l) => l.fat))
  const fatTotal = filtradas.reduce((s, l) => s + l.fat, 0)
  const diasTotal = filtradas.reduce((s, l) => s + l.dias, 0)

  // Produtos nos eventos filtrados.
  const ids = new Set(filtradas.map((l) => l.e.id))
  const prod = new Map<string, { nome: string; itens: number; fat: number; eventos: Set<string> }>()
  for (const v of dados.vendas)
    if (ids.has(v.eventoId)) {
      const k = v.receitaId ?? v.produto
      const p = prod.get(k) ?? { nome: v.produto, itens: 0, fat: 0, eventos: new Set() }
      p.itens += v.quantidade
      p.fat += v.total ?? 0
      p.eventos.add(v.eventoId)
      prod.set(k, p)
    }
  const ranking = [...prod.values()].sort((a, b) => b.fat - a.fat).slice(0, 20)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1">
        {['', ...gastronomias].map((g) => (
          <button key={g} onClick={() => setGastro(g)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${gastro === g ? 'bg-carvao text-white' : 'text-stone-600 hover:bg-stone-200'}`}>
            {g || 'Todos'} <span className="opacity-60">{g ? linhas.filter((l) => l.e.gastronomia === g).length : linhas.length}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Eventos', String(filtradas.length)],
          ['Faturamento', reais(fatTotal, 0)],
          ['Média por evento', reais(fatTotal / filtradas.length, 0)],
          ['Média por dia', reais(fatTotal / diasTotal, 0)],
        ].map(([t, v]) => (
          <Cartao key={t}>
            <div className="text-xs text-stone-500">{t}</div>
            <div className="text-xl font-bold">{v}</div>
          </Cartao>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs text-stone-500">
            <tr>
              <th className="px-3 py-2"><button onClick={() => setOrdem('data')} className={ordem === 'data' ? 'text-carvao underline' : ''}>Evento</button></th>
              <th className="px-2 py-2">Gastronomia</th>
              <th className="px-2 py-2 text-right">Dias</th>
              <th className="px-2 py-2 text-right">Barracas</th>
              <th className="px-2 py-2"><button onClick={() => setOrdem('fat')} className={ordem === 'fat' ? 'text-carvao underline' : ''}>Faturamento</button></th>
              <th className="px-2 py-2 text-right">Itens</th>
              <th className="px-2 py-2 text-right">Por dia</th>
              <th className="px-2 py-2 text-right"><button onClick={() => setOrdem('diaBarraca')} className={ordem === 'diaBarraca' ? 'text-carvao underline' : ''}>Dia por barraca</button></th>
              <th className="px-2 py-2 text-right">Preço médio</th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((l) => (
              <tr key={l.e.id} className="cursor-pointer border-t border-stone-100 hover:bg-stone-50" onClick={() => ir(`eventos/${l.e.id}/vendas`)}>
                <td className="px-3 py-1.5">
                  <span className="font-semibold">{l.e.nome}</span>
                  <span className="block text-xs text-stone-500">{l.e.dias[0] && dataCurta(l.e.dias[0].data)}{l.e.cidade && ` · ${l.e.cidade}`}</span>
                </td>
                <td className="px-2 py-1.5 text-stone-600">{l.e.gastronomia ?? '—'}</td>
                <td className="px-2 py-1.5 text-right">{l.dias}</td>
                <td className="px-2 py-1.5 text-right">{doNumero(l.e.barracas)}</td>
                <td className="min-w-40 px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 flex-1 rounded-full bg-stone-100">
                      <div className="h-2.5 rounded-full bg-stone-700" style={{ width: `${(l.fat / maxFat) * 100}%` }} />
                    </div>
                    <span className="w-24 text-right font-semibold whitespace-nowrap">{reais(l.fat, 0)}</span>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right">{inteiro(l.itens)}</td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap">{reais(l.fat / l.dias, 0)}</td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap">{porDiaBarraca(l) === null ? '—' : reais(porDiaBarraca(l)!, 0)}</td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap">{l.itens ? reais(l.fat / l.itens) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-500">Toque num evento para ver as vendas por dia e produto. Os eventos de jan/2025 a ago/2026 vieram da planilha DPEN.</p>

      <Cartao>
        <h2 className="mb-2 font-bold">Produtos que mais faturaram{gastro && ` (${gastro})`}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-stone-500">
              <tr>
                <th className="py-1 pr-2">Produto</th>
                <th className="px-2 py-1 text-right">Itens</th>
                <th className="px-2 py-1 text-right">Faturamento</th>
                <th className="px-2 py-1 text-right">% do total</th>
                <th className="px-2 py-1 text-right">Eventos</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((p) => (
                <tr key={p.nome} className="border-t border-stone-100">
                  <td className="py-1 pr-2 font-semibold">{p.nome}</td>
                  <td className="px-2 py-1 text-right">{inteiro(p.itens)}</td>
                  <td className="px-2 py-1 text-right">{reais(p.fat, 0)}</td>
                  <td className="px-2 py-1 text-right">{fatTotal ? ((p.fat / fatTotal) * 100).toFixed(1).replace('.', ',') : '—'}%</td>
                  <td className="px-2 py-1 text-right">{p.eventos.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>
    </div>
  )
}
