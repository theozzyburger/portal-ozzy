import { useCallback, useEffect, useMemo, useState } from 'react'
import { Botao, Campo, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, hoje, inicioDaSemana } from '../lib/datas'
import { soDigitos } from '../lib/store'
import { apelidoUnidade, nomeCurto, type ExtraMotoboy, type Motoboy, type SemanaMotoboy } from '../lib/types'
import { reais } from './Fichas'
import ArquivoBanco from '../components/ArquivoBanco'

// Motoboys (Heitor, 09/10): não são da equipe, mas têm cadastro (nome, Pix). Todo domingo a gestão lança a semana
// de cada loja (diárias, entregas com taxas, extras); vira conta a pagar na segunda e entra na conciliação.

type Aba = 'semana' | 'cadastro'
interface Linha { motoboyId: string; diarias: string; entregas: string; extras: { descricao: string; valor: string }[]; jaPago: boolean }

const num = (s: string) => {
  const t = s.trim().replace(/\s/g, '')
  if (!t) return 0
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
  return Number.isFinite(n) ? n : NaN
}
const texto = (n: number) => (n ? String(n).replace('.', ',') : '')
const totalLinha = (l: Linha) => num(l.diarias) + num(l.entregas) + l.extras.reduce((t, e) => t + num(e.valor), 0)
// Segunda do pagamento: amanhã se hoje é domingo, hoje se é segunda, senão a próxima.
const proximaSegunda = () => (inicioDaSemana(hoje()) === hoje() ? hoje() : addDias(inicioDaSemana(hoje()), 7))

export default function Motoboys() {
  const { store, unidades, avisar } = useApp()
  const [aba, setAba] = useState<Aba>('semana')
  const [pagamento, setPagamento] = useState(proximaSegunda)
  const lojas = useMemo(() => unidades.filter((u) => u.id !== 'central' && u.id !== 'eventos'), [unidades])
  const [loja, setLoja] = useState('')
  const [motoboys, setMotoboys] = useState<Motoboy[] | null>(null)
  const [semanas, setSemanas] = useState<SemanaMotoboy[]>([])
  const [editando, setEditando] = useState<Motoboy | 'novo' | null>(null)

  const carregar = useCallback(async () => {
    const [m, s] = await Promise.all([store.motoboys(), store.semanasMotoboys(addDias(pagamento, -84), pagamento)])
    setMotoboys(m)
    setSemanas(s)
  }, [store, pagamento])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { if (!loja && lojas.length) setLoja(lojas[0].id) }, [loja, lojas])

  if (!motoboys) return <p className="text-stone-400">Carregando…</p>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Motoboys</h1>
          <p className="text-sm text-stone-500">Lance a semana no domingo: vira conta a pagar na segunda e já entra na conciliação.</p>
        </div>
        {aba === 'cadastro' && <Botao onClick={() => setEditando('novo')}>+ Novo motoboy</Botao>}
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-200 p-1 text-sm font-semibold">
        {([['semana', 'Semana'], ['cadastro', 'Cadastro']] as const).map(([a, nome]) => (
          <button key={a} onClick={() => setAba(a)} className={`rounded-lg py-2 ${aba === a ? 'bg-white shadow-sm' : 'text-stone-600'}`}>{nome}</button>
        ))}
      </div>

      {aba === 'semana' && (
        <>
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-white p-2 ring-1 ring-stone-200">
            <button onClick={() => setPagamento(addDias(pagamento, -7))} className="rounded-xl px-3 py-2 text-lg hover:bg-stone-100" aria-label="Semana anterior">‹</button>
            <div className="text-center">
              <div className="font-semibold">Pagamento na segunda, {dataCurta(pagamento)}</div>
              <div className="text-xs text-stone-500">Semana de {dataCurta(addDias(pagamento, -7))} a {dataCurta(addDias(pagamento, -1))}</div>
            </div>
            <button onClick={() => setPagamento(addDias(pagamento, 7))} className="rounded-xl px-3 py-2 text-lg hover:bg-stone-100" aria-label="Próxima semana">›</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {lojas.map((u) => {
              const n = semanas.filter((s) => s.pagamento === pagamento && s.unidadeId === u.id)
              return (
                <button key={u.id} onClick={() => setLoja(u.id)}
                  className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${loja === u.id ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>
                  {apelidoUnidade(u.nome)}{n.length ? ` · ${reais(n.reduce((t, s) => t + s.total, 0))}` : ''}
                </button>
              )
            })}
          </div>
          {loja && (
            <SemanaLoja
              key={pagamento + loja}
              pagamento={pagamento}
              loja={loja}
              motoboys={motoboys}
              semanas={semanas}
              novo={() => setEditando('novo')}
              aoSalvar={async () => { await carregar(); avisar('Semana salva. As contas entram no contas a pagar com vencimento na segunda.') }}
            />
          )}
        </>
      )}

      {aba === 'cadastro' && <Cadastro motoboys={motoboys} semanas={semanas} editar={setEditando} />}

      {editando && (
        <FormMotoboy
          existente={editando === 'novo' ? undefined : editando}
          lojaPadrao={loja}
          aoFechar={() => setEditando(null)}
          aoSalvar={async () => { setEditando(null); await carregar(); avisar('Cadastro salvo') }}
        />
      )}
    </div>
  )
}

function SemanaLoja({ pagamento, loja, motoboys, semanas, novo, aoSalvar }: {
  pagamento: string; loja: string; motoboys: Motoboy[]; semanas: SemanaMotoboy[]; novo: () => void; aoSalvar: () => Promise<void>
}) {
  const { store, nomeUnidade, avisar } = useApp()
  const desta = semanas.filter((s) => s.pagamento === pagamento && s.unidadeId === loja)
  const porId = new Map(motoboys.map((m) => [m.id, m]))
  const inicial = (): Linha[] => {
    const ids = [...new Set([...desta.map((s) => s.motoboyId), ...motoboys.filter((m) => m.ativo && m.unidadeId === loja).map((m) => m.id)])]
    return ids.map((id) => {
      const s = desta.find((x) => x.motoboyId === id)
      return {
        motoboyId: id, diarias: texto(s?.diarias ?? 0), entregas: texto(s?.entregas ?? 0),
        extras: (s?.extras ?? []).map((e) => ({ descricao: e.descricao, valor: texto(e.valor) })), jaPago: !!s?.pagoEm,
      }
    }).sort((a, b) => (porId.get(a.motoboyId)?.nome ?? '').localeCompare(porId.get(b.motoboyId)?.nome ?? ''))
  }
  const [linhas, setLinhas] = useState<Linha[]>(inicial)
  const [mexeu, setMexeu] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [pix, setPix] = useState(false)
  // Motoboy novo cadastrado com a tela aberta: entra na lista.
  useEffect(() => {
    setLinhas((ls) => {
      const novos = motoboys.filter((m) => m.ativo && m.unidadeId === loja && !ls.some((l) => l.motoboyId === m.id))
      return novos.length ? [...ls, ...novos.map((m) => ({ motoboyId: m.id, diarias: '', entregas: '', extras: [], jaPago: false }))] : ls
    })
  }, [motoboys, loja])

  const fechada = (id: string) => desta.find((s) => s.motoboyId === id)?.conciliado ?? false
  const mudar = (i: number, l: Partial<Linha>) => { setMexeu(true); setLinhas(linhas.map((x, j) => (j === i ? { ...x, ...l } : x))) }
  const outros = motoboys.filter((m) => m.ativo && !linhas.some((l) => l.motoboyId === m.id))
  const total = linhas.reduce((t, l) => t + (Number.isFinite(totalLinha(l)) ? totalLinha(l) : 0), 0)

  async function salvar() {
    setErro('')
    const ruim = linhas.find((l) => !Number.isFinite(totalLinha(l)))
    if (ruim) return setErro(`Confira os valores de ${porId.get(ruim.motoboyId)?.nome}.`)
    const semDescricao = linhas.find((l) => l.extras.some((e) => num(e.valor) && !e.descricao.trim()))
    if (semDescricao) return setErro(`Diga o que é o extra de ${porId.get(semDescricao.motoboyId)?.nome} (ex.: adiantamento, supervisão).`)
    setSalvando(true)
    try {
      await store.salvarSemanaMotoboys(pagamento, loja, linhas.filter((l) => !fechada(l.motoboyId)).map((l) => ({
        motoboyId: l.motoboyId, diarias: num(l.diarias), entregas: num(l.entregas), jaPago: l.jaPago,
        extras: l.extras.map((e): ExtraMotoboy => ({ descricao: e.descricao.trim(), valor: num(e.valor) })).filter((e) => e.valor),
      })))
      setMexeu(false)
      await aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  const comValor = linhas.filter((l) => totalLinha(l) > 0)
  const relatorio = [
    `*Motoboys ${apelidoUnidade(nomeUnidade(loja))}* · pagamento ${dataCurta(pagamento)}`,
    ...comValor.map((l) => {
      const m = porId.get(l.motoboyId)
      const extras = l.extras.filter((e) => num(e.valor)).map((e) => ` + ${e.descricao} ${reais(num(e.valor))}`).join('')
      const partes = num(l.diarias) || num(l.entregas) ? `diárias ${reais(num(l.diarias))} + entregas ${reais(num(l.entregas))}${extras}` : extras.slice(3)
      return `${m?.nome}: *${reais(totalLinha(l))}* (${partes}) · Pix ${l.jaPago ? 'PAGO' : m?.pix ?? 'sem chave'}`
    }),
    `Total: *${reais(total)}*`,
  ].join('\n')
  const aPagar = comValor.filter((l) => !l.jaPago && !fechada(l.motoboyId)).map((l) => {
    const m = porId.get(l.motoboyId)!
    return { nome: m.nome, cpf: m.cpf ?? '', chavePix: m.pix ?? '', valor: Math.round(totalLinha(l) * 100) / 100, seuNumero: `MOTO ${pagamento}` }
  })

  return (
    <div className="space-y-3">
      {linhas.length === 0 ? (
        <Vazio>Nenhum motoboy desta loja. <button className="font-semibold underline" onClick={novo}>Cadastrar</button></Vazio>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
          <div className="hidden grid-cols-[1fr_7rem_7rem_6rem] gap-2 px-3 py-2 text-xs font-semibold text-stone-500 sm:grid">
            <span>Nome</span><span>Diárias</span><span>Entregas com taxas</span><span className="text-right">Total</span>
          </div>
          {linhas.map((l, i) => {
            const m = porId.get(l.motoboyId)
            const t = totalLinha(l)
            const travada = fechada(l.motoboyId)
            const salva = desta.find((s) => s.motoboyId === l.motoboyId)
            return (
              <div key={l.motoboyId} className="space-y-2 px-3 py-2.5">
                <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_7rem_7rem_6rem]">
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <div className="truncate text-sm font-semibold">{m?.nome ?? 'Motoboy'}</div>
                    <div className="truncate text-xs text-stone-500">
                      Pix {m?.pix ?? 'sem chave'}{m?.unidadeId && m.unidadeId !== loja ? ` · de ${apelidoUnidade(nomeUnidade(m.unidadeId))}` : ''}
                    </div>
                  </div>
                  <input className={estiloEntrada + ' py-1.5!'} inputMode="decimal" placeholder="Diárias" aria-label={`Diárias de ${m?.nome}`} disabled={travada}
                    value={l.diarias} onChange={(e) => mudar(i, { diarias: e.target.value })} />
                  <input className={estiloEntrada + ' py-1.5!'} inputMode="decimal" placeholder="Entregas" aria-label={`Entregas de ${m?.nome}`} disabled={travada}
                    value={l.entregas} onChange={(e) => mudar(i, { entregas: e.target.value })} />
                  <div className={`col-span-2 text-right text-sm font-bold sm:col-span-1 ${Number.isFinite(t) ? '' : 'text-red-700'}`}>{Number.isFinite(t) ? reais(t) : 'confira'}</div>
                </div>
                {l.extras.map((e, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <input className={estiloEntrada + ' py-1.5! min-w-0 flex-1'} placeholder="Extra (adiantamento, supervisão…)" disabled={travada} value={e.descricao}
                      onChange={(ev) => mudar(i, { extras: l.extras.map((x, j) => (j === k ? { ...x, descricao: ev.target.value } : x)) })} />
                    <input className={estiloEntrada + ' py-1.5! w-28! shrink-0'} inputMode="decimal" placeholder="Valor" disabled={travada} value={e.valor}
                      onChange={(ev) => mudar(i, { extras: l.extras.map((x, j) => (j === k ? { ...x, valor: ev.target.value } : x)) })} />
                    {!travada && <button className="px-1 text-stone-400 hover:text-red-700" aria-label="Tirar extra" onClick={() => mudar(i, { extras: l.extras.filter((_, j) => j !== k) })}>✕</button>}
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {travada ? <Selo cor="verde">Conciliado no banco</Selo> : (
                    <>
                      <button className="font-semibold text-stone-600 underline" onClick={() => mudar(i, { extras: [...l.extras, { descricao: '', valor: '' }] })}>+ Extra</button>
                      <label className="flex items-center gap-1.5 text-stone-600">
                        <input type="checkbox" checked={l.jaPago} onChange={(e) => mudar(i, { jaPago: e.target.checked })} /> Já pago
                      </label>
                    </>
                  )}
                  {salva && !travada && <span className="text-stone-400">Salvo{salva.pagoEm ? ' · pago' : ''}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {outros.length > 0 && (
          <select className={estiloEntrada + ' w-auto! py-1.5!'} value="" aria-label="Pôr motoboy de outra loja"
            onChange={(e) => { if (e.target.value) { setMexeu(true); setLinhas([...linhas, { motoboyId: e.target.value, diarias: '', entregas: '', extras: [], jaPago: false }]) } }}>
            <option value="">+ Motoboy de outra loja</option>
            {outros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        )}
        <button className="text-sm font-semibold underline" onClick={novo}>+ Cadastrar motoboy</button>
      </div>

      <div className="sticky bottom-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-stone-300">
        <div className="text-sm">Total da loja <b className="text-base">{reais(total)}</b>{mexeu ? <span className="ml-2 font-semibold text-amber-700">não salvo</span> : null}</div>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" className="py-1.5!" disabled={!comValor.length}
            onClick={() => navigator.clipboard.writeText(relatorio).then(() => avisar('Copiado para colar no WhatsApp'))}>Copiar</Botao>
          <Botao variante="secundario" className="py-1.5!" disabled={!aPagar.length || mexeu} onClick={() => setPix(true)}>Pix em lote</Botao>
          <Botao className="py-1.5!" disabled={salvando || !linhas.length} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar semana'}</Botao>
        </div>
      </div>
      {erro && <p className="text-sm text-red-700">{erro}</p>}
      <p className="text-xs text-stone-500">
        Cada motoboy vira uma conta a pagar (conta 3.1 Motoboys, loja {apelidoUnidade(nomeUnidade(loja))}) vencendo na segunda. Na conciliação, o Pix de cada um acha a conta dele,
        e o Pix em lote acha a semana inteira. Valor zerado tira a pessoa da semana. Extra negativo é desconto.
      </p>
      {pix && (
        <ArquivoBanco tipo="freelancer" referencia={`moto:${pagamento}:${loja}`} dataPagamento={pagamento} historico="MOTOBOYS" pagamentos={aPagar} aoFechar={() => setPix(false)} />
      )}
    </div>
  )
}

function Cadastro({ motoboys, semanas, editar }: { motoboys: Motoboy[]; semanas: SemanaMotoboy[]; editar: (m: Motoboy) => void }) {
  const { nomeUnidade } = useApp()
  const [busca, setBusca] = useState('')
  if (!motoboys.length) return <Vazio>Nenhum motoboy cadastrado ainda.</Vazio>
  const termo = busca.trim().toLowerCase()
  const lista = motoboys.filter((m) => !termo || m.nome.toLowerCase().includes(termo) || (m.pix ?? '').toLowerCase().includes(termo))
  return (
    <div className="space-y-2">
      <input className={estiloEntrada} type="search" placeholder="Buscar por nome ou Pix" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
        {lista.map((m) => {
          const ult = semanas.filter((s) => s.motoboyId === m.id).sort((a, b) => b.pagamento.localeCompare(a.pagamento))
          return (
            <button key={m.id} onClick={() => editar(m)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-stone-50">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{m.nome}</div>
                <div className="truncate text-xs text-stone-500">
                  {m.unidadeId ? apelidoUnidade(nomeUnidade(m.unidadeId)) + ' · ' : ''}Pix {m.pix ?? 'sem chave'}
                  {ult.length ? ` · últimas ${ult.length} semanas: ${reais(ult.reduce((t, s) => t + s.total, 0))}` : ''}
                </div>
              </div>
              {!m.ativo && <Selo>Inativo</Selo>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FormMotoboy({ existente, lojaPadrao, aoFechar, aoSalvar }: { existente?: Motoboy; lojaPadrao: string; aoFechar: () => void; aoSalvar: () => void }) {
  const { store, unidades } = useApp()
  const [f, setF] = useState({
    nome: existente?.nome ?? '', unidadeId: existente?.unidadeId ?? lojaPadrao, pix: existente?.pix ?? '', telefone: existente?.telefone ?? '',
    cpf: existente?.cpf ?? '', observacao: existente?.observacao ?? '', ativo: existente?.ativo ?? true,
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!f.nome.trim()) return setErro('Diga o nome.')
    if (f.cpf && soDigitos(f.cpf).length !== 11) return setErro('CPF com 11 números (ou deixe em branco).')
    setErro('')
    setSalvando(true)
    try {
      await store.salvarMotoboy({ ...f, id: existente?.id, unidadeId: f.unidadeId || null, pix: f.pix || null, telefone: f.telefone || null, cpf: f.cpf || null, observacao: f.observacao || null })
      aoSalvar()
    } catch (err) {
      setErro((err as Error).message)
      setSalvando(false)
    }
  }
  return (
    <Modal titulo={existente ? `Editar ${nomeCurto(existente.nome)}` : 'Novo motoboy'} aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-3">
        <Campo rotulo="Nome"><input className={estiloEntrada} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoFocus /></Campo>
        <Campo rotulo="Loja onde roda">
          <select className={estiloEntrada} value={f.unidadeId} onChange={(e) => setF({ ...f, unidadeId: e.target.value })}>
            <option value="">Escolher</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Chave Pix" dica="Celular, CPF, e-mail ou chave aleatória."><input className={estiloEntrada} value={f.pix} onChange={(e) => setF({ ...f, pix: e.target.value })} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Celular (opcional)"><input className={estiloEntrada} inputMode="tel" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></Campo>
          <Campo rotulo="CPF (opcional)" dica="Precisa para o Pix em lote."><input className={estiloEntrada} inputMode="numeric" value={f.cpf} onChange={(e) => setF({ ...f, cpf: e.target.value })} /></Campo>
        </div>
        <Campo rotulo="Observação (opcional)"><input className={estiloEntrada} value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} /></Campo>
        {existente && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> Ativo (aparece na semana da loja)
          </label>
        )}
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <Botao className="w-full" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
      </form>
    </Modal>
  )
}
