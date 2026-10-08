import { useCallback, useEffect, useState } from 'react'
import { Botao, Campo, Cartao, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, diaSemana, hoje } from '../lib/datas'
import { isentoDeRotinas, podeGerenciar } from '../lib/permissoes'
import { TIPOS_AJUSTE_PONTO, type AjustePonto, type TipoAjustePonto } from '../lib/types'

const nomeTipo = (t: TipoAjustePonto) => TIPOS_AJUSTE_PONTO.find((x) => x.valor === t)?.nome ?? t
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// Ajuste do ponto (reunião de RH de 08/10): a pessoa pede aqui em vez do WhatsApp do escritório; o escritório
// corrige no Control iD e marca como feito. O espelho de ponto vem depois, com a API do Control iD.
export default function Ponto() {
  const { eu, store, nomeDe, avisar } = useApp()
  const gestao = podeGerenciar(eu.nivel)
  const [visao, setVisao] = useState<'pendente' | 'todos'>('pendente')
  const [ajustes, setAjustes] = useState<AjustePonto[]>([])
  const [meus, setMeus] = useState<AjustePonto[]>([])
  const [pedir, setPedir] = useState(false)

  const carregar = useCallback(async () => {
    if (gestao) setAjustes(await store.ajustesPonto(visao))
    if (!isentoDeRotinas(eu.nivel)) setMeus(await store.ajustesPonto('meus'))
  }, [store, gestao, visao, eu.nivel])
  useEffect(() => {
    carregar()
  }, [carregar])

  const resolver = async (a: AjustePonto, status: 'feito' | 'recusado') => {
    let resposta = ''
    if (status === 'recusado') {
      const r = prompt('Por que não vai ajustar? A pessoa vê esta resposta.')
      if (r === null) return
      resposta = r
    }
    await store.resolverAjustePonto(a.id, status, resposta)
    await carregar()
    avisar(status === 'feito' ? 'Marcado como ajustado' : 'Pedido recusado')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Ponto</h1>
          <p className="text-sm text-stone-500">
            Esqueceu de bater, saiu horário errado ou o relógio falhou? Peça o ajuste aqui. O escritório corrige no Control iD.
          </p>
        </div>
        {!isentoDeRotinas(eu.nivel) && <Botao onClick={() => setPedir(true)}>Pedir ajuste no ponto</Botao>}
      </div>

      {gestao && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold">Pedidos da equipe</h2>
            <div className="flex rounded-xl bg-stone-200 p-1 text-sm font-semibold">
              {(['pendente', 'todos'] as const).map((v) => (
                <button key={v} onClick={() => setVisao(v)} className={`rounded-lg px-3 py-1.5 ${visao === v ? 'bg-white shadow-sm' : 'text-stone-600'}`}>
                  {v === 'pendente' ? 'Para ajustar' : 'Todos'}
                </button>
              ))}
            </div>
          </div>
          {ajustes.length === 0 ? (
            <Vazio>{visao === 'pendente' ? 'Nenhum ajuste esperando.' : 'Nenhum pedido ainda.'}</Vazio>
          ) : (
            ajustes.map((a) => (
              <Cartao key={a.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{nomeDe(a.funcionarioId)}</div>
                    <LinhaAjuste a={a} />
                    <div className="mt-1 text-xs text-stone-500">
                      Pedido em {quando(a.criadoEm)}
                      {a.resolvidoPor && ` · ${a.status === 'feito' ? 'ajustado' : 'recusado'} por ${nomeDe(a.resolvidoPor)} em ${quando(a.resolvidoEm!)}`}
                    </div>
                  </div>
                  {a.status === 'pendente' ? (
                    <div className="flex gap-2">
                      <Botao variante="secundario" onClick={() => resolver(a, 'recusado')}>Recusar</Botao>
                      <Botao onClick={() => resolver(a, 'feito')}>Ajustei no Control iD</Botao>
                    </div>
                  ) : (
                    <SeloStatus a={a} />
                  )}
                </div>
              </Cartao>
            ))
          )}
        </section>
      )}

      {!isentoDeRotinas(eu.nivel) && (
        <section className="space-y-2">
          <h2 className="font-bold">Meus pedidos</h2>
          {meus.length === 0 ? (
            <Vazio>Você ainda não pediu nenhum ajuste.</Vazio>
          ) : (
            meus.map((a) => (
              <Cartao key={a.id}>
                <div className="flex items-start justify-between gap-3">
                  <LinhaAjuste a={a} />
                  <div className="flex flex-col items-end gap-1">
                    <SeloStatus a={a} />
                    {a.status === 'pendente' && (
                      <button
                        className="text-xs font-semibold text-stone-500 underline"
                        onClick={async () => {
                          await store.excluirAjustePonto(a.id)
                          await carregar()
                          avisar('Pedido cancelado')
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </Cartao>
            ))
          )}
        </section>
      )}

      <p className="rounded-2xl bg-stone-100 p-4 text-sm text-stone-600">
        Em breve: o espelho de ponto de cada pessoa, vindo do Control iD, com atrasos e faltas cruzados com os atestados.
      </p>

      {pedir && (
        <PedirAjuste
          aoFechar={() => setPedir(false)}
          aoSalvar={async () => {
            setPedir(false)
            await carregar()
            avisar('Pedido enviado para o escritório')
          }}
        />
      )}
    </div>
  )
}

function LinhaAjuste({ a }: { a: AjustePonto }) {
  return (
    <div className="min-w-0 text-sm">
      <div>
        <b>{diaSemana(a.data)} {dataCurta(a.data)}</b> · {nomeTipo(a.tipo)}
        {a.horario && <> · horário certo <b>{a.horario}</b></>}
      </div>
      {a.motivo && <div className="text-stone-600">{a.motivo}</div>}
      {a.status === 'recusado' && a.resposta && <div className="text-red-700">Resposta: {a.resposta}</div>}
    </div>
  )
}

function SeloStatus({ a }: { a: AjustePonto }) {
  return a.status === 'feito' ? <Selo cor="verde">Ajustado</Selo> : a.status === 'recusado' ? <Selo cor="vermelho">Recusado</Selo> : <Selo cor="ambar">Esperando</Selo>
}

function PedirAjuste({ aoFechar, aoSalvar }: { aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const [data, setData] = useState(hoje())
  const [tipo, setTipo] = useState<TipoAjustePonto>('esqueci_saida')
  const [horario, setHorario] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (tipo === 'outro' && !motivo.trim()) return setErro('Conte o que aconteceu.')
    setErro('')
    setEnviando(true)
    try {
      await store.pedirAjustePonto({ data, tipo, horario: horario || null, motivo })
      aoSalvar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Pedir ajuste no ponto" aberto aoFechar={aoFechar}>
      <form onSubmit={enviar} className="space-y-4">
        <Campo rotulo="O que aconteceu?">
          <select className={estiloEntrada} value={tipo} onChange={(e) => setTipo(e.target.value as TipoAjustePonto)}>
            {TIPOS_AJUSTE_PONTO.map((t) => <option key={t.valor} value={t.valor}>{t.nome}</option>)}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Dia">
            <input className={estiloEntrada} type="date" value={data} max={hoje()} min={addDias(hoje(), -45)} onChange={(e) => setData(e.target.value)} required />
          </Campo>
          <Campo rotulo="Horário certo">
            <input className={estiloEntrada} type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
          </Campo>
        </div>
        <Campo rotulo="Explique (opcional)">
          <textarea className={estiloEntrada} rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
        <p className="text-xs text-stone-500">Atraso não é ajuste de ponto: justifique o atraso com a gerente.</p>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar para o escritório'}</Botao>
      </form>
    </Modal>
  )
}
