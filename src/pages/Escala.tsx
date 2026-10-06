import { useCallback, useEffect, useState } from 'react'
import { Botao, Titulo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, dataLonga, diaSemana, hoje, inicioDaSemana } from '../lib/datas'
import { podeGerenciar } from '../lib/permissoes'
import type { Folga } from '../lib/types'

export default function Escala() {
  const { eu, store, equipe, unidades, avisar } = useApp()
  const gestao = podeGerenciar(eu.nivel)
  const [inicio, setInicio] = useState(inicioDaSemana(hoje()))
  const [folgas, setFolgas] = useState<Folga[]>([])
  const [unidade, setUnidade] = useState(gestao ? '' : eu.unidadeId)
  const dias = Array.from({ length: 7 }, (_, i) => addDias(inicio, i))

  const carregar = useCallback(() => store.folgas(inicio, addDias(inicio, 6)).then(setFolgas), [store, inicio])
  useEffect(() => {
    carregar()
  }, [carregar])

  const pessoas = equipe
    .filter((f) => f.status === 'ativo' && (!unidade || f.unidadeId === unidade))
    .sort((a, b) => (a.id === eu.id ? -1 : b.id === eu.id ? 1 : a.nome.localeCompare(b.nome)))

  const temFolga = (fid: string, d: string) => folgas.some((g) => g.funcionarioId === fid && g.data === d)

  const alternar = async (fid: string, d: string) => {
    if (!gestao) return
    await store.alternarFolga(fid, d)
    await carregar()
    avisar(temFolga(fid, d) ? 'Folga removida' : 'Folga marcada')
  }

  return (
    <div>
      <Titulo>Folgas da semana</Titulo>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Botao variante="secundario" onClick={() => setInicio(addDias(inicio, -7))} aria-label="Semana anterior">
          ‹
        </Botao>
        <span className="min-w-40 text-center text-sm font-semibold">
          {dataLonga(inicio)} a {dataCurta(addDias(inicio, 6))}
        </span>
        <Botao variante="secundario" onClick={() => setInicio(addDias(inicio, 7))} aria-label="Próxima semana">
          ›
        </Botao>
        {gestao && (
          <select className={`${estiloEntrada} w-auto! py-2!`} value={unidade} onChange={(e) => setUnidade(e.target.value)}>
            <option value="">Todas as unidades</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        )}
      </div>
      {gestao && <p className="mb-3 text-sm text-stone-500">Toque num dia para marcar ou tirar a folga.</p>}

      {pessoas.length === 0 ? (
        <Vazio>Ninguém nesta unidade.</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500">
                <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-semibold">Pessoa</th>
                {dias.map((d) => (
                  <th key={d} className={`px-1 py-2 text-center font-semibold ${d === hoje() ? 'text-ozzy-700' : ''}`}>
                    <div>{diaSemana(d)}</div>
                    <div className="text-xs font-normal">{dataCurta(d)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pessoas.map((p) => (
                <tr key={p.id} className={`border-b border-stone-100 last:border-0 ${p.id === eu.id ? 'bg-ozzy-50' : ''}`}>
                  <td className={`sticky left-0 z-10 px-3 py-2 ${p.id === eu.id ? 'bg-ozzy-50' : 'bg-white'}`}>
                    <div className="font-semibold">{p.id === eu.id ? 'Você' : p.nome}</div>
                    <div className="text-xs text-stone-500">{p.cargo}</div>
                  </td>
                  {dias.map((d) => {
                    const folga = temFolga(p.id, d)
                    return (
                      <td key={d} className="px-1 py-1.5 text-center">
                        <button
                          disabled={!gestao}
                          onClick={() => alternar(p.id, d)}
                          className={`h-9 w-full min-w-11 rounded-lg text-xs font-bold transition ${
                            folga ? 'bg-ozzy-500 text-carvao' : 'bg-stone-50 text-stone-300'
                          } ${gestao ? 'hover:ring-2 hover:ring-ozzy-400' : 'cursor-default'}`}
                        >
                          {folga ? 'FOLGA' : '·'}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
