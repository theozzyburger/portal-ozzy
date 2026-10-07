import { useCallback, useEffect, useState } from 'react'
import { Botao, Campo, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { dataLonga, hoje } from '../lib/datas'
import { podeGerenciar } from '../lib/permissoes'
import { apelidoUnidade, type Equipamento, type ManutencaoEquipamento, type TipoManutencao } from '../lib/types'

const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const numero = (s: string) => (s.trim() === '' ? null : Number(s.replace(/\./g, '').replace(',', '.')))
const doNumero = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))

// Inventário dos equipamentos de cada loja, com foto, compra, valor e histórico de manutenções.
export default function Equipamentos() {
  const { eu, store, unidades, avisar } = useApp()
  const verValores = podeGerenciar(eu.nivel)
  const [lista, setLista] = useState<Equipamento[] | null>(null)
  const [manutencoes, setManutencoes] = useState<ManutencaoEquipamento[]>([])
  const [loja, setLoja] = useState('')
  const [busca, setBusca] = useState('')
  const [inativos, setInativos] = useState(false)
  const [aberto, setAberto] = useState<string | null>(null)
  const [editando, setEditando] = useState<Equipamento | 'novo' | null>(null)

  const carregar = useCallback(async () => {
    const [e, m] = await Promise.all([store.equipamentos(), store.manutencoesEquipamento()])
    setLista(e)
    setManutencoes(m)
  }, [store])
  useEffect(() => {
    carregar()
  }, [carregar])

  if (!lista) return <p className="text-stone-400">Carregando…</p>
  const nomeLoja = (id: string) => apelidoUnidade(unidades.find((u) => u.id === id)?.nome ?? id)
  const filtrados = lista.filter(
    (e) => (inativos || e.ativo) && (!loja || e.unidadeId === loja) && (!busca || `${e.nome} ${e.marcaModelo ?? ''} ${e.local ?? ''}`.toLowerCase().includes(busca.toLowerCase())),
  )
  const total = filtrados.filter((e) => e.ativo).reduce((s, e) => s + (e.valorAtual ?? 0), 0)
  const selecionado = lista.find((e) => e.id === aberto)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${estiloEntrada} basis-full py-2! sm:basis-0 sm:flex-1`} placeholder="Buscar equipamento" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar equipamento" />
        <select className={`${estiloEntrada} w-auto! py-2!`} value={loja} onChange={(e) => setLoja(e.target.value)} aria-label="Loja dos equipamentos">
          <option value="">Todas as lojas</option>
          {unidades.map((u) => <option key={u.id} value={u.id}>{apelidoUnidade(u.nome)}</option>)}
        </select>
        <Botao onClick={() => setEditando('novo')}>+ Equipamento</Botao>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-stone-600">
        <span>
          {filtrados.length} equipamento{filtrados.length === 1 ? '' : 's'}
          {verValores && total > 0 && <> · valor atual somado <b>{reais(total)}</b></>}
        </span>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-carvao" checked={inativos} onChange={(e) => setInativos(e.target.checked)} /> Mostrar baixados
        </label>
      </div>

      {filtrados.length === 0 ? (
        <Vazio>Nenhum equipamento cadastrado{loja ? ' nesta loja' : ''}. Comece pelos mais caros: chapa, fritadeira, freezers, liquidificadores…</Vazio>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {filtrados.map((e) => {
            const hist = manutencoes.filter((m) => m.equipamentoId === e.id)
            return (
              <li key={e.id}>
                <button onClick={() => setAberto(e.id)} className="flex h-full w-full flex-col rounded-2xl bg-white p-3.5 text-left ring-1 ring-stone-200 transition hover:ring-carvao">
                  <span className="flex w-full items-start justify-between gap-2">
                    <span className="font-semibold">{e.nome}</span>
                    {!e.ativo && <Selo>Baixado</Selo>}
                  </span>
                  <span className="text-sm text-stone-500">
                    {nomeLoja(e.unidadeId)}
                    {e.local && ` · ${e.local}`}
                    {e.marcaModelo && ` · ${e.marcaModelo}`}
                  </span>
                  <span className="mt-1 text-xs text-stone-500">
                    {e.dataCompra ? `Comprado em ${dataLonga(e.dataCompra)}` : 'Compra sem data'}
                    {verValores && e.valorAtual !== null && ` · vale ${reais(e.valorAtual)}`}
                    {` · ${hist.length} manutenç${hist.length === 1 ? 'ão' : 'ões'}`}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {selecionado && (
        <Detalhe
          e={selecionado}
          historico={manutencoes.filter((m) => m.equipamentoId === selecionado.id)}
          verValores={verValores}
          nomeLoja={nomeLoja}
          aoFechar={() => setAberto(null)}
          aoEditar={() => setEditando(selecionado)}
          aoMudar={carregar}
        />
      )}
      {editando && (
        <EditarEquipamento
          e={editando === 'novo' ? null : editando}
          verValores={verValores}
          aoFechar={() => setEditando(null)}
          aoSalvar={async (salvo) => {
            setEditando(null)
            await carregar()
            setAberto(salvo.id)
            avisar(editando === 'novo' ? 'Equipamento cadastrado' : 'Equipamento atualizado')
          }}
        />
      )}
    </div>
  )
}

function Detalhe({ e, historico, verValores, nomeLoja, aoFechar, aoEditar, aoMudar }: {
  e: Equipamento
  historico: ManutencaoEquipamento[]
  verValores: boolean
  nomeLoja: (id: string) => string
  aoFechar: () => void
  aoEditar: () => void
  aoMudar: () => Promise<void>
}) {
  const { store, nomeDe, avisar } = useApp()
  const [foto, setFoto] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)
  useEffect(() => {
    store.fotoEquipamento(e).then(setFoto)
  }, [store, e])
  const gasto = historico.reduce((s, m) => s + (m.custo ?? 0), 0)

  return (
    <Modal titulo={e.nome} aberto aoFechar={aoFechar}>
      <div className="space-y-4">
        {foto && <img src={foto} alt={`Foto de ${e.nome}`} className="max-h-64 w-full rounded-xl object-cover" />}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-stone-50 p-3 text-sm">
          <dt className="text-stone-500">Loja</dt>
          <dd>{nomeLoja(e.unidadeId)}{e.local && `, ${e.local}`}</dd>
          {e.marcaModelo && (<><dt className="text-stone-500">Marca/modelo</dt><dd>{e.marcaModelo}</dd></>)}
          {e.numeroSerie && (<><dt className="text-stone-500">Nº de série</dt><dd>{e.numeroSerie}</dd></>)}
          <dt className="text-stone-500">Compra</dt>
          <dd>{e.dataCompra ? dataLonga(e.dataCompra) : '—'}{verValores && e.valorCompra !== null && ` · ${reais(e.valorCompra)}`}</dd>
          {verValores && (<><dt className="text-stone-500">Valor atual</dt><dd>{e.valorAtual !== null ? reais(e.valorAtual) : '—'}</dd></>)}
          {verValores && gasto > 0 && (<><dt className="text-stone-500">Gasto em manutenção</dt><dd>{reais(gasto)}</dd></>)}
          {e.observacao && (<><dt className="text-stone-500">Observação</dt><dd className="whitespace-pre-line">{e.observacao}</dd></>)}
        </dl>
        <Botao variante="secundario" onClick={aoEditar}>Editar dados e foto</Botao>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold">Histórico de manutenções</h3>
            {!novo && <Botao variante="secundario" onClick={() => setNovo(true)}>+ Registrar</Botao>}
          </div>
          {novo && (
            <NovaManutencao
              equipamentoId={e.id}
              verValores={verValores}
              aoCancelar={() => setNovo(false)}
              aoSalvar={async () => {
                setNovo(false)
                await aoMudar()
                avisar('Manutenção registrada')
              }}
            />
          )}
          {historico.length === 0 ? (
            <p className="text-sm text-stone-400">Nenhuma manutenção registrada.</p>
          ) : (
            <ol className="space-y-3 border-l-2 border-stone-200 pl-4">
              {historico.map((m) => (
                <li key={m.id} className="text-sm">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                    <b className="text-stone-700">{dataLonga(m.data)}</b>
                    <Selo cor={m.tipo === 'corretiva' ? 'ambar' : 'azul'}>{m.tipo === 'corretiva' ? 'Corretiva' : 'Preventiva'}</Selo>
                    {m.prestador && <span>{m.prestador}</span>}
                    {verValores && m.custo !== null && <span>· {reais(m.custo)}</span>}
                  </div>
                  <p className="whitespace-pre-line text-stone-700">{m.descricao}</p>
                  {m.registradoPor && <div className="text-xs text-stone-400">Registrado por {nomeDe(m.registradoPor)}</div>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Modal>
  )
}

function NovaManutencao({ equipamentoId, verValores, aoCancelar, aoSalvar }: { equipamentoId: string; verValores: boolean; aoCancelar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const [data, setData] = useState(hoje())
  const [tipo, setTipo] = useState<TipoManutencao>('corretiva')
  const [descricao, setDescricao] = useState('')
  const [prestador, setPrestador] = useState('')
  const [custo, setCusto] = useState('')
  const [erro, setErro] = useState('')
  const salvar = async () => {
    if (!descricao.trim()) return setErro('Conte o que aconteceu e o que foi feito.')
    try {
      await store.registrarManutencaoEquipamento({ equipamentoId, data, tipo, descricao, prestador: prestador || null, custo: numero(custo), chamadoId: null })
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }
  return (
    <div className="mb-3 space-y-3 rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200">
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Data">
          <input className={estiloEntrada} type="date" value={data} max={hoje()} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <Campo rotulo="Tipo">
          <select className={estiloEntrada} value={tipo} onChange={(e) => setTipo(e.target.value as TipoManutencao)}>
            <option value="corretiva">Corretiva (quebrou)</option>
            <option value="preventiva">Preventiva</option>
          </select>
        </Campo>
      </div>
      <Campo rotulo="O que aconteceu e o que foi feito">
        <textarea className={estiloEntrada} rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: motor esquentando; trocadas as escovas." />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Quem fez">
          <input className={estiloEntrada} value={prestador} onChange={(e) => setPrestador(e.target.value)} placeholder="Vanderlei, assistência…" />
        </Campo>
        {verValores && (
          <Campo rotulo="Custo (R$)">
            <input className={estiloEntrada} inputMode="decimal" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="0,00" />
          </Campo>
        )}
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <div className="flex gap-2">
        <Botao type="button" onClick={salvar}>Salvar</Botao>
        <Botao type="button" variante="fantasma" onClick={aoCancelar}>Cancelar</Botao>
      </div>
    </div>
  )
}

function EditarEquipamento({ e, verValores, aoFechar, aoSalvar }: { e: Equipamento | null; verValores: boolean; aoFechar: () => void; aoSalvar: (salvo: Equipamento) => void }) {
  const { eu, store, unidades } = useApp()
  const [f, setF] = useState({
    nome: e?.nome ?? '', unidadeId: e?.unidadeId ?? eu.unidadeId ?? unidades[0]?.id ?? '', marcaModelo: e?.marcaModelo ?? '', numeroSerie: e?.numeroSerie ?? '',
    local: e?.local ?? '', dataCompra: e?.dataCompra ?? '', valorCompra: doNumero(e?.valorCompra ?? null), valorAtual: doNumero(e?.valorAtual ?? null), observacao: e?.observacao ?? '',
  })
  const [ativo, setAtivo] = useState(e?.ativo ?? true)
  const [foto, setFoto] = useState<File | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const mudar = (c: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [c]: ev.target.value })

  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!f.nome.trim()) return setErro('Dê um nome ao equipamento.')
    setSalvando(true)
    try {
      aoSalvar(
        await store.salvarEquipamento(
          {
            id: e?.id, nome: f.nome, unidadeId: f.unidadeId, marcaModelo: f.marcaModelo || null, numeroSerie: f.numeroSerie || null, local: f.local || null,
            dataCompra: f.dataCompra || null, observacao: f.observacao || null, ativo,
            // Quem não vê valores (manutenção) não mexe neles.
            valorCompra: verValores ? numero(f.valorCompra) : e?.valorCompra ?? null,
            valorAtual: verValores ? numero(f.valorAtual) : e?.valorAtual ?? null,
          },
          foto ?? undefined,
        ),
      )
    } catch (err) {
      setErro((err as Error).message)
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={e ? 'Editar equipamento' : 'Novo equipamento'} aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Nome">
          <input className={estiloEntrada} value={f.nome} onChange={mudar('nome')} placeholder="Ex.: Liquidificador industrial 1" required />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Loja">
            <select className={estiloEntrada} value={f.unidadeId} onChange={mudar('unidadeId')}>
              {unidades.map((u) => <option key={u.id} value={u.id}>{apelidoUnidade(u.nome)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Onde fica">
            <input className={estiloEntrada} value={f.local} onChange={mudar('local')} placeholder="Cozinha, estoque…" />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Marca/modelo">
            <input className={estiloEntrada} value={f.marcaModelo} onChange={mudar('marcaModelo')} />
          </Campo>
          <Campo rotulo="Nº de série">
            <input className={estiloEntrada} value={f.numeroSerie} onChange={mudar('numeroSerie')} />
          </Campo>
        </div>
        <Campo rotulo="Data da compra (aproximada)">
          <input className={estiloEntrada} type="date" value={f.dataCompra} max={hoje()} onChange={mudar('dataCompra')} />
        </Campo>
        {verValores && (
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Valor pago (R$)">
              <input className={estiloEntrada} inputMode="decimal" value={f.valorCompra} onChange={mudar('valorCompra')} placeholder="0,00" />
            </Campo>
            <Campo rotulo="Valor atual (R$)">
              <input className={estiloEntrada} inputMode="decimal" value={f.valorAtual} onChange={mudar('valorAtual')} placeholder="0,00" />
            </Campo>
          </div>
        )}
        <Campo rotulo={e?.foto ? 'Trocar foto' : 'Foto'}>
          <input type="file" accept="image/*" capture="environment" className="block w-full text-sm" onChange={(ev) => setFoto(ev.target.files?.[0] ?? null)} />
        </Campo>
        <Campo rotulo="Observação">
          <textarea className={estiloEntrada} rows={2} value={f.observacao} onChange={mudar('observacao')} />
        </Campo>
        {e && (
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="size-5 accent-carvao" checked={!ativo} onChange={(ev) => setAtivo(!ev.target.checked)} />
            Dar baixa (vendido, descartado ou quebrado sem conserto)
          </label>
        )}
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
      </form>
    </Modal>
  )
}
