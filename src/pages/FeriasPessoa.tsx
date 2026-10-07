import { useCallback, useEffect, useState } from 'react'
import { Botao, Campo, Cartao, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { addDias, hoje } from '../lib/datas'
import { COR_SITUACAO, TEXTO_SITUACAO, periodosFerias, type PeriodoFerias } from '../lib/ferias'
import type { DecimoTerceiro, Ferias, Funcionario } from '../lib/types'
import { reais } from './Fichas'

const br = (d: string) => d.split('-').reverse().join('/')

// Férias por período aquisitivo e parcelas do 13º. Só a gestão vê; registra quem pode alterar a pessoa.
export default function FeriasPessoa({ pessoa, podeRegistrar }: { pessoa: Funcionario; podeRegistrar: boolean }) {
  const { store, avisar } = useApp()
  const [ferias, setFerias] = useState<Ferias[] | null>(null)
  const [decimo, setDecimo] = useState<DecimoTerceiro[]>([])
  const [modal, setModal] = useState<'ferias' | '13' | null>(null)

  const carregar = useCallback(async () => {
    const [f, d] = await Promise.all([store.ferias(pessoa.id), store.decimoTerceiro(pessoa.id)])
    setFerias(f)
    setDecimo(d)
  }, [store, pessoa.id])
  useEffect(() => {
    carregar()
  }, [carregar])

  if (!ferias) return <p className="text-stone-400">Carregando…</p>
  const periodos = periodosFerias(pessoa.dataAdmissao, ferias, hoje())
  const comSaldo = periodos.filter((p) => p.saldo > 0 && p.situacao !== 'em_aquisicao')

  const excluir = async (oque: 'ferias' | '13', id: string) => {
    if (oque === 'ferias') await store.excluirFerias(id)
    else await store.excluirDecimoTerceiro(id)
    await carregar()
    avisar('Registro apagado')
  }

  return (
    <section className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">Férias</h3>
          {podeRegistrar && comSaldo.length > 0 && (
            <Botao variante="secundario" onClick={() => setModal('ferias')}>+ Registrar férias</Botao>
          )}
        </div>
        {periodos.length === 0 ? (
          <Vazio>A admissão é futura; ainda não há período aquisitivo.</Vazio>
        ) : (
          periodos.map((p) => <CartaoPeriodo key={p.inicio} p={p} aoExcluir={podeRegistrar ? (id) => excluir('ferias', id) : undefined} />)
        )}
        <p className="text-xs text-stone-500">
          Cada 12 meses de trabalho dão 30 dias de férias, que precisam ser tiradas nos 12 meses seguintes. Os períodos contam a partir da admissão ({br(pessoa.dataAdmissao)}).
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">13º salário</h3>
          {podeRegistrar && <Botao variante="secundario" onClick={() => setModal('13')}>+ Registrar parcela</Botao>}
        </div>
        {decimo.length === 0 ? (
          <Vazio>Nenhuma parcela registrada.</Vazio>
        ) : (
          decimo.map((d) => (
            <Cartao key={d.id}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{d.parcela}ª parcela de {d.ano}</div>
                  <div className="text-sm text-stone-500">Paga em {br(d.pagoEm)}{d.observacao ? ` · ${d.observacao}` : ''}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold tabular-nums">{reais(d.valor)}</div>
                  {podeRegistrar && <button onClick={() => excluir('13', d.id)} className="text-xs text-stone-400 hover:text-red-700">apagar</button>}
                </div>
              </div>
            </Cartao>
          ))
        )}
      </div>

      {modal === 'ferias' && (
        <FormFerias
          pessoa={pessoa}
          periodos={comSaldo}
          aoFechar={() => setModal(null)}
          aoSalvar={async () => {
            setModal(null)
            await carregar()
            avisar('Férias registradas')
          }}
        />
      )}
      {modal === '13' && (
        <Form13
          pessoa={pessoa}
          jaPagas={decimo}
          aoFechar={() => setModal(null)}
          aoSalvar={async () => {
            setModal(null)
            await carregar()
            avisar('Parcela registrada')
          }}
        />
      )}
    </section>
  )
}

function CartaoPeriodo({ p, aoExcluir }: { p: PeriodoFerias; aoExcluir?: (id: string) => void }) {
  return (
    <Cartao>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-stone-500">Período aquisitivo</div>
          <div className="font-semibold">{br(p.inicio)} a {br(p.fim)}</div>
        </div>
        <Selo cor={COR_SITUACAO[p.situacao]}>{TEXTO_SITUACAO[p.situacao]}</Selo>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-stone-500">Tirar até</dt>
          <dd className="font-medium">{br(p.concessivoFim)}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Saldo</dt>
          <dd className="font-medium">{p.saldo} de 30 dias</dd>
        </div>
      </dl>
      {p.saldo > 0 && (p.situacao === 'em_dia' || p.situacao === 'vence_logo') && (
        <p className="mt-1 text-xs text-stone-500">Para tirar os {p.saldo} dias dentro do prazo, começar até {br(p.comecarAte)}.</p>
      )}
      {p.situacao === 'vencida' && <p className="mt-1 text-xs font-medium text-red-700">Passou do prazo: férias vencidas são pagas em dobro.</p>}
      {p.gozos.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-stone-100 pt-2 text-sm">
          {p.gozos.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2">
              <span>
                Gozo de {br(g.inicio)} a {br(addDias(g.inicio, g.dias - 1))} ({g.dias} dias)
                {g.abonoDias > 0 && <span className="text-stone-500"> + {g.abonoDias} vendidos</span>}
                {g.observacao && <span className="block text-xs text-stone-500">{g.observacao}</span>}
              </span>
              {aoExcluir && <button onClick={() => aoExcluir(g.id)} className="text-xs text-stone-400 hover:text-red-700">apagar</button>}
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  )
}

function FormFerias({ pessoa, periodos, aoFechar, aoSalvar }: { pessoa: Funcionario; periodos: PeriodoFerias[]; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  // O período mais antigo com saldo vem primeiro: é o que vence antes.
  const ordem = [...periodos].sort((a, b) => a.inicio.localeCompare(b.inicio))
  const [periodo, setPeriodo] = useState(ordem[0].inicio)
  const atual = ordem.find((p) => p.inicio === periodo)!
  const [inicio, setInicio] = useState(hoje())
  const [dias, setDias] = useState(String(atual.saldo))
  const [abono, setAbono] = useState('0')
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    const d = Number(dias)
    const a = Number(abono)
    if (d < 5) return setErro('Cada período de férias tem no mínimo 5 dias.')
    if (a > 10) return setErro('Dá para vender no máximo 10 dias (um terço).')
    if (d + a > atual.saldo) return setErro(`Este período só tem ${atual.saldo} dias de saldo.`)
    try {
      await store.registrarFerias({ funcionarioId: pessoa.id, aquisitivoInicio: periodo, inicio, dias: d, abonoDias: a, observacao: obs || null })
      aoSalvar()
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  return (
    <Modal titulo={`Férias de ${pessoa.nome.split(' ')[0]}`} aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Período aquisitivo">
          <select className={estiloEntrada} value={periodo} onChange={(e) => { setPeriodo(e.target.value); setDias(String(ordem.find((p) => p.inicio === e.target.value)!.saldo)) }}>
            {ordem.map((p) => (
              <option key={p.inicio} value={p.inicio}>{br(p.inicio)} a {br(p.fim)} · saldo {p.saldo} dias</option>
            ))}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Início do gozo">
            <input className={estiloEntrada} type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
          </Campo>
          <Campo rotulo="Dias de descanso">
            <input className={estiloEntrada} type="number" min={5} max={30} value={dias} onChange={(e) => setDias(e.target.value)} required />
          </Campo>
        </div>
        <Campo rotulo="Dias vendidos (abono)" dica="Até 10 dias. Deixe 0 se não vendeu.">
          <input className={estiloEntrada} type="number" min={0} max={10} value={abono} onChange={(e) => setAbono(e.target.value)} />
        </Campo>
        {Number(dias) > 0 && <p className="text-sm text-stone-600">Volta ao trabalho em {br(addDias(inicio, Number(dias)))}.</p>}
        <Campo rotulo="Observação">
          <input className={estiloEntrada} value={obs} onChange={(e) => setObs(e.target.value)} />
        </Campo>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full">Salvar</Botao>
      </form>
    </Modal>
  )
}

function Form13({ pessoa, jaPagas, aoFechar, aoSalvar }: { pessoa: Funcionario; jaPagas: DecimoTerceiro[]; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const ano = Number(hoje().slice(0, 4))
  const [f, setF] = useState({ ano: String(ano), parcela: jaPagas.some((d) => d.ano === ano && d.parcela === 1) ? '2' : '1', valor: '', pagoEm: hoje(), obs: '' })
  const [erro, setErro] = useState('')

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await store.registrarDecimoTerceiro({
        funcionarioId: pessoa.id, ano: Number(f.ano), parcela: Number(f.parcela) as 1 | 2,
        valor: Number(f.valor.replace(/[^\d,]/g, '').replace(',', '.')) || 0, pagoEm: f.pagoEm, observacao: f.obs || null,
      })
      aoSalvar()
    } catch (err) {
      const m = (err as Error).message
      setErro(/duplicate|unique/i.test(m) ? 'Essa parcela já foi registrada.' : m)
    }
  }

  return (
    <Modal titulo={`13º de ${pessoa.nome.split(' ')[0]}`} aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Ano">
            <input className={estiloEntrada} type="number" value={f.ano} onChange={(e) => setF({ ...f, ano: e.target.value })} required />
          </Campo>
          <Campo rotulo="Parcela">
            <select className={estiloEntrada} value={f.parcela} onChange={(e) => setF({ ...f, parcela: e.target.value })}>
              <option value="1">1ª parcela (adiantamento)</option>
              <option value="2">2ª parcela</option>
            </select>
          </Campo>
          <Campo rotulo="Valor pago">
            <input className={estiloEntrada} inputMode="decimal" placeholder="0,00" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} required />
          </Campo>
          <Campo rotulo="Pago em">
            <input className={estiloEntrada} type="date" value={f.pagoEm} onChange={(e) => setF({ ...f, pagoEm: e.target.value })} required />
          </Campo>
        </div>
        <Campo rotulo="Observação">
          <input className={estiloEntrada} value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} placeholder="Ex.: adiantada junto com as férias" />
        </Campo>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full">Salvar</Botao>
      </form>
    </Modal>
  )
}
