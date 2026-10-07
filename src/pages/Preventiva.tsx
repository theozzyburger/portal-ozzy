import { useCallback, useEffect, useState } from 'react'
import { Botao, Campo, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { dataLonga, hoje } from '../lib/datas'
import { tarefasPreventiva, textoFrequencia, textoPrazo, type TarefaPreventiva } from '../lib/preventiva'
import { apelidoUnidade, type Equipamento, type ExecucaoPreventiva, type Preventiva as Item } from '../lib/types'

const SELO = { vencida: 'vermelho', vence_logo: 'ambar', em_dia: 'verde' } as const
const COR = { vencida: 'bg-red-600', vence_logo: 'bg-ozzy-500', em_dia: 'bg-emerald-500' } as const

// Manutenção preventiva: o que verificar, de quanto em quanto tempo, e quando vence em cada loja.
export default function Preventiva() {
  const { store, unidades, nomeDe, avisar } = useApp()
  const [itens, setItens] = useState<Item[] | null>(null)
  const [execucoes, setExecucoes] = useState<ExecucaoPreventiva[]>([])
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([])
  const [loja, setLoja] = useState('')
  const [visao, setVisao] = useState<'agenda' | 'itens'>('agenda')
  const [editando, setEditando] = useState<Item | 'novo' | null>(null)
  const [feito, setFeito] = useState<TarefaPreventiva | null>(null)

  const carregar = useCallback(async () => {
    const [i, x, e] = await Promise.all([store.preventivas(), store.execucoesPreventiva(), store.equipamentos()])
    setItens(i)
    setExecucoes(x)
    setEquipamentos(e)
  }, [store])
  useEffect(() => {
    carregar()
  }, [carregar])

  if (!itens) return <p className="text-stone-400">Carregando…</p>
  const nomeLoja = (id: string | null) => (id ? apelidoUnidade(unidades.find((u) => u.id === id)?.nome ?? id) : 'Todas as lojas')
  const nomeEquip = (id: string | null) => equipamentos.find((e) => e.id === id)?.nome
  const tarefas = tarefasPreventiva(itens, execucoes, unidades, hoje()).filter((t) => !loja || t.unidadeId === loja)
  const vencidas = tarefas.filter((t) => t.situacao === 'vencida').length
  const logo = tarefas.filter((t) => t.situacao === 'vence_logo').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-white p-1 ring-1 ring-stone-300">
          {(['agenda', 'itens'] as const).map((v) => (
            <button key={v} onClick={() => setVisao(v)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${visao === v ? 'bg-carvao text-white' : 'text-stone-600'}`}>
              {v === 'agenda' ? 'O que vence' : `Itens (${itens.length})`}
            </button>
          ))}
        </div>
        <select className={`${estiloEntrada} w-auto! py-2!`} value={loja} onChange={(e) => setLoja(e.target.value)} aria-label="Loja da preventiva">
          <option value="">Todas as lojas</option>
          {unidades.map((u) => <option key={u.id} value={u.id}>{apelidoUnidade(u.nome)}</option>)}
        </select>
        <Botao variante="secundario" onClick={() => setEditando('novo')}>+ Novo item</Botao>
      </div>

      {visao === 'agenda' ? (
        tarefas.length === 0 ? (
          <Vazio>Nenhum item de preventiva cadastrado. Toque em "+ Novo item" (ex.: limpeza da coifa a cada 90 dias).</Vazio>
        ) : (
          <>
            <p className="text-sm text-stone-600">
              {vencidas > 0 && <b className="text-red-700">{vencidas} atrasada{vencidas > 1 ? 's' : ''}</b>}
              {vencidas > 0 && logo > 0 && ' · '}
              {logo > 0 && <b>{logo} vencendo</b>}
              {!vencidas && !logo && 'Tudo em dia.'}
            </p>
            <ul className="space-y-2">
              {tarefas.map((t) => (
                <li key={t.preventiva.id + t.unidadeId} className="flex overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
                  <span className={`w-1.5 shrink-0 ${COR[t.situacao]}`} />
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 p-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{t.preventiva.titulo}</div>
                      <div className="text-sm text-stone-500">
                        {nomeLoja(t.unidadeId)}
                        {nomeEquip(t.preventiva.equipamentoId) && ` · ${nomeEquip(t.preventiva.equipamentoId)}`} · {textoFrequencia(t.preventiva.frequenciaDias)}
                      </div>
                      <div className="text-xs text-stone-500">
                        {t.ultima ? `Última: ${dataLonga(t.ultima.feitoEm)}${t.ultima.feitoPor ? ` por ${nomeDe(t.ultima.feitoPor)}` : ''}` : 'Ainda não registrada'} · próxima {dataLonga(t.proxima)}
                      </div>
                    </div>
                    <Selo cor={SELO[t.situacao]}>{textoPrazo(t)}</Selo>
                    <Botao variante={t.situacao === 'em_dia' ? 'secundario' : 'primario'} onClick={() => setFeito(t)}>Feito</Botao>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )
      ) : itens.length === 0 ? (
        <Vazio>Nenhum item ainda.</Vazio>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
          {itens
            .filter((i) => !loja || !i.unidadeId || i.unidadeId === loja)
            .sort((a, b) => a.titulo.localeCompare(b.titulo))
            .map((i) => (
              <li key={i.id}>
                <button onClick={() => setEditando(i)} className="flex w-full items-center gap-3 p-3.5 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{i.titulo}</span>
                    <span className="block text-sm text-stone-500">
                      {textoFrequencia(i.frequenciaDias)} · {nomeLoja(i.unidadeId)}
                      {nomeEquip(i.equipamentoId) && ` · ${nomeEquip(i.equipamentoId)}`}
                    </span>
                    {i.descricao && <span className="block text-xs text-stone-500">{i.descricao}</span>}
                  </span>
                  {!i.ativo && <Selo>Pausado</Selo>}
                  <span className="text-xl text-stone-300">›</span>
                </button>
              </li>
            ))}
        </ul>
      )}

      {editando && (
        <EditarItem
          item={editando === 'novo' ? null : editando}
          equipamentos={equipamentos}
          aoFechar={() => setEditando(null)}
          aoSalvar={async (msg) => {
            setEditando(null)
            await carregar()
            avisar(msg)
          }}
        />
      )}
      {feito && (
        <MarcarFeito
          tarefa={feito}
          loja={nomeLoja(feito.unidadeId)}
          aoFechar={() => setFeito(null)}
          aoSalvar={async () => {
            setFeito(null)
            await carregar()
            avisar('Registrado! O próximo vencimento já foi recalculado.')
          }}
        />
      )}
    </div>
  )
}

function MarcarFeito({ tarefa: t, loja, aoFechar, aoSalvar }: { tarefa: TarefaPreventiva; loja: string; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const [data, setData] = useState(hoje())
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await store.registrarExecucao({ preventivaId: t.preventiva.id, unidadeId: t.unidadeId, feitoEm: data, observacao: obs })
      aoSalvar()
    } catch (err) {
      setErro((err as Error).message)
    }
  }
  return (
    <Modal titulo="Registrar preventiva feita" aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <p className="text-sm">
          <b>{t.preventiva.titulo}</b> · {loja}
        </p>
        <Campo rotulo="Feito em">
          <input className={estiloEntrada} type="date" value={data} max={hoje()} onChange={(e) => setData(e.target.value)} required />
        </Campo>
        <Campo rotulo="Observação (opcional)">
          <textarea className={estiloEntrada} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Empresa que fez, o que encontrou, peça trocada…" />
        </Campo>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full">Salvar</Botao>
      </form>
    </Modal>
  )
}

const FREQUENCIAS = [
  [7, 'Semanal'], [15, 'Quinzenal'], [30, 'Mensal'], [60, 'Bimestral'], [90, 'Trimestral'], [180, 'Semestral'], [365, 'Anual'],
] as const

function EditarItem({ item, equipamentos, aoFechar, aoSalvar }: { item: Item | null; equipamentos: Equipamento[]; aoFechar: () => void; aoSalvar: (msg: string) => void }) {
  const { store, unidades } = useApp()
  const [titulo, setTitulo] = useState(item?.titulo ?? '')
  const [descricao, setDescricao] = useState(item?.descricao ?? '')
  const [freq, setFreq] = useState(String(item?.frequenciaDias ?? 90))
  const [unidadeId, setUnidadeId] = useState(item?.unidadeId ?? '')
  const [equipamentoId, setEquipamentoId] = useState(item?.equipamentoId ?? '')
  const [primeiraEm, setPrimeiraEm] = useState(item?.primeiraEm ?? hoje())
  const [ativo, setAtivo] = useState(item?.ativo ?? true)
  const [erro, setErro] = useState('')
  const [apagar, setApagar] = useState(false)

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    const f = Number(freq)
    if (!titulo.trim() || !(f >= 1)) return setErro('Preencha o que verificar e a frequência em dias.')
    try {
      await store.salvarPreventiva({ id: item?.id, titulo, descricao: descricao || null, frequenciaDias: f, unidadeId: unidadeId || null, equipamentoId: equipamentoId || null, primeiraEm, ativo })
      aoSalvar(item ? 'Item atualizado' : 'Item criado')
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  return (
    <Modal titulo={item ? 'Editar item da preventiva' : 'Novo item da preventiva'} aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <Campo rotulo="O que verificar">
          <input className={estiloEntrada} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: limpeza da coifa" required />
        </Campo>
        <Campo rotulo="Frequência (dias)" dica={Number(freq) >= 1 ? textoFrequencia(Number(freq)) : undefined}>
          <div className="flex flex-wrap gap-1.5">
            <input className={`${estiloEntrada} w-24!`} type="number" min={1} value={freq} onChange={(e) => setFreq(e.target.value)} aria-label="Dias" />
            {FREQUENCIAS.map(([d, nome]) => (
              <button key={d} type="button" onClick={() => setFreq(String(d))} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ${Number(freq) === d ? 'bg-carvao text-white ring-carvao' : 'ring-stone-300'}`}>
                {nome}
              </button>
            ))}
          </div>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Loja">
            <select className={estiloEntrada} value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
              <option value="">Todas as lojas</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{apelidoUnidade(u.nome)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Equipamento (opcional)">
            <select className={estiloEntrada} value={equipamentoId} onChange={(e) => setEquipamentoId(e.target.value)}>
              <option value="">—</option>
              {equipamentos.filter((e) => !unidadeId || e.unidadeId === unidadeId).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Primeiro vencimento" dica="Usado enquanto não houver nenhum registro de feito.">
          <input className={estiloEntrada} type="date" value={primeiraEm} onChange={(e) => setPrimeiraEm(e.target.value)} />
        </Campo>
        <Campo rotulo="Como fazer / observações (opcional)">
          <textarea className={estiloEntrada} rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </Campo>
        {item && (
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="size-5 accent-carvao" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Ativo (desmarque para pausar sem apagar)
          </label>
        )}
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full">Salvar</Botao>
        {item &&
          (apagar ? (
            <Botao type="button" variante="perigo" className="w-full" onClick={async () => { await store.excluirPreventiva(item.id); aoSalvar('Item apagado') }}>
              Confirmar: apagar item e histórico
            </Botao>
          ) : (
            <Botao type="button" variante="fantasma" className="w-full" onClick={() => setApagar(true)}>
              Apagar item
            </Botao>
          ))}
      </form>
    </Modal>
  )
}
