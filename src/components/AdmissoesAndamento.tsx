import { useEffect, useState } from 'react'
import { Avatar } from './ui'
import { contextoAdmissao } from './ChecklistAdmissao'
import { useApp } from '../lib/contexto'
import { dataCurta, hoje } from '../lib/datas'
import { emAdmissao, progressoAdmissao } from '../lib/pessoal'
import { ir } from '../lib/rota'
import { nomeCurto, type Funcionario } from '../lib/types'

interface Linha {
  p: Funcionario
  feitas: number
  total: number
  proxima: string | null
}

// Na Equipe: quem está entrando e em que etapa está a admissão (pedido de 08/10).
export default function AdmissoesAndamento() {
  const { store, equipe } = useApp()
  const [linhas, setLinhas] = useState<Linha[]>([])

  useEffect(() => {
    const novos = equipe.filter((f) => emAdmissao(f, hoje()))
    if (!novos.length) return setLinhas([])
    let vivo = true
    store.admissoes().then(async (as) => {
      const abertas = novos.filter((p) => !as.some((a) => a.funcionarioId === p.id && a.dataAdmissao === p.dataAdmissao && a.concluido))
      const r = await Promise.all(
        abertas.map(async (p) => {
          const pr = progressoAdmissao(p, await contextoAdmissao(store, p), as.find((a) => a.funcionarioId === p.id && a.dataAdmissao === p.dataAdmissao) ?? null)
          return { p, feitas: pr.feitas, total: pr.total, proxima: pr.proxima?.nome ?? null }
        }),
      )
      if (vivo) setLinhas(r.sort((a, b) => b.p.dataAdmissao.localeCompare(a.p.dataAdmissao)))
    })
    return () => {
      vivo = false
    }
  }, [store, equipe])

  if (!linhas.length) return null
  return (
    <section className="mb-4 rounded-2xl bg-white p-4 ring-2 ring-ozzy-400">
      <h2 className="mb-2 font-bold">Admissões em andamento</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {linhas.map(({ p, feitas, total, proxima }) => {
          const pct = Math.round((feitas / total) * 100)
          return (
            <button key={p.id} onClick={() => ir('rh/equipe/' + p.id)} className="flex items-center gap-3 rounded-xl bg-stone-50 p-3 text-left hover:ring-1 hover:ring-carvao">
              <Avatar nome={p.nome} foto={p.fotoUrl} tamanho={36} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">{nomeCurto(p.nome)}</span>
                  <span className="shrink-0 text-xs text-stone-500 tabular-nums">
                    {feitas}/{total} · entrou {dataCurta(p.dataAdmissao)}
                  </span>
                </span>
                <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-stone-200">
                  <span className="block h-full rounded-full bg-carvao" style={{ width: `${pct}%` }} />
                </span>
                {proxima && <span className="mt-1 block truncate text-xs text-stone-600">Próxima: {proxima}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
