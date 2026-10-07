import { useCallback, useEffect, useState } from 'react'
import { Botao, Campo, Cartao, Modal, Selo, Titulo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { tempoDesde } from '../lib/datas'
import { podeGerenciar } from '../lib/permissoes'
import { SETORES, apelidoUnidade, type Comunicado, type Setor } from '../lib/types'

export default function Comunicados() {
  const { eu, store, equipe, nomeDe, nomeUnidade, avisar } = useApp()
  const [lista, setLista] = useState<Comunicado[]>([])
  const [novo, setNovo] = useState(false)
  const gestao = podeGerenciar(eu.nivel)

  const carregar = useCallback(() => store.comunicados().then(setLista), [store])
  useEffect(() => {
    carregar()
  }, [carregar])

  const marcar = async (c: Comunicado) => {
    await store.marcarLido(c.id)
    await carregar()
    avisar('Leitura confirmada')
  }

  // Quem deveria ler: as pessoas escolhidas ou os ativos da loja e dos setores do aviso.
  const publico = (c: Comunicado) =>
    equipe.filter((f) =>
      f.status === 'ativo' &&
      (c.destinatarios?.length
        ? c.destinatarios.includes(f.id)
        : (c.unidadeId === null || f.unidadeId === c.unidadeId) && (!c.setores?.length || (!!f.setor && c.setores.includes(f.setor)))),
    )
  const paraQuem = (c: Comunicado) => {
    if (c.destinatarios?.length)
      return c.destinatarios.length <= 2 ? c.destinatarios.map((id) => nomeDe(id).split(' ')[0]).join(' e ') : `${c.destinatarios.length} pessoas`
    const loja = c.unidadeId ? apelidoUnidade(nomeUnidade(c.unidadeId)) : 'Todos'
    return c.setores?.length ? `${loja} · ${c.setores.map((x) => SETORES.find((y) => y.valor === x)?.nome ?? x).join(', ')}` : loja
  }

  return (
    <div>
      <Titulo acao={gestao && <Botao onClick={() => setNovo(true)}>+ Novo aviso</Botao>}>Avisos</Titulo>
      <div className="space-y-3">
        {lista.length === 0 && <Vazio>Nenhum aviso por enquanto.</Vazio>}
        {lista.map((c) => {
          const lido = c.lidoPor.includes(eu.id)
          const alvo = publico(c)
          const leram = alvo.filter((f) => c.lidoPor.includes(f.id)).length
          return (
            <Cartao key={c.id} className={lido ? '' : 'ring-2! ring-carvao!'}>
              <div className="flex flex-wrap items-center gap-2">
                <Selo cor={c.destinatarios?.length ? 'ambar' : c.unidadeId || c.setores?.length ? 'azul' : 'cinza'}>{c.destinatarios?.length ? '🔒 ' : ''}{paraQuem(c)}</Selo>
                {!lido && <Selo cor="ambar">Novo</Selo>}
              </div>
              <h2 className="mt-2 text-lg font-semibold">{c.titulo}</h2>
              <p className="mt-1 whitespace-pre-line text-[15px] text-stone-700">{c.corpo}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-stone-400">
                  {nomeDe(c.autorId)} · {tempoDesde(c.criadoEm)}
                  {gestao && ` · lido por ${leram} de ${alvo.length}`}
                </span>
                {!lido && (
                  <Botao variante="secundario" onClick={() => marcar(c)}>
                    Li e entendi
                  </Botao>
                )}
              </div>
            </Cartao>
          )
        })}
      </div>
      <NovoComunicado
        aberto={novo}
        aoFechar={() => setNovo(false)}
        aoPublicar={async () => {
          setNovo(false)
          await carregar()
          avisar('Aviso publicado')
        }}
      />
    </div>
  )
}

function NovoComunicado({ aberto, aoFechar, aoPublicar }: { aberto: boolean; aoFechar: () => void; aoPublicar: () => void }) {
  const { store, unidades, equipe } = useApp()
  const [modo, setModo] = useState<'todos' | 'setores' | 'pessoas'>('todos')
  const [setores, setSetores] = useState<Setor[]>([])
  const [pessoas, setPessoas] = useState<string[]>([])
  const [busca, setBusca] = useState('')
  const [titulo, setTitulo] = useState('')
  const [corpo, setCorpo] = useState('')
  const [unidadeId, setUnidadeId] = useState('')
  const [erro, setErro] = useState('')

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (modo === 'setores' && !setores.length) return setErro('Escolha pelo menos um setor.')
    if (modo === 'pessoas' && !pessoas.length) return setErro('Escolha pelo menos uma pessoa.')
    try {
      await store.publicarComunicado({
        titulo, corpo,
        unidadeId: modo === 'pessoas' ? null : unidadeId || null,
        setores: modo === 'setores' ? setores : null,
        destinatarios: modo === 'pessoas' ? pessoas : null,
      })
      setTitulo('')
      setCorpo('')
      setPessoas([])
      setSetores([])
      setModo('todos')
      aoPublicar()
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  return (
    <Modal titulo="Novo aviso" aberto={aberto} aoFechar={aoFechar}>
      <form onSubmit={enviar} className="space-y-4">
        <div>
          <span className="mb-1 block text-sm font-medium text-stone-700">Para quem</span>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 text-sm font-semibold">
            {([['todos', 'Todo o time'], ['setores', 'Setores'], ['pessoas', 'Pessoas']] as const).map(([v, nome]) => (
              <button key={v} type="button" onClick={() => setModo(v)} className={`rounded-lg py-2 ${modo === v ? 'bg-white shadow-sm' : 'text-stone-600'}`}>
                {nome}
              </button>
            ))}
          </div>
        </div>
        {modo !== 'pessoas' && (
          <Campo rotulo="Loja">
            <select className={estiloEntrada} value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
              <option value="">Todas as lojas</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </Campo>
        )}
        {modo === 'setores' && (
          <div className="flex flex-wrap gap-2">
            {SETORES.filter((x) => x.valor !== 'unidade' && x.valor !== 'geral').map((x) => {
              const marcado = setores.includes(x.valor)
              return (
                <label key={x.valor} className={`cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${marcado ? 'bg-carvao text-white ring-carvao' : 'ring-stone-300'}`}>
                  <input type="checkbox" className="sr-only" checked={marcado} onChange={() => setSetores(marcado ? setores.filter((y) => y !== x.valor) : [...setores, x.valor])} />
                  {x.nome}
                </label>
              )
            })}
          </div>
        )}
        {modo === 'pessoas' && (
          <div className="space-y-2">
            <input className={estiloEntrada} type="search" placeholder="Buscar pessoa" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar pessoa" />
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl bg-stone-50 p-2 ring-1 ring-stone-200">
              {equipe
                .filter((f) => f.status === 'ativo' && (!busca || f.nome.toLowerCase().includes(busca.toLowerCase())))
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-carvao" checked={pessoas.includes(f.id)} onChange={(e) => setPessoas(e.target.checked ? [...pessoas, f.id] : pessoas.filter((x) => x !== f.id))} />
                    <span className="truncate">{f.nome}</span>
                    <span className="ml-auto shrink-0 text-xs text-stone-500">{apelidoUnidade(unidades.find((u) => u.id === f.unidadeId)?.nome ?? '')}</span>
                  </label>
                ))}
            </div>
            <p className="text-xs text-stone-500">{pessoas.length} escolhida{pessoas.length === 1 ? '' : 's'}. Só essas pessoas (e a gestão) veem o aviso.</p>
          </div>
        )}
        <Campo rotulo="Título">
          <input className={estiloEntrada} value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        </Campo>
        <Campo rotulo="Mensagem">
          <textarea className={estiloEntrada} rows={5} value={corpo} onChange={(e) => setCorpo(e.target.value)} required />
        </Campo>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full">Publicar</Botao>
      </form>
    </Modal>
  )
}
