import { useCallback, useEffect, useMemo, useState } from 'react'
import { Botao, Cartao, Modal, Vazio, estiloEntrada, Campo } from '../components/ui'
import { useApp } from '../lib/contexto'
import { nomeUnidade, qtd } from '../lib/custos'
import { hoje, tempoDesde } from '../lib/datas'
import { estoqueBase } from '../lib/logistica'
import type { EnvioEvento, Inventario, ItemContagem, ItemModeloChecklist } from '../lib/types'
import { Contagem } from './EventoLogistica'

interface Dados {
  itens: ItemContagem[]
  contagens: Inventario[]
  envios: EnvioEvento[]
  modelo: ItemModeloChecklist[]
}

// Estoque da base (Central) e itens fixos do checklist de eventos.
export default function EstoqueBase() {
  const { store, avisar, nomeDe } = useApp()
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [contando, setContando] = useState(false)
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<ItemModeloChecklist | 'novo' | null>(null)
  const carregar = useCallback(async () => {
    try {
      const [itens, contagens, envios, modelo] = await Promise.all([store.itensContagem(), store.inventarios({ local: 'base' }), store.envios(), store.modeloChecklist()])
      setD({ itens, contagens, envios, modelo })
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [store])
  useEffect(() => {
    carregar()
  }, [carregar])
  const saldo = useMemo(() => (d ? estoqueBase(d.contagens, d.envios) : new Map()), [d])

  if (erro) return <p className="text-red-600">{erro}</p>
  if (!d) return <p className="text-stone-400">Carregando…</p>
  if (contando)
    return (
      <Contagem
        titulo="Contagem do estoque da base"
        itens={d.itens}
        primeiro={[...saldo.keys()]}
        aoCancelar={() => setContando(false)}
        aoSalvar={async (itens, fala, obs) => {
          await store.salvarInventario('base', null, hoje(), itens, fala, obs)
          await carregar()
          setContando(false)
          avisar('Contagem da base salva')
        }}
      />
    )

  const linhas = d.itens
    .filter((i) => saldo.has(i.chave))
    .filter((i) => !busca || i.nome.toLowerCase().includes(busca.toLowerCase()))
  const categorias = [...new Set(d.modelo.map((m) => m.categoria))]

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h2 className="text-lg font-bold">Estoque da base</h2>
            <p className="text-sm text-stone-600">Última contagem de cada item menos o que saiu para eventos depois dela (conferido na separação). Conte de novo quando a carga voltar.</p>
          </div>
          <Botao className="sm:ml-auto" onClick={() => setContando(true)}>Contar estoque</Botao>
        </div>
        {saldo.size === 0 ? (
          <Vazio>Nenhuma contagem da base ainda. Faça a primeira (pode ser falando): a separação passa a avisar quando faltar item.</Vazio>
        ) : (
          <>
            <input className={`${estiloEntrada} sm:w-72!`} placeholder="Buscar item" value={busca} onChange={(ev) => setBusca(ev.target.value)} aria-label="Buscar item no estoque" />
            <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-left text-xs text-stone-500">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-2 py-2 text-right">Contado</th>
                    <th className="px-2 py-2 text-right">Saiu depois</th>
                    <th className="px-2 py-2 text-right">Saldo</th>
                    <th className="px-2 py-2">Contado</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((i) => {
                    const s = saldo.get(i.chave)!
                    return (
                      <tr key={i.chave} className="border-t border-stone-100">
                        <td className="px-3 py-1.5 font-semibold">{i.nome} <span className="font-normal text-stone-400">{nomeUnidade(i.unidade)}</span></td>
                        <td className="px-2 py-1.5 text-right">{qtd(s.contado)}</td>
                        <td className="px-2 py-1.5 text-right text-stone-600">{s.saiu ? qtd(Math.round(s.saiu * 100) / 100) : '—'}</td>
                        <td className={`px-2 py-1.5 text-right font-bold ${s.saldo <= 0 ? 'text-red-600' : ''}`}>{qtd(Math.round(s.saldo * 100) / 100)}</td>
                        <td className="px-2 py-1.5 text-xs text-stone-500">{tempoDesde(s.contadoEm)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {d.contagens.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-stone-600">Contagens anteriores ({d.contagens.length})</summary>
            <ul className="mt-2 space-y-1">
              {d.contagens.map((c) => (
                <li key={c.id} className="text-stone-600">
                  {new Date(c.contadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {nomeDe(c.contadoPor)} · {c.itens.length} itens
                  {c.observacao && ` · ${c.observacao}`}
                  {c.fala && <span className="block text-xs text-stone-400">Falado: “{c.fala}”</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h2 className="text-lg font-bold">Itens fixos do checklist</h2>
            <p className="text-sm text-stone-600">Vão na primeira separação de todo evento (equipamentos, utensílios, embalagens, limpeza…). Alimentos e bebidas não entram aqui: saem da previsão × fichas.</p>
          </div>
          <Botao variante="secundario" className="sm:ml-auto" onClick={() => setEditando('novo')}>+ Item</Botao>
        </div>
        {categorias.map((c) => (
          <Cartao key={c}>
            <h3 className="mb-1 text-xs font-bold tracking-wide text-stone-500 uppercase">{c}</h3>
            <ul className="divide-y divide-stone-100 text-sm">
              {d.modelo.filter((m) => m.categoria === c).map((m) => (
                <li key={m.id} className={`flex items-center gap-2 py-1.5 ${m.ativo ? '' : 'opacity-50'}`}>
                  <span className="flex-1">
                    <b>{m.item}</b>
                    {m.operacao && <span className="ml-1.5 rounded bg-stone-100 px-1.5 text-xs text-stone-600">{m.operacao}</span>}
                    {!m.ativo && <span className="ml-1.5 text-xs">(não vai)</span>}
                  </span>
                  <span className="text-stone-600">{m.quantidade}</span>
                  <button className="text-xs font-semibold text-stone-500 hover:text-carvao" onClick={() => setEditando(m)}>Editar</button>
                </li>
              ))}
            </ul>
          </Cartao>
        ))}
      </section>

      {editando && (
        <EditarItemModelo
          m={editando === 'novo' ? null : editando}
          categorias={categorias}
          proximaOrdem={Math.max(0, ...d.modelo.map((m) => m.ordem)) + 1}
          aoFechar={() => setEditando(null)}
          aoSalvar={async () => {
            setEditando(null)
            await carregar()
            avisar('Item salvo')
          }}
        />
      )}
    </div>
  )
}

function EditarItemModelo({ m, categorias, proximaOrdem, aoFechar, aoSalvar }: {
  m: ItemModeloChecklist | null
  categorias: string[]
  proximaOrdem: number
  aoFechar: () => void
  aoSalvar: () => void
}) {
  const { store } = useApp()
  const [f, setF] = useState({ categoria: m?.categoria ?? '', item: m?.item ?? '', operacao: m?.operacao ?? '', quantidade: m?.quantidade ?? '', ativo: m?.ativo ?? true })
  const [erro, setErro] = useState('')
  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!f.item.trim() || !f.categoria.trim()) return setErro('Preencha o item e a categoria.')
    try {
      await store.salvarItemModelo({ id: m?.id, categoria: f.categoria, item: f.item, operacao: f.operacao || null, quantidade: f.quantidade || null, ordem: m?.ordem ?? proximaOrdem, ativo: f.ativo })
      aoSalvar()
    } catch (err) {
      setErro((err as Error).message)
    }
  }
  return (
    <Modal titulo={m ? 'Editar item fixo' : 'Novo item fixo'} aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-3">
        <Campo rotulo="Item">
          <input className={estiloEntrada} value={f.item} onChange={(ev) => setF({ ...f, item: ev.target.value })} required />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Categoria">
            <input className={estiloEntrada} list="cats-modelo" value={f.categoria} onChange={(ev) => setF({ ...f, categoria: ev.target.value })} required />
            <datalist id="cats-modelo">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
          </Campo>
          <Campo rotulo="Praça" dica="Foca, Pizza, Romana… Vazio = todas">
            <input className={estiloEntrada} list="pracas" value={f.operacao} onChange={(ev) => setF({ ...f, operacao: ev.target.value })} />
            <datalist id="pracas">{['Foca', 'Pizza', 'Romana'].map((c) => <option key={c} value={c} />)}</datalist>
          </Campo>
        </div>
        <Campo rotulo="Quantidade" dica="Livre: 2, 3 caixas, Todas">
          <input className={estiloEntrada} value={f.quantidade} onChange={(ev) => setF({ ...f, quantidade: ev.target.value })} />
        </Campo>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.ativo} onChange={(ev) => setF({ ...f, ativo: ev.target.checked })} /> Vai em todo evento
        </label>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full">Salvar</Botao>
      </form>
    </Modal>
  )
}
