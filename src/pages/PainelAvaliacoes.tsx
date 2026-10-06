import { useApp } from '../lib/contexto'
import { tempoDesde } from '../lib/datas'
import { apelidoUnidade, type Avaliacao, type Plataforma } from '../lib/types'

const PLATAFORMAS: { valor: Plataforma; nome: string }[] = [
  { valor: 'ifood', nome: 'iFood' },
  { valor: '99food', nome: '99Food' },
]

// Abaixo disso a loja merece atenção (referência nossa, dá para ajustar).
const NOTA_MINIMA = 4.5

const nota = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export default function PainelAvaliacoes({ unidade, avaliacoes }: { unidade: string; avaliacoes: Avaliacao[] }) {
  const { unidades } = useApp()
  const lojas = unidades.filter((u) => !unidade || u.id === unidade)
  const media = (p: Plataforma) => {
    const xs = avaliacoes.filter((a) => a.plataforma === p && (!unidade || a.unidadeId === unidade))
    const total = xs.reduce((s, a) => s + a.totalAvaliacoes, 0)
    return total ? xs.reduce((s, a) => s + a.nota * a.totalAvaliacoes, 0) / total : null
  }

  return (
    <div className="space-y-4">
      {!unidade && (
        <div className="grid grid-cols-2 gap-2">
          {PLATAFORMAS.map((p) => {
            const m = media(p.valor)
            return (
              <div key={p.valor} className="rounded-2xl bg-carvao p-3 text-white">
                <div className="text-sm text-stone-300">Nota média no {p.nome}</div>
                <div className="mt-1 text-3xl font-bold text-ozzy-400">{m ? nota(m) : '—'} ★</div>
                <div className="text-xs text-stone-400">ponderada pelo número de avaliações</div>
              </div>
            )
          })}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        {lojas.map((u) => (
          <div key={u.id} className="min-w-0 rounded-2xl p-3 ring-1 ring-stone-200 sm:p-4">
            <h4 className="truncate font-bold">{apelidoUnidade(u.nome)}</h4>
            <div className="mt-3 space-y-3">
              {PLATAFORMAS.map((p) => {
                const a = avaliacoes.find((x) => x.unidadeId === u.id && x.plataforma === p.valor)
                if (!a) return <div key={p.valor} className="text-sm text-stone-400">{p.nome}: sem dados</div>
                const dif = a.notaHa30Dias === null ? 0 : Math.round((a.nota - a.notaHa30Dias) * 10) / 10
                const baixa = a.nota < NOTA_MINIMA
                return (
                  <div key={p.valor} className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 p-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{p.nome}</div>
                      <div className="text-xs text-stone-500">{a.totalAvaliacoes.toLocaleString('pt-BR')} avaliações</div>
                      {baixa && <div className="mt-1 text-xs font-semibold text-red-700">⚠ Abaixo de {nota(NOTA_MINIMA)}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold tabular-nums">
                        {nota(a.nota)} <span className="text-base">★</span>
                      </div>
                      <div className={`text-xs font-medium ${dif === 0 ? 'text-stone-500' : dif > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {dif === 0 ? 'igual a 30 dias atrás' : `${dif > 0 ? '▲' : '▼'} ${nota(Math.abs(dif))} em 30 dias`}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-stone-500">
        Notas de exemplo{avaliacoes[0] ? `, atualizadas ${tempoDesde(avaliacoes[0].atualizadoEm)}` : ''}. As reais vão vir do iFood e da 99Food, uma vez por dia.
      </p>
    </div>
  )
}
