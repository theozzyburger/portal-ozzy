import { useCallback, useEffect, useState } from 'react'
import { Botao, Campo, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import Preventiva from './Preventiva'
import Equipamentos from './Equipamentos'
import { atendeChamados } from '../lib/permissoes'
import {
  CATEGORIAS_CHAMADO, GRAVIDADES, STATUS_CHAMADO, apelidoUnidade, chamadoEmAberto, nomeCurto,
  type CategoriaChamado, type Chamado, type Gravidade, type StatusChamado,
} from '../lib/types'

const ORDEM_GRAVIDADE: Record<Gravidade, number> = { urgente: 0, importante: 1, simples: 2 }
const COR_GRAVIDADE: Record<Gravidade, string> = { urgente: 'bg-red-600', importante: 'bg-ozzy-500', simples: 'bg-stone-300' }
const SELO_GRAVIDADE: Record<Gravidade, 'vermelho' | 'ambar' | 'cinza'> = { urgente: 'vermelho', importante: 'ambar', simples: 'cinza' }
const SELO_STATUS: Record<StatusChamado, 'azul' | 'ambar' | 'cinza' | 'verde'> = {
  aberto: 'azul', andamento: 'ambar', aguardando: 'cinza', resolvido: 'verde', cancelado: 'cinza',
}

export const nomeGravidade = (g: Gravidade) => GRAVIDADES.find((x) => x.valor === g)!.nome
const nomeCategoria = (c: CategoriaChamado) => CATEGORIAS_CHAMADO.find((x) => x.valor === c)!.nome
const nomeStatus = (s: StatusChamado) => STATUS_CHAMADO.find((x) => x.valor === s)!.nome
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function haQuanto(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`
}

// Em aberto: urgentes primeiro e, dentro de cada gravidade, quem espera há mais tempo.
const ordenarAbertos = (a: Chamado, b: Chamado) =>
  ORDEM_GRAVIDADE[a.gravidade] - ORDEM_GRAVIDADE[b.gravidade] || a.abertoEm.localeCompare(b.abertoEm)

// Manutenção e gestão têm três abas: chamados (corretiva, o que quebrou), preventiva e equipamentos.
export default function Manutencao() {
  const { eu } = useApp()
  const [aba, setAba] = useState<'chamados' | 'preventiva' | 'equipamentos'>('chamados')
  if (!atendeChamados(eu.nivel)) return <Chamados />
  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-stone-200 p-1 text-sm font-semibold">
        {([['chamados', 'Chamados'], ['preventiva', 'Preventiva'], ['equipamentos', 'Equipamentos']] as const).map(([a, nome]) => (
          <button key={a} onClick={() => setAba(a)} className={`flex-1 rounded-lg px-3 py-2 whitespace-nowrap ${aba === a ? 'bg-white shadow-sm' : 'text-stone-600'}`}>
            {nome}
          </button>
        ))}
      </div>
      {aba === 'chamados' ? <Chamados /> : aba === 'preventiva' ? <Preventiva /> : <Equipamentos />}
    </div>
  )
}

function Chamados() {
  const { eu, store, unidades, nomeDe, avisar } = useApp()
  const atende = atendeChamados(eu.nivel)
  const [chamados, setChamados] = useState<Chamado[] | null>(null)
  const [aba, setAba] = useState<'abertos' | 'fechados'>('abertos')
  const [loja, setLoja] = useState('')
  const [abrindo, setAbrindo] = useState(false)
  const [aberto, setAberto] = useState<string | null>(null)

  const carregar = useCallback(() => store.chamados().then(setChamados), [store])
  useEffect(() => {
    carregar()
  }, [carregar])

  if (!chamados) return <p className="text-stone-400">Carregando…</p>

  const daLoja = chamados.filter((c) => !loja || c.unidadeId === loja)
  const abertos = daLoja.filter((c) => chamadoEmAberto(c.status)).sort(ordenarAbertos)
  const fechados = daLoja.filter((c) => !chamadoEmAberto(c.status)).sort((a, b) => (b.fechadoEm ?? '').localeCompare(a.fechadoEm ?? ''))
  const lista = aba === 'abertos' ? abertos : fechados
  const urgentes = abertos.filter((c) => c.gravidade === 'urgente').length
  const aguardando = abertos.filter((c) => c.status === 'aguardando').length
  const mes = Date.now() - 30 * 86400000
  const resolvidos30 = daLoja.filter((c) => c.status === 'resolvido' && c.fechadoEm && new Date(c.fechadoEm).getTime() > mes).length
  const nomeLoja = (id: string) => apelidoUnidade(unidades.find((u) => u.id === id)?.nome ?? id)
  const selecionado = chamados.find((c) => c.id === aberto)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{eu.nivel === 'manutencao' ? 'Seus chamados' : 'Manutenção'}</h1>
          <p className="text-sm text-stone-500">
            {atende ? 'Chamados das três lojas. Urgentes primeiro, depois quem espera há mais tempo.' : 'Viu algo quebrado ou com defeito? Abra um chamado para a manutenção.'}
          </p>
        </div>
        <Botao onClick={() => setAbrindo(true)}>+ Abrir chamado</Botao>
      </div>

      {atende && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Numero rotulo="Em aberto" valor={abertos.length} />
          <Numero rotulo="Urgentes" valor={urgentes} alerta={urgentes > 0} />
          <Numero rotulo="Aguardando peça" valor={aguardando} />
          <Numero rotulo="Resolvidos em 30 dias" valor={resolvidos30} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-white p-1 ring-1 ring-stone-300">
          {(['abertos', 'fechados'] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${aba === a ? 'bg-carvao text-white' : 'text-stone-600'}`}
            >
              {a === 'abertos' ? `Em aberto (${abertos.length})` : `Encerrados (${fechados.length})`}
            </button>
          ))}
        </div>
        {atende && (
          <select className={`${estiloEntrada} w-auto! py-2!`} value={loja} onChange={(e) => setLoja(e.target.value)} aria-label="Loja">
            <option value="">Todas as lojas</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {apelidoUnidade(u.nome)}
              </option>
            ))}
          </select>
        )}
      </div>

      {lista.length === 0 ? (
        <Vazio>{aba === 'abertos' ? 'Nenhum chamado em aberto. Tudo funcionando!' : 'Nenhum chamado encerrado ainda.'}</Vazio>
      ) : (
        <ul className="space-y-2">
          {lista.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setAberto(c.id)}
                className="flex w-full overflow-hidden rounded-2xl bg-white text-left ring-1 ring-stone-200 transition hover:ring-carvao"
              >
                <span className={`w-1.5 shrink-0 ${chamadoEmAberto(c.status) ? COR_GRAVIDADE[c.gravidade] : 'bg-emerald-500'}`} />
                <span className="min-w-0 flex-1 p-3.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {chamadoEmAberto(c.status) && <Selo cor={SELO_GRAVIDADE[c.gravidade]}>{nomeGravidade(c.gravidade)}</Selo>}
                    <Selo cor={SELO_STATUS[c.status]}>{nomeStatus(c.status)}</Selo>
                    <span className="text-xs text-stone-500">#{c.numero}</span>
                  </span>
                  <span className="mt-1 block font-semibold">{c.titulo}</span>
                  <span className="block text-sm text-stone-500">
                    {nomeLoja(c.unidadeId)}
                    {c.local && ` · ${c.local}`} · {nomeCategoria(c.categoria)}
                  </span>
                  <span className="mt-0.5 block text-xs text-stone-500">
                    {chamadoEmAberto(c.status)
                      ? `Aberto por ${nomeCurto(nomeDe(c.abertoPor))} ${haQuanto(c.abertoEm)}`
                      : `${nomeStatus(c.status)} ${haQuanto(c.fechadoEm ?? c.abertoEm)}`}
                    {c.eventos.length > 0 && ` · ${c.eventos.length} ${c.eventos.length === 1 ? 'atualização' : 'atualizações'}`}
                  </span>
                </span>
                <span className="self-center pr-4 text-xl text-stone-300">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {abrindo && (
        <NovoChamado
          aoFechar={() => setAbrindo(false)}
          aoSalvar={async (c) => {
            setAbrindo(false)
            await carregar()
            setAba('abertos')
            avisar(`Chamado #${c.numero} aberto. A manutenção já pode ver.`)
          }}
        />
      )}
      {selecionado && <Detalhe chamado={selecionado} aoFechar={() => setAberto(null)} aoMudar={carregar} />}
    </div>
  )
}

function Numero({ rotulo, valor, alerta }: { rotulo: string; valor: number; alerta?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ring-1 ${alerta ? 'bg-red-50 ring-red-200' : 'bg-white ring-stone-200'}`}>
      <div className={`text-2xl font-bold tabular-nums ${alerta ? 'text-red-700' : ''}`}>{valor}</div>
      <div className="text-xs text-stone-500">{rotulo}</div>
    </div>
  )
}

function NovoChamado({ aoFechar, aoSalvar }: { aoFechar: () => void; aoSalvar: (c: Chamado) => void }) {
  const { eu, store, unidades } = useApp()
  const [unidadeId, setUnidadeId] = useState(eu.unidadeId)
  const [titulo, setTitulo] = useState('')
  const [gravidade, setGravidade] = useState<Gravidade | ''>('')
  const [categoria, setCategoria] = useState<CategoriaChamado | ''>('')
  const [local, setLocal] = useState('')
  const [descricao, setDescricao] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim() || !gravidade || !categoria) return setErro('Preencha o que aconteceu, a gravidade e a categoria.')
    try {
      setEnviando(true)
      setErro('')
      aoSalvar(await store.abrirChamado({ unidadeId, titulo: titulo.trim(), gravidade, categoria, local: local.trim(), descricao: descricao.trim(), foto: foto ?? undefined }))
    } catch (err) {
      setErro((err as Error).message)
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Abrir chamado" aberto aoFechar={aoFechar}>
      <form onSubmit={enviar} className="space-y-4">
        <Campo rotulo="Loja">
          <select className={estiloEntrada} value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="O que aconteceu?">
          <input className={estiloEntrada} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: freezer não está gelando" maxLength={90} />
        </Campo>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-stone-700">Gravidade</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {GRAVIDADES.map((g) => (
              <label
                key={g.valor}
                className={`cursor-pointer rounded-xl p-3 ring-1 transition ${gravidade === g.valor ? 'bg-carvao text-white ring-carvao' : 'bg-white ring-stone-300 hover:ring-stone-500'}`}
              >
                <input type="radio" name="gravidade" className="sr-only" checked={gravidade === g.valor} onChange={() => setGravidade(g.valor)} />
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className={`h-2.5 w-2.5 rounded-full ${COR_GRAVIDADE[g.valor]}`} />
                  {g.nome}
                </span>
                <span className={`mt-0.5 block text-xs ${gravidade === g.valor ? 'text-stone-300' : 'text-stone-500'}`}>{g.dica}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Campo rotulo="Categoria" dica={categoria ? CATEGORIAS_CHAMADO.find((c) => c.valor === categoria)?.exemplos : undefined}>
          <select className={estiloEntrada} value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaChamado)}>
            <option value="">Escolha…</option>
            {CATEGORIAS_CHAMADO.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Onde na loja? (opcional)">
          <input className={estiloEntrada} value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: cozinha, salão, banheiro, estoque" list="locais-loja" />
          <datalist id="locais-loja">
            {['Cozinha', 'Salão', 'Balcão', 'Banheiro do salão', 'Banheiro da equipe', 'Estoque', 'Fachada', 'Escritório'].map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </Campo>
        <Campo rotulo="Descrição">
          <textarea className={estiloEntrada} rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Desde quando, o que já tentaram, se dá para continuar trabalhando…" />
        </Campo>
        <Campo rotulo="Foto (opcional)">
          <input type="file" accept="image/*" capture="environment" className="block w-full text-sm" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
        </Campo>
        <p className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
          O chamado fica registrado em nome de <b>{eu.nome}</b>, em {agora}.
        </p>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao type="submit" className="w-full" disabled={enviando}>
          Abrir chamado
        </Botao>
      </form>
    </Modal>
  )
}

function Detalhe({ chamado: c, aoFechar, aoMudar }: { chamado: Chamado; aoFechar: () => void; aoMudar: () => Promise<unknown> }) {
  const { eu, store, unidades, nomeDe, avisar } = useApp()
  const atende = atendeChamados(eu.nivel)
  const [foto, setFoto] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    store.fotoChamado(c).then(setFoto)
  }, [store, c])

  const mudar = async (status?: StatusChamado) => {
    if (!status && !texto.trim()) return
    if (status === 'resolvido' && !texto.trim()) return setErro('Conte em uma frase o que foi feito para resolver.')
    try {
      setErro('')
      await store.atualizarChamado(c.id, { status, texto })
      setTexto('')
      await aoMudar()
      avisar(status ? `Chamado #${c.numero}: ${nomeStatus(status).toLowerCase()}` : 'Comentário enviado')
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  const acoes: { status: StatusChamado; rotulo: string; principal?: boolean }[] = chamadoEmAberto(c.status)
    ? [
        ...(c.status !== 'andamento' ? [{ status: 'andamento' as const, rotulo: 'Estou cuidando' }] : []),
        ...(c.status !== 'aguardando' ? [{ status: 'aguardando' as const, rotulo: 'Aguardando peça' }] : []),
        { status: 'resolvido', rotulo: 'Marcar como resolvido', principal: true },
      ]
    : [{ status: 'aberto', rotulo: 'Reabrir' }]

  return (
    <Modal titulo={`Chamado #${c.numero}`} aberto aoFechar={aoFechar}>
      <div className="space-y-4">
        <div>
          <div className="flex flex-wrap gap-1.5">
            <Selo cor={SELO_GRAVIDADE[c.gravidade]}>{nomeGravidade(c.gravidade)}</Selo>
            <Selo cor={SELO_STATUS[c.status]}>{nomeStatus(c.status)}</Selo>
          </div>
          <h3 className="mt-2 text-lg font-bold">{c.titulo}</h3>
          {c.descricao && <p className="mt-1 text-[15px] whitespace-pre-line text-stone-700">{c.descricao}</p>}
        </div>
        {foto && <img src={foto} alt="Foto do chamado" className="max-h-64 w-full rounded-xl object-cover" />}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-stone-50 p-3 text-sm">
          <dt className="text-stone-500">Loja</dt>
          <dd>{apelidoUnidade(unidades.find((u) => u.id === c.unidadeId)?.nome ?? c.unidadeId)}{c.local && `, ${c.local}`}</dd>
          <dt className="text-stone-500">Categoria</dt>
          <dd>{nomeCategoria(c.categoria)}</dd>
          <dt className="text-stone-500">Aberto por</dt>
          <dd>{nomeDe(c.abertoPor)}</dd>
          <dt className="text-stone-500">Quando</dt>
          <dd>{dataHora(c.abertoEm)} ({haQuanto(c.abertoEm)})</dd>
          {c.responsavelId && (
            <>
              <dt className="text-stone-500">Responsável</dt>
              <dd>{nomeDe(c.responsavelId)}</dd>
            </>
          )}
        </dl>

        {c.eventos.length > 0 && (
          <ol className="space-y-3 border-l-2 border-stone-200 pl-4">
            {c.eventos.map((e) => (
              <li key={e.id} className="text-sm">
                <div className="text-xs text-stone-500">
                  <b className="text-stone-700">{nomeCurto(nomeDe(e.autorId))}</b>, {dataHora(e.em)}
                  {e.status && <> · mudou para <b className="text-stone-700">{nomeStatus(e.status).toLowerCase()}</b></>}
                </div>
                {e.texto && <p className="text-stone-700">{e.texto}</p>}
              </li>
            ))}
          </ol>
        )}

        <div className="space-y-2">
          <textarea
            className={estiloEntrada}
            rows={2}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={atende ? 'O que foi feito, peça que falta, previsão…' : 'Alguma novidade? Ex.: piorou, voltou a funcionar…'}
            aria-label="Comentário"
          />
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex flex-wrap gap-2">
            {atende &&
              acoes.map((a) => (
                <Botao key={a.status} variante={a.principal ? 'primario' : 'secundario'} onClick={() => mudar(a.status)}>
                  {a.rotulo}
                </Botao>
              ))}
            <Botao variante="fantasma" disabled={!texto.trim()} onClick={() => mudar()}>
              Só comentar
            </Botao>
          </div>
        </div>
      </div>
    </Modal>
  )
}
