import { useCallback, useEffect, useState } from 'react'
import Assinatura from '../components/Assinatura'
import { Botao, Campo, Cartao, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { dataLonga, hoje } from '../lib/datas'
import { podeGerenciar, possoAlterar } from '../lib/permissoes'
import { FotoTroca } from './Compras'
import { ir } from '../lib/rota'
import DevolucaoUniformes from '../components/DevolucaoUniformes'
import { PECAS, corCamiseta } from '../lib/uniformes'
import { ITENS_TROCA, type SolicitacaoUniforme, ITENS_UNIFORME, TAMANHOS, termoUniforme, type EntregaUniforme, type Funcionario, type ItemUniforme } from '../lib/types'

const resumoItens = (itens: ItemUniforme[]) => itens.map((i) => `${i.quantidade}x ${i.item}${i.tamanho ? ` ${i.tamanho}` : ''}`).join(' · ')

export default function Uniformes({ pessoa }: { pessoa: Funcionario }) {
  const { eu, store, nomeDe, avisar } = useApp()
  const [entregas, setEntregas] = useState<EntregaUniforme[]>([])
  const [modal, setModal] = useState<{ tipo: 'nova' } | { tipo: 'assinar' | 'ver'; e: EntregaUniforme } | null>(null)
  const gestao = possoAlterar(eu, pessoa)
  const souEu = pessoa.id === eu.id

  const carregar = useCallback(async () => setEntregas(await store.uniformes(pessoa.id)), [store, pessoa.id])
  useEffect(() => {
    carregar()
  }, [carregar])

  return (
    <section className="space-y-2">
      {(souEu || podeGerenciar(eu.nivel)) && <Trocas pessoa={pessoa} souEu={souEu} />}
      {gestao && pessoa.status === 'ativo' && (
        <Botao className="w-full" onClick={() => setModal({ tipo: 'nova' })}>
          + Registrar entrega de uniforme
        </Botao>
      )}
      {entregas.length === 0 ? (
        <Vazio>Nenhuma entrega de uniforme registrada.</Vazio>
      ) : (
        entregas.map((e) => (
          <Cartao key={e.id} onClick={() => setModal({ tipo: souEu && !e.assinatura ? 'assinar' : 'ver', e })}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{dataLonga(e.data)}</span>
                  {e.assinatura ? <Selo cor="verde">✓ Assinado</Selo> : <Selo cor="ambar">! Falta assinar</Selo>}
                </div>
                <div className="mt-1 text-sm text-stone-700">{resumoItens(e.itens)}</div>
                <div className="mt-1 text-xs text-stone-500">
                  Entregue por {nomeDe(e.entreguePor)}
                  {e.observacao && ` · ${e.observacao}`}
                </div>
              </div>
              {souEu && !e.assinatura ? <span className="shrink-0 text-sm font-semibold underline decoration-ozzy-500 decoration-2 underline-offset-4">Assinar</span> : <span className="text-stone-400">›</span>}
            </div>
          </Cartao>
        ))
      )}

      {(entregas.length > 0 || pessoa.status === 'inativo') && (podeGerenciar(eu.nivel) || souEu) && (
        <DevolucaoUniformes pessoa={pessoa} entregas={entregas} gestao={gestao} />
      )}

      {modal?.tipo === 'nova' && (
        <NovaEntrega
          pessoa={pessoa}
          aoFechar={() => setModal(null)}
          aoSalvar={async (assinado) => {
            setModal(null)
            await carregar()
            avisar(assinado ? 'Entrega registrada e assinada' : `Entrega registrada. ${pessoa.nome.split(' ')[0]} assina pelo portal.`)
          }}
        />
      )}
      {modal && modal.tipo !== 'nova' && (
        <Termo
          entrega={modal.e}
          pessoa={pessoa}
          assinar={modal.tipo === 'assinar'}
          aoFechar={() => setModal(null)}
          aoAssinar={async () => {
            setModal(null)
            await carregar()
            avisar('Termo assinado. Obrigado!')
          }}
        />
      )}
    </section>
  )
}

function NovaEntrega({ pessoa, aoFechar, aoSalvar }: { pessoa: Funcionario; aoFechar: () => void; aoSalvar: (assinado: boolean) => void }) {
  const { store } = useApp()
  const [data, setData] = useState(hoje())
  // Kit padrão da casa (5 peças), com os tamanhos do cadastro.
  const kit = (): ItemUniforme[] =>
    PECAS.map((p) => ({
      item: p.cor ? `Camiseta ${corCamiseta(pessoa).toLowerCase()}` : p.item,
      tamanho: p.tamanho(pessoa) ?? undefined,
      quantidade: 1,
    }))
  const [itens, setItens] = useState<ItemUniforme[]>(kit)
  const [observacao, setObservacao] = useState('')
  const [etapa, setEtapa] = useState<'itens' | 'assinar'>('itens')
  const [assinatura, setAssinatura] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  const mudar = (i: number, p: Partial<ItemUniforme>) => setItens(itens.map((x, k) => (k === i ? { ...x, ...p } : x)))
  const salvar = async (comAssinatura: boolean) => {
    if (itens.some((x) => !x.item.trim())) return setErro('Preencha o nome de cada item (ou tire a linha vazia).')
    try {
      await store.registrarUniforme({ funcionarioId: pessoa.id, data, itens, observacao, assinatura: comAssinatura ? assinatura! : undefined })
      aoSalvar(comAssinatura)
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  return (
    <Modal titulo={etapa === 'itens' ? 'Entrega de uniforme' : 'Assinatura do termo'} aberto aoFechar={aoFechar}>
      {etapa === 'itens' ? (
        <div className="space-y-4">
          <Campo rotulo="Data da entrega">
            <input className={estiloEntrada} type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <div className="space-y-2">
            <div className="text-sm font-semibold text-stone-700">Itens entregues</div>
            {itens.map((x, i) => (
              <div key={i} className="grid grid-cols-[1fr_5.5rem_3.5rem_auto] items-center gap-2">
                <input className={estiloEntrada} list="itens-uniforme" value={x.item} onChange={(e) => mudar(i, { item: e.target.value })} aria-label="Item" />
                <input className={estiloEntrada} list="tamanhos-uniforme" value={x.tamanho ?? ''} onChange={(e) => mudar(i, { tamanho: e.target.value || undefined })} aria-label="Tamanho" placeholder="—" />
                <input className={estiloEntrada} type="number" min={1} value={x.quantidade} onChange={(e) => mudar(i, { quantidade: Math.max(1, Number(e.target.value)) })} aria-label="Quantidade" />
                <button type="button" onClick={() => setItens(itens.filter((_, k) => k !== i))} disabled={itens.length === 1} className="px-1 text-lg text-stone-400 disabled:opacity-30" aria-label="Remover item">
                  ×
                </button>
              </div>
            ))}
            <datalist id="itens-uniforme">
              {['Camiseta preta', 'Camiseta branca', ...ITENS_UNIFORME].map((n) => <option key={n} value={n} />)}
            </datalist>
            <datalist id="tamanhos-uniforme">
              {TAMANHOS.map((t) => <option key={t} value={t} />)}
            </datalist>
            <div className="flex flex-wrap gap-4">
              <button type="button" onClick={() => setItens([...itens, { item: '', quantidade: 1 }])} className="text-sm font-semibold underline decoration-ozzy-500 decoration-2 underline-offset-4">
                + Adicionar item
              </button>
              <button type="button" onClick={() => setItens(kit())} className="text-sm font-semibold text-stone-500">
                Voltar ao kit padrão
              </button>
            </div>
          </div>
          <Campo rotulo="Observação (opcional)">
            <input className={estiloEntrada} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: troca da camiseta gasta" />
          </Campo>
          <div className="grid gap-2 sm:grid-cols-2">
            <Botao onClick={() => (itens.some((x) => !x.item.trim()) ? setErro('Preencha o nome de cada item (ou tire a linha vazia).') : setEtapa('assinar'))}>Assinar agora</Botao>
            <Botao variante="secundario" onClick={() => salvar(false)}>
              Assinar depois pelo portal
            </Botao>
          </div>
          <p className="text-xs text-stone-500">Assinar agora: passe o celular para {pessoa.nome.split(' ')[0]} assinar na hora. Depois: a pessoa recebe um aviso no portal para assinar.</p>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="rounded-xl bg-stone-50 p-3 text-sm leading-relaxed text-stone-700">{termoUniforme(pessoa.nome, data, itens)}</p>
          <Assinatura aoMudar={setAssinatura} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Botao variante="secundario" onClick={() => setEtapa('itens')}>
              Voltar
            </Botao>
            <Botao disabled={!assinatura} onClick={() => salvar(true)}>
              Confirmar assinatura
            </Botao>
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>
      )}
    </Modal>
  )
}

function Termo({ entrega, pessoa, assinar, aoFechar, aoAssinar }: { entrega: EntregaUniforme; pessoa: Funcionario; assinar: boolean; aoFechar: () => void; aoAssinar: () => void }) {
  const { store, nomeDe } = useApp()
  const [assinatura, setAssinatura] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const confirmar = async () => {
    try {
      await store.assinarUniforme(entrega.id, assinatura!)
      aoAssinar()
    } catch (err) {
      setErro((err as Error).message)
    }
  }
  return (
    <Modal titulo="Termo de recebimento de uniforme" aberto aoFechar={aoFechar}>
      <div className="space-y-4">
        <p className="rounded-xl bg-stone-50 p-3 text-sm leading-relaxed text-stone-700">{termoUniforme(pessoa.nome, entrega.data, entrega.itens, entrega.criadoEm)}</p>
        {entrega.assinatura ? (
          <div>
            <img src={entrega.assinatura} alt={`Assinatura de ${pessoa.nome}`} className="h-24 w-full rounded-xl border border-stone-200 bg-white object-contain" />
            <p className="mt-2 text-xs text-stone-500">
              Assinado por {pessoa.nome} em {new Date(entrega.assinadoEm!).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              {entrega.assinadoVia === 'presencial' ? `, na hora da entrega, no aparelho de ${nomeDe(entrega.entreguePor)}` : ', pelo próprio login no portal'}.
            </p>
          </div>
        ) : assinar ? (
          <>
            <Assinatura aoMudar={setAssinatura} />
            <Botao className="w-full" disabled={!assinatura} onClick={confirmar}>
              Assinar e confirmar recebimento
            </Botao>
          </>
        ) : (
          <p className="text-sm text-stone-500">Aguardando {pessoa.nome.split(' ')[0]} assinar pelo portal.</p>
        )}
        {erro && <p className="text-sm text-red-600">{erro}</p>}
      </div>
    </Modal>
  )
}

const SELO_TROCA = { aberta: 'ambar', atendida: 'verde', recusada: 'cinza' } as const
const NOME_TROCA = { aberta: 'Aguardando', atendida: 'Atendida', recusada: 'Recusada' } as const

// Pedido de troca de uniforme: a própria pessoa pede (com motivo e foto); vai para a gerência e o administrativo.
function Trocas({ pessoa, souEu }: { pessoa: Funcionario; souEu: boolean }) {
  const { eu, store, nomeDe, avisar } = useApp()
  const [lista, setLista] = useState<SolicitacaoUniforme[]>([])
  const [pedindo, setPedindo] = useState(false)
  const carregar = useCallback(() => store.solicitacoesUniforme(pessoa.id).then(setLista), [store, pessoa.id])
  useEffect(() => {
    carregar()
  }, [carregar])
  if (!souEu && !lista.length) return null
  return (
    <div className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">Trocas de uniforme</h3>
        {souEu && pessoa.status === 'ativo' && <Botao onClick={() => setPedindo(true)}>Pedir troca</Botao>}
        {!souEu && podeGerenciar(eu.nivel) && <Botao variante="secundario" onClick={() => ir('compras')}>Ver todas em Compras</Botao>}
      </div>
      {lista.length === 0 ? (
        <p className="text-sm text-stone-500">Uniforme gasto, rasgado ou não serve mais? Peça a troca aqui: vai direto para a gerência e o administrativo.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {lista.map((x) => (
            <li key={x.id} className="space-y-1 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <b>{x.itens.join(', ')}</b>
                <Selo cor={SELO_TROCA[x.status]}>{NOME_TROCA[x.status]}</Selo>
                <span className="text-xs text-stone-500">{dataLonga(x.criadoEm.slice(0, 10))}</span>
              </div>
              <p className="text-stone-700">{x.motivo}</p>
              {x.respondidoPor && (
                <p className="text-xs text-stone-500">
                  {nomeDe(x.respondidoPor)}: {x.resposta ?? NOME_TROCA[x.status].toLowerCase()}
                </p>
              )}
              {x.foto && <FotoTroca s={x} />}
            </li>
          ))}
        </ul>
      )}
      {pedindo && (
        <PedirTroca
          aoFechar={() => setPedindo(false)}
          aoSalvar={async () => {
            setPedindo(false)
            await carregar()
            avisar('Pedido enviado para a gerência e o administrativo')
          }}
        />
      )}
    </div>
  )
}

function PedirTroca({ aoFechar, aoSalvar }: { aoFechar: () => void; aoSalvar: () => void }) {
  const { eu, store } = useApp()
  const [itens, setItens] = useState<string[]>([])
  const [motivo, setMotivo] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itens.length) return setErro('Marque o que precisa trocar.')
    if (!motivo.trim()) return setErro('Conte o motivo (ex.: sapato gasto, camiseta rasgada).')
    setEnviando(true)
    try {
      await store.pedirTrocaUniforme({ funcionarioId: eu.id, itens, motivo, foto: foto ?? undefined })
      aoSalvar()
    } catch (err) {
      setErro((err as Error).message)
      setEnviando(false)
    }
  }
  return (
    <Modal titulo="Pedir troca de uniforme" aberto aoFechar={aoFechar}>
      <form onSubmit={enviar} className="space-y-4">
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-stone-700">O que precisa trocar?</legend>
          <div className="flex flex-wrap gap-2">
            {ITENS_TROCA.map((i) => {
              const marcado = itens.includes(i)
              return (
                <label key={i} className={`cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${marcado ? 'bg-carvao text-white ring-carvao' : 'ring-stone-300'}`}>
                  <input type="checkbox" className="sr-only" checked={marcado} onChange={() => setItens(marcado ? itens.filter((x) => x !== i) : [...itens, i])} />
                  {i}
                </label>
              )
            })}
          </div>
        </fieldset>
        <Campo rotulo="Por quê?">
          <textarea className={estiloEntrada} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: meu sapato está gasto, a sola descolou." />
        </Campo>
        <Campo rotulo="Foto (opcional)" dica="Uma foto mostrando o estado ajuda a gestão a decidir rápido.">
          <input type="file" accept="image/*" capture="environment" className="block w-full text-sm" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
        </Campo>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar pedido'}</Botao>
      </form>
    </Modal>
  )
}
