import { useCallback, useEffect, useState } from 'react'
import Assinatura from '../components/Assinatura'
import { Botao, Campo, Cartao, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { dataLonga, hoje } from '../lib/datas'
import { podeGerenciar } from '../lib/permissoes'
import { ITENS_UNIFORME, TAMANHOS, termoUniforme, type EntregaUniforme, type Funcionario, type ItemUniforme } from '../lib/types'

const resumoItens = (itens: ItemUniforme[]) => itens.map((i) => `${i.quantidade}x ${i.item}${i.tamanho ? ` ${i.tamanho}` : ''}`).join(' · ')

export default function Uniformes({ pessoa }: { pessoa: Funcionario }) {
  const { eu, store, nomeDe, avisar } = useApp()
  const [entregas, setEntregas] = useState<EntregaUniforme[]>([])
  const [modal, setModal] = useState<{ tipo: 'nova' } | { tipo: 'assinar' | 'ver'; e: EntregaUniforme } | null>(null)
  const gestao = podeGerenciar(eu.nivel)
  const souEu = pessoa.id === eu.id

  const carregar = useCallback(async () => setEntregas(await store.uniformes(pessoa.id)), [store, pessoa.id])
  useEffect(() => {
    carregar()
  }, [carregar])

  return (
    <section className="space-y-2">
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
  const [itens, setItens] = useState<ItemUniforme[]>([{ item: ITENS_UNIFORME[0], tamanho: 'M', quantidade: 1 }])
  const [observacao, setObservacao] = useState('')
  const [etapa, setEtapa] = useState<'itens' | 'assinar'>('itens')
  const [assinatura, setAssinatura] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  const mudar = (i: number, p: Partial<ItemUniforme>) => setItens(itens.map((x, k) => (k === i ? { ...x, ...p } : x)))
  const salvar = async (comAssinatura: boolean) => {
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
              <div key={i} className="grid grid-cols-[1fr_5rem_4rem_auto] items-center gap-2">
                <select className={estiloEntrada} value={x.item} onChange={(e) => mudar(i, { item: e.target.value })} aria-label="Item">
                  {ITENS_UNIFORME.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
                <select className={estiloEntrada} value={x.tamanho ?? ''} onChange={(e) => mudar(i, { tamanho: e.target.value || undefined })} aria-label="Tamanho">
                  <option value="">—</option>
                  {TAMANHOS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <input className={estiloEntrada} type="number" min={1} value={x.quantidade} onChange={(e) => mudar(i, { quantidade: Math.max(1, Number(e.target.value)) })} aria-label="Quantidade" />
                <button type="button" onClick={() => setItens(itens.filter((_, k) => k !== i))} disabled={itens.length === 1} className="px-1 text-lg text-stone-400 disabled:opacity-30" aria-label="Remover item">
                  ×
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setItens([...itens, { item: ITENS_UNIFORME[2], quantidade: 1 }])} className="text-sm font-semibold underline decoration-ozzy-500 decoration-2 underline-offset-4">
              + Adicionar item
            </button>
          </div>
          <Campo rotulo="Observação (opcional)">
            <input className={estiloEntrada} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: troca do dólmã gasto" />
          </Campo>
          <div className="grid gap-2 sm:grid-cols-2">
            <Botao onClick={() => setEtapa('assinar')}>Assinar agora</Botao>
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
        <p className="rounded-xl bg-stone-50 p-3 text-sm leading-relaxed text-stone-700">{termoUniforme(pessoa.nome, entrega.data, entrega.itens)}</p>
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
