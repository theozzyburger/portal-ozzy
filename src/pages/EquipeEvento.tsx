import { useCallback, useEffect, useState } from 'react'
import { Botao, Campo, Cartao, Modal, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import type { Evento, FreelaEvento, Funcionario, MembroEquipeEvento, Operacao } from '../lib/types'
import { FUNCOES_EVENTO } from './FreelasEventos'

// Equipe do evento (pedido de 09/10): quem trabalha e onde fica. Uma barraca por operação que vai ao evento
// (The Ozzy Pizza, Foca…), cada uma com três lugares: Caixa na frente, Operação e Apoio atrás.
// Para mudar alguém de lugar: toque na pessoa e depois no lugar (ou arraste).

const FUNCOES = ['Responsável', ...FUNCOES_EVENTO]
// No banco a posição continua 0 a 8 (a grade antiga): 0-2 = Caixa, 3-5 = Operação, 6-8 = Apoio.
const AREAS = [{ nome: 'Caixa', pos: 0 }, { nome: 'Operação', pos: 3 }, { nome: 'Apoio', pos: 6 }]
export const nomeQuadrado = (pos: number) => AREAS[Math.min(2, Math.floor(pos / 3))].nome
const areaDe = (pos: number | null) => (pos === null ? null : Math.min(2, Math.floor(pos / 3)))

interface Dados {
  equipe: MembroEquipeEvento[]
  funcionarios: Funcionario[]
  freelas: FreelaEvento[]
  operacoes: Operacao[]
}

export default function EquipeEvento({ e }: { e: Evento; aoMudarEvento?: () => Promise<void> }) {
  const { store, avisar } = useApp()
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [vista, setVista] = useState<'barraca' | 'lista'>('barraca')
  const [editando, setEditando] = useState<MembroEquipeEvento | 'novo' | null>(null)
  const [escolhido, setEscolhido] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      const [equipe, funcionarios, freelas, operacoes] = await Promise.all([store.equipeEvento(e.id), store.funcionarios(), store.freelasEvento(), store.operacoes()])
      setD({ equipe, funcionarios, freelas, operacoes })
    } catch (err) {
      setErro((err as Error).message)
    }
  }, [store, e.id])
  useEffect(() => {
    carregar()
  }, [carregar])

  if (erro) return <p className="text-red-600">{erro}</p>
  if (!d) return <p className="text-stone-400">Carregando…</p>

  const nome = (m: MembroEquipeEvento) =>
    m.funcionarioId ? d.funcionarios.find((f) => f.id === m.funcionarioId)?.nome ?? 'Funcionário'
      : m.freelaId ? d.freelas.find((f) => f.id === m.freelaId)?.nome ?? 'Freela'
        : m.nome ?? '—'
  const curto = (m: MembroEquipeEvento) => {
    const p = nome(m).split(/\s+/)
    return p.length > 1 ? `${p[0]} ${p[p.length - 1]}` : p[0]
  }
  const origem = (m: MembroEquipeEvento) => (m.funcionarioId ? 'Equipe' : m.freelaId ? 'Freela' : 'Sem cadastro')
  // Barraca n = n-ésima operação do evento.
  const nomesOperacoes = e.operacoes.map((id) => d.operacoes.find((o) => o.id === id)?.nome ?? 'Operação')
  const qtdBarracas = Math.max(1, nomesOperacoes.length, ...d.equipe.map((m) => m.barraca))
  const nomeBarraca = (b: number) => nomesOperacoes[b - 1] ?? `Barraca ${b}`
  const rotulo = (_b: number, pos: number) => nomeQuadrado(pos)

  const mover = async (id: string, b: number, pos: number | null) => {
    const m = d.equipe.find((x) => x.id === id)
    if (!m) return
    const novo = { ...m, barraca: b, posicao: pos }
    setD({ ...d, equipe: d.equipe.map((x) => (x.id === id ? novo : x)) })
    setEscolhido(null)
    try {
      await store.salvarMembroEquipe(novo)
    } catch (err) {
      avisar((err as Error).message)
      await carregar()
    }
  }
  const copiar = async () => {
    const linhas = [`*Equipe · ${e.nome}*`]
    for (let b = 1; b <= qtdBarracas; b++) {
      const doB = d.equipe.filter((m) => m.barraca === b)
      if (!doB.length) continue
      linhas.push('', `*${nomeBarraca(b)}*`)
      for (const [i, area] of [...AREAS.map((x) => x.nome), 'Sem lugar'].entries()) {
        const aqui = doB.filter((m) => (areaDe(m.posicao) ?? 3) === i)
        if (aqui.length) linhas.push(`${area}: ${aqui.map((m) => nome(m) + (m.funcao ? ` (${m.funcao})` : '')).join(', ')}`)
      }
    }
    try {
      await navigator.clipboard.writeText(linhas.join('\n'))
      avisar('Equipe copiada')
    } catch {
      avisar('Não deu para copiar neste aparelho')
    }
  }

  const semLugar = d.equipe.filter((m) => m.posicao === null)

  const Pessoa = ({ m }: { m: MembroEquipeEvento }) => (
    <button
      type="button"
      draggable
      onDragStart={(ev) => ev.dataTransfer.setData('text/plain', m.id)}
      onClick={(ev) => {
        ev.stopPropagation()
        setEscolhido(escolhido === m.id ? null : m.id)
      }}
      aria-pressed={escolhido === m.id}
      title={`${nome(m)}${m.funcao ? ` · ${m.funcao}` : ''}`}
      className={`w-full rounded-lg px-2 py-1 text-left text-xs leading-tight shadow-sm ring-1 ${escolhido === m.id ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-800 ring-stone-200 hover:ring-stone-400'}`}
    >
      <span className="block font-semibold break-words">{curto(m)}{m.posicao === null && qtdBarracas > 1 && <span className="font-normal opacity-60"> · {nomeBarraca(m.barraca)}</span>}</span>
      {m.funcao && <span className={`block truncate ${escolhido === m.id ? 'text-ozzy-400' : 'text-stone-500'}`}>{m.funcao}</span>}
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(['barraca', 'lista'] as const).map((v) => (
            <button key={v} onClick={() => setVista(v)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${vista === v ? 'bg-carvao text-white' : 'text-stone-600 hover:bg-stone-200'}`}>
              {v === 'barraca' ? 'Barraca' : 'Lista'}
            </button>
          ))}
        </div>
        <span className="text-sm text-stone-500">{d.equipe.length} {d.equipe.length === 1 ? 'pessoa' : 'pessoas'}</span>
        <div className="flex gap-2 sm:ml-auto">
          {d.equipe.length > 0 && <Botao variante="secundario" onClick={copiar}>Copiar para WhatsApp</Botao>}
          <Botao onClick={() => setEditando('novo')}>+ Pessoa</Botao>
        </div>
      </div>

      {!d.equipe.length ? (
        <Vazio>Ninguém na equipe deste evento ainda. Use “+ Pessoa” para colocar alguém da equipe, da base de freelas de eventos ou outra pessoa.</Vazio>
      ) : vista === 'lista' ? (
        <div className="space-y-3">
          {Array.from({ length: qtdBarracas }, (_, i) => i + 1).map((b) => {
            const lista = d.equipe.filter((m) => m.barraca === b)
            if (!lista.length) return null
            return (
              <Cartao key={b}>
                <h3 className="mb-2 font-bold">{nomeBarraca(b)}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-stone-500">
                      <tr>
                        <th className="py-1 pr-2">Nome</th>
                        <th className="px-2 py-1">Função</th>
                        <th className="px-2 py-1">Lugar</th>
                        <th className="px-2 py-1">Origem</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {[...lista].sort((x, y) => (areaDe(x.posicao) ?? 9) - (areaDe(y.posicao) ?? 9)).map((m) => (
                        <tr key={m.id} className="border-t border-stone-100">
                          <td className="py-1.5 pr-2 font-semibold">{nome(m)}{m.observacao && <span className="block text-xs font-normal text-stone-500">{m.observacao}</span>}</td>
                          <td className="px-2 py-1.5">{m.funcao ?? '—'}</td>
                          <td className="px-2 py-1.5">{m.posicao === null ? <span className="text-amber-700">sem lugar</span> : rotulo(b, m.posicao)}</td>
                          <td className="px-2 py-1.5 text-stone-500">{origem(m)}</td>
                          <td className="px-2 py-1.5 text-right"><button className="text-xs font-semibold text-stone-500 hover:text-carvao" onClick={() => setEditando(m)}>Editar</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Cartao>
            )
          })}
        </div>
      ) : (
        <Cartao>
          <p className="mb-3 text-xs text-stone-500">
            {escolhido ? 'Agora toque no lugar para onde a pessoa vai (pode ser em outra barraca).' : 'Toque numa pessoa e depois no lugar (no computador, dá para arrastar).'}
          </p>
          <div className="overflow-x-auto">
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${qtdBarracas}, minmax(15rem, 1fr))` }}>
              {Array.from({ length: qtdBarracas }, (_, i) => i + 1).map((b) => {
                const doB = d.equipe.filter((m) => m.barraca === b)
                return (
                  <div key={b}>
                    <div className="rounded-t-xl bg-stone-100 py-1.5 text-center text-xs font-bold tracking-wide text-stone-500 uppercase">Clientes</div>
                    <div className="bg-ozzy-400 py-1 text-center text-xs font-bold tracking-wide text-carvao uppercase">{nomeBarraca(b)} · balcão</div>
                    <div className="grid grid-cols-2 gap-1.5 rounded-b-xl border-4 border-t-0 border-carvao bg-stone-50 p-1.5">
                      {AREAS.map((area, i) => {
                        const aqui = doB.filter((m) => areaDe(m.posicao) === i)
                        return (
                          <div
                            key={area.nome}
                            role="button"
                            tabIndex={0}
                            aria-label={`${nomeBarraca(b)}: ${area.nome}`}
                            onClick={() => escolhido && mover(escolhido, b, area.pos)}
                            onKeyDown={(ev) => ev.key === 'Enter' && escolhido && mover(escolhido, b, area.pos)}
                            onDragOver={(ev) => ev.preventDefault()}
                            onDrop={(ev) => {
                              ev.preventDefault()
                              mover(ev.dataTransfer.getData('text/plain'), b, area.pos)
                            }}
                            className={`flex min-h-24 flex-col gap-1 rounded-lg border-2 border-dashed p-1.5 ${i === 0 ? 'col-span-2' : ''} ${escolhido ? 'cursor-pointer border-sky-400 bg-sky-50/60' : 'border-stone-200 bg-white'}`}
                          >
                            <span className="text-[11px] font-bold tracking-wide text-carvao uppercase">
                              {area.nome} <span className="font-normal text-stone-400">{i === 0 ? '· frente' : '· atrás'}</span>
                            </span>
                            <div className={`grid gap-1 ${i === 0 ? 'grid-cols-2' : ''}`}>{aqui.map((m) => <Pessoa key={m.id} m={m} />)}</div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-1 text-center text-xs font-bold tracking-wide text-stone-400 uppercase">Fundo</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div
            className="mt-4 rounded-xl bg-stone-100 p-2"
            onClick={() => {
              const m = escolhido && d.equipe.find((x) => x.id === escolhido)
              if (m) mover(m.id, m.barraca, null)
            }}
            onDragOver={(ev) => ev.preventDefault()}
            onDrop={(ev) => {
              ev.preventDefault()
              const m = d.equipe.find((x) => x.id === ev.dataTransfer.getData('text/plain'))
              if (m) mover(m.id, m.barraca, null)
            }}
          >
            <div className="mb-1.5 text-xs font-semibold text-stone-600">
              Sem lugar {escolhido && d.equipe.some((m) => m.id === escolhido && m.posicao !== null) && '· toque aqui para tirar do lugar'}
            </div>
            {semLugar.length ? (
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">{semLugar.map((m) => <Pessoa key={m.id} m={m} />)}</div>
            ) : (
              <p className="text-xs text-stone-500">Todo mundo já tem lugar.</p>
            )}
          </div>
          {escolhido && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Botao variante="secundario" onClick={() => setEditando(d.equipe.find((m) => m.id === escolhido) ?? null)}>Editar {curto(d.equipe.find((m) => m.id === escolhido)!)}</Botao>
              <Botao variante="secundario" onClick={() => setEscolhido(null)}>Cancelar</Botao>
            </div>
          )}
        </Cartao>
      )}

      {editando && (
        <EditarMembro
          e={e}
          m={editando === 'novo' ? null : editando}
          d={d}
          barraca={1}
          qtdBarracas={qtdBarracas}
          nomeBarraca={nomeBarraca}
          aoFechar={() => setEditando(null)}
          aoSalvar={async () => {
            setEditando(null)
            setEscolhido(null)
            await carregar()
          }}
        />
      )}
    </div>
  )
}

function EditarMembro({ e, m, d, barraca, qtdBarracas, nomeBarraca, aoFechar, aoSalvar }: {
  e: Evento
  m: MembroEquipeEvento | null
  d: Dados
  barraca: number
  qtdBarracas: number
  nomeBarraca: (b: number) => string
  aoFechar: () => void
  aoSalvar: () => Promise<void>
}) {
  const { store, avisar } = useApp()
  const tipoInicial = m?.funcionarioId ? 'funcionario' : m?.freelaId ? 'freela' : m ? 'outro' : 'funcionario'
  const [tipo, setTipo] = useState<'funcionario' | 'freela' | 'outro'>(tipoInicial)
  const [pessoa, setPessoa] = useState(m?.funcionarioId ?? m?.freelaId ?? '')
  const [nomeLivre, setNomeLivre] = useState(m?.nome ?? '')
  const [funcao, setFuncao] = useState(m?.funcao ?? '')
  const [b, setB] = useState(m?.barraca ?? barraca)
  const [obs, setObs] = useState(m?.observacao ?? '')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const jaTem = new Set(d.equipe.filter((x) => x.id !== m?.id).map((x) => x.funcionarioId ?? x.freelaId))
  const funcionarios = d.funcionarios.filter((f) => f.status === 'ativo' && (!jaTem.has(f.id) || f.id === pessoa)).sort((a, c) => a.nome.localeCompare(c.nome))
  const freelas = d.freelas.filter((f) => (f.ativo || f.id === pessoa) && (!jaTem.has(f.id) || f.id === pessoa)).sort((a, c) => a.nome.localeCompare(c.nome))

  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (tipo !== 'outro' && !pessoa) return setErro('Escolha a pessoa.')
    if (tipo === 'outro' && !nomeLivre.trim()) return setErro('Escreva o nome.')
    setSalvando(true)
    try {
      await store.salvarMembroEquipe({
        id: m?.id, eventoId: e.id,
        funcionarioId: tipo === 'funcionario' ? pessoa : null, freelaId: tipo === 'freela' ? pessoa : null, nome: tipo === 'outro' ? nomeLivre : null,
        funcao: funcao || null, barraca: b, posicao: m && m.barraca === b ? m.posicao : null, observacao: obs || null,
        ordem: m?.ordem ?? Math.max(0, ...d.equipe.map((x) => x.ordem)) + 1,
      })
      await aoSalvar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setSalvando(false)
    }
  }
  const remover = async () => {
    if (!m || !confirm('Tirar esta pessoa da equipe do evento?')) return
    try {
      await store.excluirMembroEquipe(m.id)
      await aoSalvar()
    } catch (err) {
      avisar((err as Error).message)
    }
  }

  return (
    <Modal titulo={m ? 'Editar pessoa da equipe' : 'Colocar pessoa na equipe'} aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {([['funcionario', 'Da equipe'], ['freela', 'Freela de eventos'], ['outro', 'Outra pessoa']] as const).map(([v, n]) => (
            <button key={v} type="button" onClick={() => { setTipo(v); setPessoa('') }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tipo === v ? 'bg-carvao text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
              {n}
            </button>
          ))}
        </div>
        {tipo === 'outro' ? (
          <Campo rotulo="Nome">
            <input className={estiloEntrada} value={nomeLivre} onChange={(ev) => setNomeLivre(ev.target.value)} required />
          </Campo>
        ) : (
          <Campo rotulo={tipo === 'funcionario' ? 'Pessoa da equipe' : 'Freela da base de eventos'}>
            <select className={estiloEntrada} value={pessoa} onChange={(ev) => {
              setPessoa(ev.target.value)
              const f = d.freelas.find((x) => x.id === ev.target.value)
              if (tipo === 'freela' && f?.funcao && !funcao) setFuncao(f.funcao)
            }} required>
              <option value="">Escolha…</option>
              {(tipo === 'funcionario' ? funcionarios : freelas).map((p) => (
                <option key={p.id} value={p.id}>{p.nome}{'cargo' in p && p.cargo ? ` (${p.cargo})` : ''}{'funcao' in p && p.funcao ? ` (${p.funcao})` : ''}</option>
              ))}
            </select>
          </Campo>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Função no evento">
            <input className={estiloEntrada} list="funcoes-equipe" value={funcao} onChange={(ev) => setFuncao(ev.target.value)} placeholder="Ex.: Caixa" />
            <datalist id="funcoes-equipe">{FUNCOES.map((f) => <option key={f} value={f} />)}</datalist>
          </Campo>
          <Campo rotulo="Barraca">
            <select className={estiloEntrada} value={b} onChange={(ev) => setB(Number(ev.target.value))}>
              {Array.from({ length: Math.max(qtdBarracas, b) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{nomeBarraca(n)}</option>)}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Observação (opcional)">
          <input className={estiloEntrada} value={obs} onChange={(ev) => setObs(ev.target.value)} placeholder="Ex.: só no sábado" />
        </Campo>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <div className="flex gap-2">
          {m && <Botao type="button" variante="secundario" onClick={remover}>Tirar da equipe</Botao>}
          <Botao className="flex-1" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
        </div>
      </form>
    </Modal>
  )
}
