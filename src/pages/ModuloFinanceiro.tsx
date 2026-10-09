import { useCallback, useEffect, useState } from 'react'
import { Botao, Campo, Cartao, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { addMeses, dataCurta, diaSemana, hoje, mesDe, nomeMesAno } from '../lib/datas'
import { ir } from '../lib/rota'
import {
  dividir, gruposDoPlano, lerValor, mostrarValor, nomeCentro, nomeConta, nomeForma, r2, reais, situacao, somarMeses, type SituacaoConta,
} from '../lib/financeiro'
import { FORMAS_PAGAMENTO, type CentroCusto, type ContaContabil, type ContaPagar, type FormaPagamento, type Fornecedor, type NovaContaPagar } from '../lib/types'
import Financeiro from './Financeiro'

const ABAS = [
  { id: '', nome: 'Contas a pagar' },
  { id: 'despesas', nome: 'Despesas por conta' },
  { id: 'resultado', nome: 'Resultado (Lucro Fácil)' },
  { id: 'plano', nome: 'Plano de contas' },
]

// Financeiro (09/10): contas a pagar, despesas por conta contábil e loja (base da DRE), resultado do Lucro Fácil e plano de contas.
export default function ModuloFinanceiro({ sub }: { sub?: string }) {
  const aba = ABAS.some((a) => a.id && a.id === sub) ? sub! : ''
  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => ir(a.id ? 'financeiro/' + a.id : 'financeiro')}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${aba === a.id ? 'bg-carvao text-white' : 'text-stone-600 hover:bg-stone-200'}`}
          >
            {a.nome}
          </button>
        ))}
      </div>
      {aba === 'resultado' ? <Financeiro />
        : aba === 'despesas' ? <Despesas />
        : aba === 'plano' ? <PlanoContas />
        : <ContasPagar />}
    </div>
  )
}

interface Dados { contas: ContaPagar[]; centros: CentroCusto[]; plano: ContaContabil[]; fornecedores: Fornecedor[] }
function useDados() {
  const { store } = useApp()
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const carregar = useCallback(
    () => Promise.all([store.contasPagar(), store.centrosCusto(), store.planoContas(), store.fornecedores()]).then(
      ([contas, centros, plano, fornecedores]) => setD({ contas, centros, plano, fornecedores }),
      (e) => setErro(e.message),
    ),
    [store],
  )
  useEffect(() => {
    carregar()
  }, [carregar])
  return { d, erro, carregar }
}

const favorecidoDe = (c: ContaPagar, fornecedores: Fornecedor[]) => fornecedores.find((f) => f.id === c.fornecedorId)?.nome ?? c.favorecido ?? ''

const FILTROS: { id: 'abertas' | 'vencidas' | 'semana' | 'pagas' | 'todas'; nome: string }[] = [
  { id: 'abertas', nome: 'A pagar' },
  { id: 'vencidas', nome: 'Vencidas' },
  { id: 'semana', nome: 'Próximos 7 dias' },
  { id: 'pagas', nome: 'Pagas' },
  { id: 'todas', nome: 'Todas' },
]
const COR_SITUACAO: Record<SituacaoConta, 'vermelho' | 'ambar' | 'cinza' | 'verde' | 'azul'> = { vencida: 'vermelho', hoje: 'ambar', semana: 'azul', depois: 'cinza', paga: 'verde' }

function ContasPagar() {
  const { d, erro, carregar } = useDados()
  const { store } = useApp()
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['id']>('abertas')
  const [loja, setLoja] = useState('')
  const [conta, setConta] = useState('')
  const [mes, setMes] = useState('')
  const [busca, setBusca] = useState('')
  const [editar, setEditar] = useState<ContaPagar | 'nova' | null>(null)
  const [pagar, setPagar] = useState<ContaPagar | null>(null)
  const [aviso, setAviso] = useState('')

  if (erro) return <Vazio>{erro}</Vazio>
  if (!d) return <p className="text-stone-400">Carregando…</p>

  const h = hoje()
  const abertas = d.contas.filter((c) => !c.pagoEm)
  const soma = (l: ContaPagar[]) => l.reduce((s, c) => s + c.valor, 0)
  const vencidas = abertas.filter((c) => c.vencimento < h)
  const deHoje = abertas.filter((c) => c.vencimento === h)
  const semana = abertas.filter((c) => situacao(c) === 'semana')
  const pagasMes = d.contas.filter((c) => c.pagoEm && mesDe(c.pagoEm) === mesDe(h))
  const semConta = abertas.filter((c) => !c.contaId).length

  const meses = [...new Set(d.contas.map((c) => mesDe(c.vencimento)))].sort()
  const lista = d.contas
    .filter((c) => {
      const s = situacao(c)
      if (filtro === 'abertas' && s === 'paga') return false
      if (filtro === 'vencidas' && s !== 'vencida') return false
      if (filtro === 'semana' && s !== 'semana' && s !== 'hoje') return false
      if (filtro === 'pagas' && s !== 'paga') return false
      if (loja && c.centroCustoId !== loja) return false
      if (conta === 'sem' ? c.contaId : conta && c.contaId !== conta) return false
      if (mes && mesDe(c.vencimento) !== mes) return false
      if (busca) {
        const t = `${c.descricao} ${favorecidoDe(c, d.fornecedores)} ${c.documento ?? ''}`.toLowerCase()
        if (!t.includes(busca.toLowerCase())) return false
      }
      return true
    })
    .sort((a, b) => (filtro === 'pagas' ? (b.pagoEm ?? '').localeCompare(a.pagoEm ?? '') : a.vencimento.localeCompare(b.vencimento)))

  // Agrupa por dia de vencimento (ou de pagamento, nas pagas).
  const grupos: { dia: string; itens: ContaPagar[] }[] = []
  for (const c of lista) {
    const dia = filtro === 'pagas' ? c.pagoEm! : c.vencimento
    const g = grupos[grupos.length - 1]
    if (g && g.dia === dia) g.itens.push(c)
    else grupos.push({ dia, itens: [c] })
  }
  const contasUsadas = d.plano.filter((p) => d.contas.some((c) => c.contaId === p.id))

  async function desfazer(c: ContaPagar) {
    if (!confirm('Desfazer o pagamento? A conta volta para "a pagar".')) return
    try {
      await store.pagarConta(c.id, null)
      carregar()
    } catch (e) {
      setAviso((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Contas a pagar</h1>
          <p className="text-sm text-stone-500">As notas lançadas entram aqui sozinhas. Só Proprietário e Administrativo veem esta tela.</p>
        </div>
        <Botao onClick={() => setEditar('nova')}>+ Conta a pagar</Botao>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi nome="Vencidas" valor={soma(vencidas)} n={vencidas.length} cor={vencidas.length ? 'text-red-700' : ''} aoClicar={() => setFiltro('vencidas')} />
        <Kpi nome="Vencem hoje" valor={soma(deHoje)} n={deHoje.length} cor={deHoje.length ? 'text-amber-700' : ''} aoClicar={() => setFiltro('semana')} />
        <Kpi nome="Próximos 7 dias" valor={soma(semana)} n={semana.length} aoClicar={() => setFiltro('semana')} />
        <Kpi nome={`Pagas em ${nomeMesAno(mesDe(h)).split(' ')[0]}`} valor={pagasMes.reduce((s, c) => s + (c.valorPago ?? c.valor), 0)} n={pagasMes.length} aoClicar={() => setFiltro('pagas')} />
      </div>
      {semConta > 0 && (
        <button className="text-sm font-semibold text-amber-800 underline" onClick={() => { setConta('sem'); setFiltro('abertas') }}>
          {semConta} {semConta === 1 ? 'conta está' : 'contas estão'} sem conta contábil (não entram certo na DRE)
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button key={f.id} onClick={() => setFiltro(f.id)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${filtro === f.id ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>
            {f.nome}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select className={estiloEntrada} value={loja} onChange={(e) => setLoja(e.target.value)} aria-label="Loja">
          <option value="">Todas as lojas</option>
          {d.centros.map((x) => <option key={x.id} value={x.id}>{nomeCentro(x)}</option>)}
        </select>
        <select className={estiloEntrada} value={conta} onChange={(e) => setConta(e.target.value)} aria-label="Conta contábil">
          <option value="">Todas as contas</option>
          <option value="sem">Sem conta contábil</option>
          {contasUsadas.map((x) => <option key={x.id} value={x.id}>{x.codigo} {x.nome}</option>)}
        </select>
        <select className={estiloEntrada} value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês do vencimento">
          <option value="">Qualquer mês</option>
          {meses.map((m) => <option key={m} value={m}>{nomeMesAno(m)}</option>)}
        </select>
        <input className={estiloEntrada} placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      {aviso && <p className="text-sm text-red-700">{aviso}</p>}

      {lista.length === 0 ? (
        <Vazio>{d.contas.length ? 'Nenhuma conta neste filtro.' : 'Nenhuma conta ainda. Lance uma nota fiscal ou clique em "+ Conta a pagar".'}</Vazio>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-stone-500">{lista.length} {lista.length === 1 ? 'conta' : 'contas'} · {reais(soma(lista))}</p>
          {grupos.map((g) => (
            <div key={g.dia} className="space-y-1">
              <h3 className="text-sm font-semibold text-stone-500">
                {g.dia === h ? 'Hoje' : `${diaSemana(g.dia)}, ${dataCurta(g.dia)}`}
                {filtro !== 'pagas' && g.dia < h && ' · vencida'}
                <span className="font-normal"> · {reais(soma(g.itens))}</span>
              </h3>
              {g.itens.map((c) => {
                const s = situacao(c)
                return (
                  <Cartao key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                    <button className="min-w-0 flex-1 text-left" onClick={() => setEditar(c)}>
                      <p className="font-semibold break-words">{c.descricao}{c.parcelas ? ` (${c.parcela}/${c.parcelas})` : ''}</p>
                      <p className="text-sm text-stone-500">
                        {[favorecidoDe(c, d.fornecedores), nomeCentro(d.centros.find((x) => x.id === c.centroCustoId)), nomeForma(c.forma)].filter(Boolean).join(' · ')}
                      </p>
                      <p className={`text-xs ${c.contaId ? 'text-stone-400' : 'font-semibold text-amber-700'}`}>{nomeConta(d.plano, c.contaId)}</p>
                    </button>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-semibold">{reais(c.valorPago ?? c.valor)}</p>
                        {s === 'paga' ? <Selo cor="verde">Paga {dataCurta(c.pagoEm!)}</Selo> : s !== 'depois' && <Selo cor={COR_SITUACAO[s]}>{s === 'vencida' ? 'Vencida' : s === 'hoje' ? 'Hoje' : 'Esta semana'}</Selo>}
                      </div>
                      {c.pagoEm ? (
                        <Botao variante="fantasma" className="px-2!" onClick={() => desfazer(c)}>Desfazer</Botao>
                      ) : (
                        <Botao variante="secundario" onClick={() => setPagar(c)}>Pagar</Botao>
                      )}
                    </div>
                  </Cartao>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {editar && <EditarConta d={d} conta={editar === 'nova' ? null : editar} aoFechar={() => setEditar(null)} aoSalvar={() => { setEditar(null); carregar() }} />}
      {pagar && <PagarConta conta={pagar} aoFechar={() => setPagar(null)} aoSalvar={() => { setPagar(null); carregar() }} />}
    </div>
  )
}

function Kpi({ nome, valor, n, cor = '', aoClicar }: { nome: string; valor: number; n: number; cor?: string; aoClicar: () => void }) {
  return (
    <Cartao onClick={aoClicar}>
      <p className="text-sm text-stone-500">{nome}</p>
      <p className={`text-lg font-bold ${cor}`}>{reais(valor)}</p>
      <p className="text-xs text-stone-400">{n} {n === 1 ? 'conta' : 'contas'}</p>
    </Cartao>
  )
}

function PagarConta({ conta, aoFechar, aoSalvar }: { conta: ContaPagar; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const [v, setV] = useState({ data: hoje(), valor: mostrarValor(conta.valor), forma: conta.forma })
  const [erro, setErro] = useState('')
  async function salvar() {
    const valor = lerValor(v.valor)
    if (!valor || valor <= 0) return setErro('Coloque o valor pago.')
    try {
      await store.pagarConta(conta.id, { pagoEm: v.data, valorPago: valor, forma: v.forma })
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }
  const dif = r2((lerValor(v.valor) ?? 0) - conta.valor)
  return (
    <Modal titulo="Registrar pagamento" aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <p className="text-sm">{conta.descricao} · vence {dataCurta(conta.vencimento)} · {reais(conta.valor)}</p>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Pago em"><input type="date" className={estiloEntrada} value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} /></Campo>
          <Campo rotulo="Valor pago (R$)" dica={dif > 0 ? `${reais(dif)} de juros/multa` : dif < 0 ? `${reais(-dif)} de desconto` : undefined}>
            <input inputMode="decimal" className={estiloEntrada} value={v.valor} onChange={(e) => setV({ ...v, valor: e.target.value })} />
          </Campo>
        </div>
        <Campo rotulo="Forma">
          <select className={estiloEntrada} value={v.forma} onChange={(e) => setV({ ...v, forma: e.target.value as FormaPagamento })}>
            {FORMAS_PAGAMENTO.map((f) => <option key={f.valor} value={f.valor}>{f.nome}</option>)}
          </select>
        </Campo>
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={salvar}>Marcar como paga</Botao>
        </div>
      </div>
    </Modal>
  )
}

type Repeticao = 'unica' | 'parcelada' | 'mensal'

function EditarConta({ d, conta, aoFechar, aoSalvar }: { d: Dados; conta: ContaPagar | null; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const [v, setV] = useState({
    centroCustoId: conta?.centroCustoId ?? '',
    fornecedorId: conta?.fornecedorId ?? '',
    favorecido: conta?.favorecido ?? '',
    descricao: conta?.descricao ?? '',
    contaId: conta?.contaId ?? '',
    valor: conta ? mostrarValor(conta.valor) : '',
    vencimento: conta?.vencimento ?? hoje(),
    competencia: conta ? conta.competencia.slice(0, 7) : mesDe(hoje()),
    forma: conta?.forma ?? ('boleto' as FormaPagamento),
    documento: conta?.documento ?? '',
    observacao: conta?.observacao ?? '',
    repeticao: 'unica' as Repeticao,
    vezes: '2',
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const grupos = gruposDoPlano(d.plano)
  const vezes = Math.max(2, Math.min(60, Number(v.vezes) || 2))

  // Ao escolher o fornecedor, sugere a conta contábil de sempre dele.
  function escolherFornecedor(id: string) {
    const f = d.fornecedores.find((x) => x.id === id)
    setV({ ...v, fornecedorId: id, contaId: v.contaId || f?.contaPadraoId || '' })
  }

  async function salvar() {
    const valor = lerValor(v.valor)
    if (!v.centroCustoId) return setErro('Escolha a loja (de quem é o custo).')
    if (!v.descricao.trim()) return setErro('Coloque uma descrição.')
    if (!valor || valor <= 0) return setErro('Coloque o valor.')
    if (!v.vencimento) return setErro('Coloque o vencimento.')
    const base: NovaContaPagar = {
      id: conta?.id, centroCustoId: v.centroCustoId, contaId: v.contaId || null, fornecedorId: v.fornecedorId || null,
      favorecido: v.fornecedorId ? null : v.favorecido || null, descricao: v.descricao, competencia: v.competencia + '-01', vencimento: v.vencimento,
      valor, forma: v.forma, parcela: conta?.parcela ?? null, parcelas: conta?.parcelas ?? null, documento: v.documento || null,
      notaId: conta?.notaId ?? null, observacao: v.observacao || null,
    }
    let lista: NovaContaPagar[] = [base]
    if (!conta && v.repeticao === 'parcelada') {
      lista = dividir(valor, vezes).map((x, i) => ({ ...base, valor: x, vencimento: somarMeses(v.vencimento, i), parcela: i + 1, parcelas: vezes }))
    } else if (!conta && v.repeticao === 'mensal') {
      lista = Array.from({ length: vezes }, (_, i) => ({
        ...base, vencimento: somarMeses(v.vencimento, i), competencia: addMeses(v.competencia, i) + '-01',
      }))
    }
    setSalvando(true)
    try {
      await store.salvarContasPagar(lista)
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }
  async function excluir() {
    if (!conta || !confirm('Excluir esta conta a pagar?')) return
    try {
      await store.excluirContaPagar(conta.id)
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <Modal titulo={conta ? 'Conta a pagar' : 'Nova conta a pagar'} aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        {conta?.notaId && (
          <p className="rounded-xl bg-stone-100 p-2 text-sm">
            Veio de uma nota fiscal. <button className="font-semibold underline" onClick={() => ir('estoque/nota/' + conta.notaId)}>Abrir a nota</button>
          </p>
        )}
        <Campo rotulo="Descrição"><input className={estiloEntrada} value={v.descricao} placeholder="Ex.: Aluguel de outubro" onChange={(e) => setV({ ...v, descricao: e.target.value })} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Loja">
            <select className={estiloEntrada} value={v.centroCustoId} onChange={(e) => setV({ ...v, centroCustoId: e.target.value })}>
              <option value="">Escolher</option>
              {d.centros.map((x) => <option key={x.id} value={x.id}>{nomeCentro(x)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Fornecedor">
            <select className={estiloEntrada} value={v.fornecedorId} onChange={(e) => escolherFornecedor(e.target.value)}>
              <option value="">Outro</option>
              {d.fornecedores.filter((f) => f.ativo || f.id === v.fornecedorId).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </Campo>
        </div>
        {!v.fornecedorId && (
          <Campo rotulo="Para quem paga"><input className={estiloEntrada} value={v.favorecido} placeholder="Ex.: imobiliária, concessionária de energia" onChange={(e) => setV({ ...v, favorecido: e.target.value })} /></Campo>
        )}
        <Campo rotulo="Conta contábil">
          <select className={estiloEntrada} value={v.contaId} onChange={(e) => setV({ ...v, contaId: e.target.value })}>
            <option value="">Classificar depois</option>
            {grupos.map((g) => (
              <optgroup key={g.mae.id} label={`${g.mae.codigo} ${g.mae.nome}`}>
                {g.contas.map((x) => <option key={x.id} value={x.id}>{x.codigo} {x.nome}</option>)}
              </optgroup>
            ))}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo={!conta && v.repeticao === 'parcelada' ? 'Valor total (R$)' : 'Valor (R$)'}>
            <input inputMode="decimal" className={estiloEntrada} value={v.valor} onChange={(e) => setV({ ...v, valor: e.target.value })} />
          </Campo>
          <Campo rotulo={!conta && v.repeticao !== 'unica' ? '1º vencimento' : 'Vencimento'}>
            <input type="date" className={estiloEntrada} value={v.vencimento} onChange={(e) => setV({ ...v, vencimento: e.target.value })} />
          </Campo>
          <Campo rotulo="Mês da despesa (DRE)">
            <input type="month" className={estiloEntrada} value={v.competencia} onChange={(e) => setV({ ...v, competencia: e.target.value })} />
          </Campo>
          <Campo rotulo="Forma">
            <select className={estiloEntrada} value={v.forma} onChange={(e) => setV({ ...v, forma: e.target.value as FormaPagamento })}>
              {FORMAS_PAGAMENTO.map((f) => <option key={f.valor} value={f.valor}>{f.nome}</option>)}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Boleto, chave Pix ou nº do documento"><input className={estiloEntrada} value={v.documento} onChange={(e) => setV({ ...v, documento: e.target.value })} /></Campo>
        {!conta && (
          <div className="space-y-2 rounded-xl bg-stone-50 p-3">
            <div className="flex flex-wrap gap-1">
              {([['unica', 'Uma vez'], ['parcelada', 'Parcelada'], ['mensal', 'Repete todo mês']] as const).map(([id, nome]) => (
                <button key={id} onClick={() => setV({ ...v, repeticao: id })}
                  className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${v.repeticao === id ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>
                  {nome}
                </button>
              ))}
            </div>
            {v.repeticao !== 'unica' && (
              <label className="flex items-center gap-2 text-sm">
                {v.repeticao === 'parcelada' ? 'Em' : 'Por'}
                <input inputMode="numeric" className={`${estiloEntrada} w-16! py-1!`} value={v.vezes} onChange={(e) => setV({ ...v, vezes: e.target.value })} />
                {v.repeticao === 'parcelada'
                  ? `parcelas de ${reais(dividir(lerValor(v.valor) ?? 0, vezes)[0])}, todas no mês da despesa`
                  : `meses, ${reais(lerValor(v.valor) ?? 0)} cada (aluguel, internet, sistema…)`}
              </label>
            )}
          </div>
        )}
        <Campo rotulo="Observação"><input className={estiloEntrada} value={v.observacao} onChange={(e) => setV({ ...v, observacao: e.target.value })} /></Campo>
        {conta?.pagoEm && <p className="text-sm text-green-700">Paga em {dataCurta(conta.pagoEm)} ({reais(conta.valorPago ?? conta.valor)}).</p>}
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <div className="flex flex-wrap justify-between gap-2">
          {conta && !conta.notaId ? <Botao variante="perigo" onClick={excluir}>Excluir</Botao> : <span />}
          <div className="flex gap-2">
            <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
            <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
          </div>
        </div>
        {conta?.notaId && <p className="text-xs text-stone-500">Para tirar uma conta que veio da nota, desfaça o lançamento da nota.</p>}
      </div>
    </Modal>
  )
}

// DRE simples das despesas: por conta contábil (agrupada pela conta-mãe) e por loja, no mês da despesa ou no mês do pagamento.
function Despesas() {
  const { d, erro } = useDados()
  const [base, setBase] = useState<'competencia' | 'caixa'>('competencia')
  const [mes, setMes] = useState(mesDe(hoje()))
  if (erro) return <Vazio>{erro}</Vazio>
  if (!d) return <p className="text-stone-400">Carregando…</p>

  const mesDaConta = (c: ContaPagar) => (base === 'competencia' ? mesDe(c.competencia) : c.pagoEm ? mesDe(c.pagoEm) : null)
  const valorDe = (c: ContaPagar) => (base === 'caixa' ? c.valorPago ?? c.valor : c.valor)
  const meses = [...new Set([mesDe(hoje()), ...d.contas.map(mesDaConta).filter((m): m is string => !!m)])].sort().reverse()
  const doMes = d.contas.filter((c) => mesDaConta(c) === mes)
  const centros = d.centros.filter((x) => doMes.some((c) => c.centroCustoId === x.id))
  const porCodigo = new Map(d.plano.map((p) => [p.codigo, p]))
  const maeDe = (contaId: string | null) => {
    const p = d.plano.find((x) => x.id === contaId)
    if (!p) return null
    return p.paiCodigo ? porCodigo.get(p.paiCodigo) ?? p : p
  }
  const total = (l: ContaPagar[], centro?: string) => l.filter((c) => !centro || c.centroCustoId === centro).reduce((s, c) => s + valorDe(c), 0)

  const maes = d.plano.filter((p) => !p.paiCodigo).sort((a, b) => a.ordem - b.ordem)
  const blocos = maes
    .map((m) => {
      const contas = doMes.filter((c) => maeDe(c.contaId)?.id === m.id)
      const filhas = d.plano
        .filter((p) => p.id === m.id || p.paiCodigo === m.codigo)
        .map((p) => ({ p, contas: contas.filter((c) => c.contaId === p.id) }))
        .filter((x) => x.contas.length)
      return { m, contas, filhas }
    })
    .filter((b) => b.contas.length)
  const semConta = doMes.filter((c) => !maeDe(c.contaId))
  const operacionais = blocos.filter((b) => b.m.operacional)
  const abaixo = blocos.filter((b) => !b.m.operacional)
  const totalOperacional = operacionais.reduce((s, b) => s + total(b.contas), 0) + total(semConta)

  const Linha = ({ nome, l, forte = false, recuo = false }: { nome: string; l: ContaPagar[]; forte?: boolean; recuo?: boolean }) => (
    <tr className={forte ? 'bg-stone-50 font-semibold' : ''}>
      <td className={`px-3 py-1.5 ${recuo ? 'pl-6 text-stone-600' : ''}`}>{nome}</td>
      {centros.length > 1 && centros.map((x) => <td key={x.id} className="px-3 py-1.5 text-right whitespace-nowrap">{total(l, x.id) ? reais(total(l, x.id)) : '—'}</td>)}
      <td className="px-3 py-1.5 text-right whitespace-nowrap">{reais(total(l))}</td>
    </tr>
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Despesas por conta</h1>
        <p className="text-sm text-stone-500">Soma do contas a pagar por conta contábil e loja. É a parte de despesas da DRE.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select className={`${estiloEntrada} w-auto!`} value={mes} onChange={(e) => setMes(e.target.value)}>
          {meses.map((m) => <option key={m} value={m}>{nomeMesAno(m)}</option>)}
        </select>
        {([['competencia', 'Mês da despesa'], ['caixa', 'Mês do pagamento']] as const).map(([id, nome]) => (
          <button key={id} onClick={() => setBase(id)}
            className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${base === id ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>
            {nome}
          </button>
        ))}
      </div>
      {doMes.length === 0 ? <Vazio>Nenhuma despesa {base === 'caixa' ? 'paga' : 'lançada'} em {nomeMesAno(mes)}.</Vazio> : (
        <Cartao className="overflow-x-auto p-0!">
          <table className="w-full text-sm">
            <thead className="bg-stone-100 text-left text-stone-500">
              <tr>
                <th className="px-3 py-2">Conta</th>
                {centros.length > 1 && centros.map((x) => <th key={x.id} className="px-3 py-2 text-right">{nomeCentro(x)}</th>)}
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {operacionais.map((b) => [
                <Linha key={b.m.id} nome={`${b.m.codigo} ${b.m.nome}`} l={b.contas} forte />,
                ...b.filhas.filter((f) => f.p.id !== b.m.id).map((f) => <Linha key={f.p.id} nome={`${f.p.codigo} ${f.p.nome}`} l={f.contas} recuo />),
              ])}
              {semConta.length > 0 && <Linha nome="Sem conta contábil" l={semConta} forte />}
              <tr className="bg-carvao font-bold text-white">
                <td className="px-3 py-2">Despesas operacionais</td>
                {centros.length > 1 && centros.map((x) => (
                  <td key={x.id} className="px-3 py-2 text-right whitespace-nowrap">
                    {reais(operacionais.reduce((s, b) => s + total(b.contas, x.id), 0) + total(semConta, x.id))}
                  </td>
                ))}
                <td className="px-3 py-2 text-right whitespace-nowrap">{reais(totalOperacional)}</td>
              </tr>
              {abaixo.map((b) => [
                <Linha key={b.m.id} nome={`${b.m.codigo} ${b.m.nome}`} l={b.contas} forte />,
                ...b.filhas.filter((f) => f.p.id !== b.m.id).map((f) => <Linha key={f.p.id} nome={`${f.p.codigo} ${f.p.nome}`} l={f.contas} recuo />),
              ])}
            </tbody>
          </table>
        </Cartao>
      )}
      <p className="text-xs text-stone-500">
        Empréstimos, investimentos e distribuição de lucros ficam abaixo do resultado operacional. A receita continua vindo do Lucro Fácil (aba Resultado).
      </p>
    </div>
  )
}

function PlanoContas() {
  const { store } = useApp()
  const [plano, setPlano] = useState<ContaContabil[] | null>(null)
  const [erro, setErro] = useState('')
  const [editar, setEditar] = useState<Partial<ContaContabil> | null>(null)
  const carregar = useCallback(() => store.planoContas().then(setPlano, (e) => setErro(e.message)), [store])
  useEffect(() => {
    carregar()
  }, [carregar])
  if (erro) return <Vazio>{erro}</Vazio>
  if (!plano) return <p className="text-stone-400">Carregando…</p>
  const maes = plano.filter((p) => !p.paiCodigo).sort((a, b) => a.ordem - b.ordem)
  const filhas = (m: ContaContabil) => plano.filter((p) => p.paiCodigo === m.codigo).sort((a, b) => a.ordem - b.ordem)
  function novaFilha(m: ContaContabil) {
    const f = filhas(m)
    const ultimo = Math.max(0, ...f.map((x) => Number(x.codigo.split('.')[1]) || 0))
    setEditar({ codigo: `${m.codigo}.${ultimo + 1}`, nome: '', paiCodigo: m.codigo, operacional: m.operacional, ordem: m.ordem + ultimo + 1, ativo: true })
  }
  function novaMae() {
    const ultimo = Math.max(0, ...maes.map((x) => Number(x.codigo) || 0))
    setEditar({ codigo: String(ultimo + 1), nome: '', paiCodigo: null, operacional: true, ordem: (ultimo + 1) * 100, ativo: true })
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Plano de contas</h1>
          <p className="text-sm text-stone-500">Começou igual às categorias de despesa do Lucro Fácil, para a DRE bater com a de lá.</p>
        </div>
        <Botao variante="secundario" onClick={novaMae}>+ Grupo</Botao>
      </div>
      {maes.map((m) => (
        <Cartao key={m.id} className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <button className="text-left font-semibold hover:underline" onClick={() => setEditar(m)}>
              {m.codigo} {m.nome} {!m.ativo && <Selo>Desativada</Selo>} {!m.operacional && <Selo cor="azul">Fora do operacional</Selo>}
            </button>
            <button className="shrink-0 text-sm font-semibold underline" onClick={() => novaFilha(m)}>+ Conta</button>
          </div>
          <ul className="text-sm">
            {filhas(m).map((f) => (
              <li key={f.id}>
                <button className={`py-0.5 pl-4 text-left hover:underline ${f.ativo ? 'text-stone-700' : 'text-stone-400 line-through'}`} onClick={() => setEditar(f)}>
                  {f.codigo} {f.nome}
                </button>
              </li>
            ))}
          </ul>
        </Cartao>
      ))}
      {editar && (
        <EditarContaContabil c={editar} aoFechar={() => setEditar(null)} aoSalvar={() => { setEditar(null); carregar() }} />
      )}
    </div>
  )
}

function EditarContaContabil({ c, aoFechar, aoSalvar }: { c: Partial<ContaContabil>; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const [v, setV] = useState({ codigo: c.codigo ?? '', nome: c.nome ?? '', operacional: c.operacional ?? true, ativo: c.ativo ?? true })
  const [erro, setErro] = useState('')
  async function salvar() {
    if (!v.codigo.trim() || !v.nome.trim()) return setErro('Coloque o código e o nome.')
    try {
      await store.salvarContaContabil({
        id: c.id, codigo: v.codigo, nome: v.nome, paiCodigo: c.paiCodigo ?? null, operacional: v.operacional, ordem: c.ordem ?? 0, ativo: v.ativo,
      })
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }
  return (
    <Modal titulo={c.id ? 'Conta contábil' : 'Nova conta contábil'} aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <div className="grid grid-cols-[6rem_1fr] gap-3">
          <Campo rotulo="Código"><input className={estiloEntrada} value={v.codigo} disabled={!!c.id} onChange={(e) => setV({ ...v, codigo: e.target.value })} /></Campo>
          <Campo rotulo="Nome"><input className={estiloEntrada} value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} /></Campo>
        </div>
        {!c.paiCodigo && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.operacional} onChange={(e) => setV({ ...v, operacional: e.target.checked })} />
            Entra no resultado operacional (desmarque para empréstimos, investimentos, distribuição)
          </label>
        )}
        {c.id && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.ativo} onChange={(e) => setV({ ...v, ativo: e.target.checked })} />
            Ativa (desativada some das listas, mas o histórico fica)
          </label>
        )}
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={salvar}>Salvar</Botao>
        </div>
      </div>
    </Modal>
  )
}
