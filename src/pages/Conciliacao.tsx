import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Botao, Campo, Cartao, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { dataCurta, diaSemana } from '../lib/datas'
import { type GrupoLote, candidatas, gruposLote, lotesPara, nomeLote, sugestoes, sugestoesLote } from '../lib/conciliacao'
import { nomeCentro, nomeConta, reais } from '../lib/financeiro'
import { chaveExtrato, lerArquivoOfx } from '../lib/ofx'
import { garantirFornecedor } from './LancarContas'
import { EditarRecorrente } from './Recorrentes'
import EscolherConta from '../components/EscolherConta'
import type { NotaFiscal, FormaPagamento } from '../lib/types'
import { FORMAS_PAGAMENTO } from '../lib/types'
import { addMeses, mesDe } from '../lib/datas'
import { ir } from '../lib/rota'
import type { CentroCusto, ContaContabil, ContaPagar, Fornecedor, MovimentoExtrato, RegraExtrato, SaldoExtrato } from '../lib/types'

interface Dados {
  movs: MovimentoExtrato[]; contas: ContaPagar[]; centros: CentroCusto[]; plano: ContaContabil[]; fornecedores: Fornecedor[]
  regras: RegraExtrato[]; saldos: SaldoExtrato[]; notas: NotaFiscal[]
}

const FILTROS = [
  { id: 'pendentes', nome: 'Saídas a conciliar' },
  { id: 'entradas', nome: 'Entradas' },
  { id: 'conciliados', nome: 'Conciliados' },
  { id: 'ignorados', nome: 'Ignorados' },
] as const
type Filtro = (typeof FILTROS)[number]['id']

const MOTIVOS = ['Transferência entre contas da empresa', 'Aplicação ou resgate', 'Pagamento já lançado em outra conta', 'Outro']

// Conciliação bancária (09/10): extrato OFX do Itaú × contas a pagar.
export default function Conciliacao() {
  const { store } = useApp()
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('pendentes')
  const [contaBanco, setContaBanco] = useState('')
  const [lendo, setLendo] = useState(false)
  const [achar, setAchar] = useState<MovimentoExtrato | null>(null)
  const [lancar, setLancar] = useState<MovimentoExtrato | null>(null)
  const [ignorar, setIgnorar] = useState<MovimentoExtrato | null>(null)
  const [recorrenteDe, setRecorrenteDe] = useState<ContaPagar | null>(null)
  const arquivo = useRef<HTMLInputElement>(null)

  const carregar = useCallback(
    () => Promise.all([store.extrato(), store.contasPagar(), store.centrosCusto(), store.planoContas(), store.fornecedores(), store.regrasExtrato(), store.saldosExtrato(), store.notasFiscais()])
      .then(([movs, contas, centros, plano, fornecedores, regras, saldos, notas]) => setD({ movs, contas, centros, plano, fornecedores, regras, saldos, notas }), (e) => setErro(e.message)),
    [store],
  )
  useEffect(() => {
    carregar()
  }, [carregar])

  const sug = useMemo(() => (d ? sugestoes(d.movs, d.contas, d.fornecedores) : new Map<string, ContaPagar>()), [d])
  const sugLote = useMemo(() => {
    if (!d) return new Map<string, GrupoLote>()
    const livres = d.movs.filter((m) => !sug.has(m.id))
    return sugestoesLote(livres, d.contas, new Set([...sug.values()].map((c) => c.id)))
  }, [d, sug])

  async function importar(files: FileList | null) {
    if (!files?.length) return
    setLendo(true)
    setAviso('')
    const partes: string[] = []
    for (const f of Array.from(files)) {
      try {
        const e = await lerArquivoOfx(f)
        const r = await store.importarExtrato(e)
        partes.push(`${f.name}: ${r.novos} lançamentos novos${r.repetidos ? `, ${r.repetidos} já estavam` : ''}`)
      } catch (e) {
        partes.push(`${f.name}: ${(e as Error).message}`)
      }
    }
    if (arquivo.current) arquivo.current.value = ''
    setLendo(false)
    setAviso(partes.join(' · '))
    carregar()
  }

  async function acao(f: () => Promise<void>) {
    try {
      await f()
    } catch (e) {
      setAviso((e as Error).message)
    }
    carregar()
  }

  if (erro) return <Vazio>{erro}</Vazio>
  if (!d) return <p className="text-stone-400">Carregando…</p>

  const contasBanco = [...new Map(d.movs.map((m) => [`${m.banco}|${m.agencia}|${m.conta}`, m])).values()]
  const daConta = (m: MovimentoExtrato) => !contaBanco || `${m.banco}|${m.agencia}|${m.conta}` === contaBanco
  const movs = d.movs.filter(daConta)
  const pendentes = movs.filter((m) => m.status === 'pendente' && m.valor < 0)
  const comSugestao = pendentes.filter((m) => sug.has(m.id) || sugLote.has(m.id))
  const regraDe = (m: MovimentoExtrato) => d.regras.find((r) => r.chave === chaveExtrato(m.descricao))
  const lista = movs.filter((m) =>
    filtro === 'pendentes' ? m.status === 'pendente' && m.valor < 0
      : filtro === 'entradas' ? m.status === 'pendente' && m.valor > 0
      : filtro === 'conciliados' ? m.status === 'conciliado'
      : m.status === 'ignorado')
  const contaPorId = new Map(d.contas.map((c) => [c.id, c]))
  const notaDe = (m: MovimentoExtrato) => d.notas.find((n) => n.extratoMovimentoId === m.id && n.status === 'conferir')
  const favorecido = (c: ContaPagar) => d.fornecedores.find((f) => f.id === c.fornecedorId)?.nome ?? c.favorecido ?? ''
  const saldo = [...d.saldos].sort((a, b) => b.data.localeCompare(a.data)).find((s) => !contaBanco || `${s.banco}|${s.agencia}|${s.conta}` === contaBanco)

  async function confirmarTodas() {
    if (!confirm(`Confirmar as ${comSugestao.length} sugestões? Cada saída fica ligada à conta indicada, que vira paga e conciliada.`)) return
    for (const m of comSugestao) {
      try {
        const g = sugLote.get(m.id)
        if (g) await store.conciliarLote(m.id, g.contas.map((c) => c.id), null)
        else await store.conciliarMovimento(m.id, sug.get(m.id)!.id)
      } catch (e) {
        setAviso((e as Error).message)
      }
    }
    carregar()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Conciliação bancária</h1>
          <p className="text-sm text-stone-500">Importe o extrato OFX do Itaú. O portal liga cada saída a uma conta a pagar e mostra o que ninguém lançou.</p>
        </div>
        <div>
          <input ref={arquivo} type="file" accept=".ofx,.OFX" multiple className="hidden" onChange={(e) => importar(e.target.files)} />
          <Botao onClick={() => arquivo.current?.click()} disabled={lendo}>{lendo ? 'Lendo…' : 'Importar extrato OFX'}</Botao>
        </div>
      </div>
      {aviso && <p className="rounded-xl bg-stone-100 p-3 text-sm">{aviso}</p>}

      {d.movs.length === 0 ? (
        <Vazio>
          Nenhum extrato ainda. No internet banking do Itaú: Extrato › escolha o período › Exportar › formato OFX (Money). Depois clique em "Importar extrato OFX".
        </Vazio>
      ) : (
        <>
          {contasBanco.length > 1 && (
            <select className={`${estiloEntrada} w-auto!`} value={contaBanco} onChange={(e) => setContaBanco(e.target.value)}>
              <option value="">Todas as contas</option>
              {contasBanco.map((m) => <option key={m.id} value={`${m.banco}|${m.agencia}|${m.conta}`}>Banco {m.banco} · ag. {m.agencia} · cc {m.conta}</option>)}
            </select>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Cartao onClick={() => setFiltro('pendentes')}>
              <p className="text-sm text-stone-500">Saídas a conciliar</p>
              <p className={`text-lg font-bold ${pendentes.length ? 'text-amber-700' : ''}`}>{pendentes.length}</p>
              <p className="text-xs text-stone-400">{reais(-pendentes.reduce((s, m) => s + m.valor, 0))}</p>
            </Cartao>
            <Cartao onClick={() => setFiltro('pendentes')}>
              <p className="text-sm text-stone-500">Com sugestão pronta</p>
              <p className="text-lg font-bold">{comSugestao.length}</p>
              <p className="text-xs text-stone-400">mesmo valor e data perto{sugLote.size ? ` · ${sugLote.size} em lote` : ''}</p>
            </Cartao>
            <Cartao onClick={() => setFiltro('conciliados')}>
              <p className="text-sm text-stone-500">Conciliados</p>
              <p className="text-lg font-bold">{movs.filter((m) => m.status === 'conciliado').length}</p>
              <p className="text-xs text-stone-400">de {movs.filter((m) => m.valor < 0).length} saídas</p>
            </Cartao>
            <Cartao>
              <p className="text-sm text-stone-500">Saldo no banco</p>
              <p className="text-lg font-bold">{saldo ? reais(saldo.saldo) : '—'}</p>
              <p className="text-xs text-stone-400">{saldo ? `em ${dataCurta(saldo.data)}` : 'o OFX não trouxe'}</p>
            </Cartao>
          </div>
          {comSugestao.length > 0 && filtro === 'pendentes' && (
            <Botao variante="secundario" onClick={confirmarTodas}>Confirmar as {comSugestao.length} sugestões</Botao>
          )}

          <div className="flex flex-wrap gap-2">
            {FILTROS.map((f) => (
              <button key={f.id} onClick={() => setFiltro(f.id)}
                className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${filtro === f.id ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>
                {f.nome}
              </button>
            ))}
          </div>
          {filtro === 'entradas' && (
            <p className="text-sm text-stone-500">As entradas (cartões, iFood, Pix de clientes) vão ser conferidas com as vendas quando ligarmos a Eclética. Por enquanto, dá para ignorar as que não interessam.</p>
          )}

          {lista.length === 0 ? <Vazio>Nada aqui.</Vazio> : (
            <div className="space-y-2">
              {lista.map((m) => {
                const s = sug.get(m.id)
                const sl = sugLote.get(m.id)
                const doLote = d.contas.filter((c) => c.extratoMovimentoId === m.id)
                const regra = m.status === 'pendente' ? regraDe(m) : undefined
                const ligada = m.contaPagarId ? contaPorId.get(m.contaPagarId) : undefined
                return (
                  <Cartao key={m.id} className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold break-words">{m.descricao || 'Sem descrição'}</p>
                        <p className="text-sm text-stone-500">{diaSemana(m.data)}, {dataCurta(m.data)}{m.documento ? ` · doc. ${m.documento}` : ''}</p>
                      </div>
                      <p className={`shrink-0 font-bold ${m.valor < 0 ? '' : 'text-green-700'}`}>{reais(m.valor)}</p>
                    </div>

                    {m.status === 'conciliado' && (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span><Selo cor="verde">Conciliado</Selo> {ligada ? `${ligada.descricao} · ${nomeCentro(d.centros.find((x) => x.id === ligada.centroCustoId))} · ${nomeConta(d.plano, ligada.contaId)}` : ''}
                          {ligada && !ligada.recorrenteId && !ligada.origem && (
                            <button className="ml-2 text-stone-500 underline" onClick={() => setRecorrenteDe(ligada)}>Repete todo mês?</button>
                          )}
                          {!ligada && doLote.length > 0 && <>
                            {` ${doLote.length} contas juntas`}
                            <details className="mt-1"><summary className="cursor-pointer text-stone-500">Ver as contas</summary>
                              <ul className="mt-1 space-y-0.5">{doLote.map((c) => <li key={c.id}>{[c.descricao, favorecido(c), reais(c.valorPago ?? c.valor)].filter(Boolean).join(' · ')}</li>)}</ul>
                            </details>
                          </>}
                        </span>
                        <button className="font-semibold underline" onClick={() => acao(() => store.desconciliarMovimento(m.id))}>Desfazer</button>
                      </div>
                    )}
                    {m.status === 'ignorado' && (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span><Selo>Ignorado</Selo> {m.observacao}</span>
                        <button className="font-semibold underline" onClick={() => acao(() => store.desconciliarMovimento(m.id))}>Voltar para conciliar</button>
                      </div>
                    )}
                    {m.status === 'pendente' && m.valor < 0 && (
                      <>
                        {notaDe(m) ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-50 p-2 text-sm">
                            <span>Ligado à nota {notaDe(m)!.numero ? `NF ${notaDe(m)!.numero}` : 'sem número'} · {notaDe(m)!.emitenteNome ?? ''}: fica conciliado quando a nota for lançada.</span>
                            <Botao className="py-1.5!" onClick={() => ir('estoque/nota/' + notaDe(m)!.id)}>Abrir a nota</Botao>
                          </div>
                        ) : sl ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-green-50 p-2 text-sm">
                            <span>
                              É <b>{nomeLote(sl.lote)}</b>: {sl.contas.length} contas que somam {reais(sl.total)}
                              <details><summary className="cursor-pointer text-stone-500">Ver as contas</summary>
                                <ul className="mt-1 space-y-0.5">{sl.contas.map((c) => <li key={c.id}>{[c.descricao, favorecido(c), reais(c.valorPago ?? c.valor)].filter(Boolean).join(' · ')}</li>)}</ul>
                              </details>
                            </span>
                            <span className="flex gap-2">
                              <Botao className="py-1.5!" onClick={() => acao(() => store.conciliarLote(m.id, sl.contas.map((c) => c.id), null))}>Confirmar</Botao>
                              <Botao variante="fantasma" className="py-1.5!" onClick={() => setAchar(m)}>Outra</Botao>
                            </span>
                          </div>
                        ) : s ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-green-50 p-2 text-sm">
                            <span>
                              É <b>{s.descricao}</b>{s.parcelas ? ` (${s.parcela}/${s.parcelas})` : ''} · {favorecido(s)} · vence {dataCurta(s.vencimento)}{s.pagoEm ? ` · paga ${dataCurta(s.pagoEm)}` : ''}
                            </span>
                            <span className="flex gap-2">
                              <Botao className="py-1.5!" onClick={() => acao(() => store.conciliarMovimento(m.id, s.id))}>Confirmar</Botao>
                              <Botao variante="fantasma" className="py-1.5!" onClick={() => setAchar(m)}>Outra</Botao>
                            </span>
                          </div>
                        ) : regra?.ignorar ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-100 p-2 text-sm">
                            <span>Da última vez foi ignorado: {regra.favorecido}</span>
                            <Botao className="py-1.5!" onClick={() => acao(() => store.ignorarMovimento(m.id, regra.favorecido ?? 'Ignorado', null))}>Ignorar de novo</Botao>
                          </div>
                        ) : regra && regra.centroCustoId ? (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-50 p-2 text-sm">
                            <span>Da última vez: {nomeCentro(d.centros.find((x) => x.id === regra.centroCustoId))} · {nomeConta(d.plano, regra.contaId)}{regra.favorecido ? ` · ${regra.favorecido}` : ''}</span>
                            <Botao className="py-1.5!" onClick={() => acao(() => store.registrarMovimento(m.id, {
                              centroCustoId: regra.centroCustoId!, contaId: regra.contaId, favorecido: regra.favorecido, fornecedorId: regra.fornecedorId ?? null, descricao: m.descricao, chave: chaveExtrato(m.descricao),
                            }))}>Lançar assim</Botao>
                          </div>
                        ) : (
                          <p className="text-sm font-semibold text-amber-700">Não identificado: não achei conta a pagar com este valor.</p>
                        )}
                        <div className="flex flex-wrap gap-3 text-sm">
                          <button className="font-semibold underline" onClick={() => setAchar(m)}>Achar a conta</button>
                          <button className="font-semibold underline" onClick={() => setLancar(m)}>Lançar como despesa</button>
                          <button className="font-semibold underline" onClick={() => setIgnorar(m)}>Ignorar</button>
                        </div>
                      </>
                    )}
                    {m.status === 'pendente' && m.valor > 0 && (
                      <button className="text-sm font-semibold underline" onClick={() => setIgnorar(m)}>Ignorar</button>
                    )}
                  </Cartao>
                )
              })}
            </div>
          )}
        </>
      )}

      {achar && <AcharConta d={d} m={achar} aoFechar={() => setAchar(null)} aoEscolher={(c) => { setAchar(null); acao(() => store.conciliarMovimento(achar.id, c.id)) }}
        aoEscolherLote={(ids, dif) => { setAchar(null); acao(() => store.conciliarLote(achar.id, ids, dif)) }} />}
      {lancar && <LancarDespesa d={d} m={lancar} aoFechar={() => setLancar(null)} aoSalvar={() => { setLancar(null); carregar() }} />}
      {recorrenteDe && (
        <EditarRecorrente
          d={d} r={null}
          modelo={{
            descricao: recorrenteDe.descricao, fornecedorId: recorrenteDe.fornecedorId, fornecedorNome: favorecido(recorrenteDe) || null,
            centroCustoId: recorrenteDe.centroCustoId, contaId: recorrenteDe.contaId, valor: recorrenteDe.valorPago ?? recorrenteDe.valor, variavel: false,
            dia: Number(recorrenteDe.vencimento.slice(8, 10)), forma: recorrenteDe.forma, inicio: addMeses(mesDe(recorrenteDe.vencimento), 1), fim: null,
            situacao: 'ativa', observacao: 'Cadastrada na conciliação',
          }}
          aoFechar={() => setRecorrenteDe(null)}
          aoSalvar={() => { setRecorrenteDe(null); setAviso('Recorrente cadastrado. Aparece em Financeiro › Recorrentes.') }}
        />
      )}
      {ignorar && <Ignorar m={ignorar} aoFechar={() => setIgnorar(null)} aoSalvar={() => { setIgnorar(null); carregar() }} />}
    </div>
  )
}

function AcharConta({ d, m, aoFechar, aoEscolher, aoEscolherLote }: {
  d: Dados; m: MovimentoExtrato; aoFechar: () => void; aoEscolher: (c: ContaPagar) => void; aoEscolherLote: (ids: string[], contaDiferenca: string | null) => void
}) {
  const [busca, setBusca] = useState('')
  const taxas = d.plano.find((c) => c.codigo === '5.22') ?? d.plano.find((c) => /taxas? banc/i.test(c.nome))
  const [contaDif, setContaDif] = useState(taxas?.id ?? '')
  const usadas = new Set(d.movs.map((x) => x.contaPagarId).filter((x): x is string => !!x))
  const perto = candidatas(m, d.contas, d.fornecedores, usadas)
  const lotes = lotesPara(m, gruposLote(d.contas, usadas))
  const nome = (c: ContaPagar) => d.fornecedores.find((f) => f.id === c.fornecedorId)?.nome ?? c.favorecido ?? ''
  const todas = busca
    ? d.contas.filter((c) => !c.conciliado && !usadas.has(c.id) && `${c.descricao} ${nome(c)}`.toLowerCase().includes(busca.toLowerCase()))
    : perto.map((x) => x.conta)
  return (
    <Modal titulo="Qual conta é esta saída?" aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <p className="text-sm">{m.descricao} · {dataCurta(m.data)} · <b>{reais(m.valor)}</b></p>
        <input className={estiloEntrada} placeholder="Buscar por descrição ou fornecedor" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {!busca && lotes.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Pagamentos em lote</p>
            {lotes.map(({ grupo: g, diferenca }) => (
              <div key={g.lote} className="space-y-2 rounded-xl bg-stone-50 p-2 text-sm">
                <p><b>{nomeLote(g.lote)}</b>: {g.contas.length} contas, {reais(g.total)}{diferenca > 0 ? <> · <span className="text-amber-700">faltam {reais(diferenca)}</span></> : ' · bate certinho'}</p>
                {diferenca > 0 && (
                  <Campo rotulo="Lançar a diferença em (juros, tarifa, item que faltou)">
                    <EscolherConta plano={d.plano} valor={contaDif} aoMudar={setContaDif} />
                  </Campo>
                )}
                <Botao className="py-1.5!" disabled={diferenca > 0 && !contaDif} onClick={() => aoEscolherLote(g.contas.map((c) => c.id), diferenca > 0 ? contaDif : null)}>
                  Conciliar o lote
                </Botao>
              </div>
            ))}
            <p className="text-sm font-semibold">Ou uma conta só</p>
          </div>
        )}
        {!busca && <p className="text-xs text-stone-500">Mostrando as contas com valor parecido (até 10% de diferença, por juros ou desconto) e data perto.</p>}
        {todas.length === 0 ? <Vazio>Nenhuma conta parecida em aberto. Use "Lançar como despesa".</Vazio> : (
          <ul className="max-h-80 divide-y divide-stone-100 overflow-y-auto">
            {todas.slice(0, 40).map((c) => (
              <li key={c.id}>
                <button className="flex w-full items-center justify-between gap-2 py-2 text-left hover:bg-stone-50" onClick={() => aoEscolher(c)}>
                  <span className="min-w-0 text-sm">
                    <span className="font-semibold break-words">{c.descricao}{c.parcelas ? ` (${c.parcela}/${c.parcelas})` : ''}</span>
                    <span className="block text-stone-500">{nome(c)} · {nomeCentro(d.centros.find((x) => x.id === c.centroCustoId))} · vence {dataCurta(c.vencimento)}{c.pagoEm ? ' · já paga' : ''}</span>
                  </span>
                  <span className="shrink-0 font-semibold">{reais(c.valorPago ?? c.valor)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}

type Comprovante = 'nao' | 'nota' | 'recibo'

// Lançar uma saída do extrato (09/10): só a despesa, ou ligada a uma nota/recibo (entra no estoque e atualiza o preço do insumo).
// Se repete todo mês, já cadastra o recorrente.
function LancarDespesa({ d, m, aoFechar, aoSalvar }: { d: Dados; m: MovimentoExtrato; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const valor = Math.abs(m.valor)
  const [v, setV] = useState({ centro: d.centros.some((x) => x.id === 'central') ? 'central' : '', conta: '', fornecedor: '', descricao: m.descricao })
  const [comp, setComp] = useState<Comprovante>('nao')
  const [numero, setNumero] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [rec, setRec] = useState({ ligado: false, dia: String(Number(m.data.slice(8, 10))), forma: 'debito_automatico' as FormaPagamento, variavel: false })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const ativos = d.fornecedores.filter((f) => f.ativo)
  // Notas importadas esperando lançamento, das mais parecidas com o valor para as menos.
  const notasLivres = d.notas
    .filter((n) => n.status === 'conferir' && !n.extratoMovimentoId)
    .sort((a, b) => Math.abs(a.valorTotal - valor) - Math.abs(b.valorTotal - valor))
    .slice(0, 12)
  const nomeNota = (n: NotaFiscal) => d.fornecedores.find((f) => f.id === n.fornecedorId)?.nome ?? n.emitenteNome ?? 'Fornecedor'
  // Escolheu um fornecedor conhecido: já traz a conta de sempre dele.
  function mudarFornecedor(texto: string) {
    const f = ativos.find((x) => x.nome.toLowerCase() === texto.trim().toLowerCase())
    setV({ ...v, fornecedor: texto, conta: v.conta || f?.contaPadraoId || '' })
  }

  async function recorrente(f: Fornecedor) {
    if (!rec.ligado) return
    await store.salvarRecorrente({
      descricao: v.descricao.trim() || f.nome, fornecedorId: f.id, fornecedorNome: f.nome, centroCustoId: v.centro, contaId: v.conta || null, valor,
      variavel: rec.variavel, dia: Number(rec.dia), forma: rec.forma, inicio: addMeses(mesDe(m.data), 1), fim: null, situacao: 'ativa',
      observacao: 'Cadastrada na conciliação',
    })
  }

  async function salvar() {
    setErro('')
    if (!v.fornecedor.trim()) return setErro('Escolha o fornecedor.')
    if (!v.centro) return setErro('Escolha a loja.')
    if (comp === 'nao' && !v.conta) return setErro('Escolha a conta contábil.')
    if (rec.ligado && !(Number(rec.dia) >= 1 && Number(rec.dia) <= 31)) return setErro('Dia do vencimento entre 1 e 31.')
    if (rec.ligado && !v.conta) return setErro('Para o recorrente, escolha a conta contábil.')
    setSalvando(true)
    try {
      const f = await garantirFornecedor(store, d.fornecedores, v.fornecedor)
      if (comp === 'recibo') {
        const id = await store.criarNotaManual({
          numero: numero || null, emissao: m.data, fornecedorId: f.id, emitenteNome: null, centroCustoId: v.centro, valorTotal: valor,
          observacao: v.descricao !== m.descricao ? v.descricao : null, arquivo, extratoMovimentoId: m.id,
        })
        await recorrente(f)
        return ir('estoque/nota/' + id)
      }
      await store.registrarMovimento(m.id, { centroCustoId: v.centro, contaId: v.conta || null, favorecido: f.nome, fornecedorId: f.id, descricao: v.descricao, chave: chaveExtrato(m.descricao) })
      await recorrente(f)
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  async function ligarNota(n: NotaFiscal) {
    try {
      await store.ligarNotaExtrato(n.id, m.id)
      ir('estoque/nota/' + n.id)
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <Modal titulo="Lançar como despesa" aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <p className="text-sm">{dataCurta(m.data)} · <b>{reais(m.valor)}</b> · {m.descricao}</p>
        <div className="space-y-1">
          <p className="text-sm font-medium text-stone-700">Tem nota fiscal ou recibo?</p>
          <div className="flex flex-wrap gap-2">
            {([['nao', 'Não, só a despesa'], ['nota', 'Nota já importada'], ['recibo', 'Recibo ou nota de papel']] as const).map(([id, nome]) => (
              <button key={id} onClick={() => setComp(id)}
                className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${comp === id ? 'bg-carvao text-white ring-carvao' : 'bg-white text-stone-600 ring-stone-300'}`}>
                {nome}
              </button>
            ))}
          </div>
        </div>

        {comp === 'nota' ? (
          <div className="space-y-2">
            <p className="text-sm text-stone-500">Notas importadas (XML) que ainda não foram lançadas, das de valor mais perto. Escolha e confira os itens: ao lançar, ela já fica paga por este débito.</p>
            {notasLivres.length === 0 ? <Vazio>Nenhuma nota esperando. Importe o XML em Estoque › Notas fiscais, ou use "Recibo ou nota de papel".</Vazio> : (
              <ul className="max-h-72 divide-y divide-stone-100 overflow-y-auto">
                {notasLivres.map((n) => (
                  <li key={n.id}>
                    <button className="flex w-full items-center justify-between gap-2 py-2 text-left hover:bg-stone-50" onClick={() => ligarNota(n)}>
                      <span className="min-w-0 text-sm">
                        <span className="font-semibold break-words">{nomeNota(n)}</span>
                        <span className="block text-stone-500">NF {n.numero ?? 's/n'} · {dataCurta(n.emissao)}</span>
                      </span>
                      <span className={`shrink-0 font-semibold ${Math.abs(n.valorTotal - valor) < 0.01 ? 'text-green-700' : ''}`}>{reais(n.valorTotal)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            <Campo rotulo="Fornecedor">
              <input className={estiloEntrada} list="despesa-fornecedores" placeholder="Comece a digitar" value={v.fornecedor} onChange={(e) => mudarFornecedor(e.target.value)} autoFocus />
              <datalist id="despesa-fornecedores">{ativos.map((f) => <option key={f.id} value={f.nome} />)}</datalist>
            </Campo>
            {v.fornecedor.trim() && !ativos.some((x) => x.nome.toLowerCase() === v.fornecedor.trim().toLowerCase()) && (
              <p className="text-xs text-stone-500">Fornecedor novo: vai ser cadastrado com esse nome.</p>
            )}
            <Campo rotulo="Descrição"><input className={estiloEntrada} value={v.descricao} onChange={(e) => setV({ ...v, descricao: e.target.value })} /></Campo>
            <Campo rotulo="Loja">
              <select className={estiloEntrada} value={v.centro} onChange={(e) => setV({ ...v, centro: e.target.value })}>
                <option value="">Escolher</option>
                {d.centros.map((x) => <option key={x.id} value={x.id}>{nomeCentro(x)}</option>)}
              </select>
            </Campo>
            <Campo rotulo={comp === 'recibo' ? 'Conta contábil (pode escolher na próxima tela)' : 'Conta contábil'}>
              <EscolherConta plano={d.plano} valor={v.conta} aoMudar={(id) => setV({ ...v, conta: id })} />
            </Campo>
            {comp === 'recibo' && (
              <div className="space-y-3 rounded-xl bg-stone-50 p-3">
                <p className="text-sm text-stone-600">Na próxima tela você coloca os itens: os insumos entram no estoque e o preço deles é atualizado.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Campo rotulo="Número (se tiver)"><input className={estiloEntrada} value={numero} onChange={(e) => setNumero(e.target.value)} /></Campo>
                  <Campo rotulo="Foto ou PDF"><input type="file" accept="application/pdf,image/*" capture="environment" className="text-sm" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} /></Campo>
                </div>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={rec.ligado} onChange={(e) => setRec({ ...rec, ligado: e.target.checked })} />
              Repete todo mês: cadastrar como pagamento recorrente
            </label>
            {rec.ligado && (
              <div className="space-y-2 rounded-xl bg-stone-50 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <Campo rotulo="Vence todo dia"><input className={estiloEntrada} inputMode="numeric" value={rec.dia} onChange={(e) => setRec({ ...rec, dia: e.target.value })} /></Campo>
                  <Campo rotulo="Forma">
                    <select className={estiloEntrada} value={rec.forma} onChange={(e) => setRec({ ...rec, forma: e.target.value as FormaPagamento })}>
                      {FORMAS_PAGAMENTO.map((x) => <option key={x.valor} value={x.valor}>{x.nome}</option>)}
                    </select>
                  </Campo>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={rec.variavel} onChange={(e) => setRec({ ...rec, variavel: e.target.checked })} />
                  O valor muda todo mês (lança {reais(valor)} como previsão)
                </label>
                <p className="text-xs text-stone-500">Começa em {addMeses(mesDe(m.data), 1).split('-').reverse().join('/')}; este mês já é este débito.</p>
              </div>
            )}
          </>
        )}
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          {comp !== 'nota' && (
            <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : comp === 'recibo' ? 'Continuar para os itens' : 'Lançar'}</Botao>
          )}
        </div>
      </div>
    </Modal>
  )
}

function Ignorar({ m, aoFechar, aoSalvar }: { m: MovimentoExtrato; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const [motivo, setMotivo] = useState(MOTIVOS[0])
  const [outro, setOutro] = useState('')
  const [sempre, setSempre] = useState(false)
  const [erro, setErro] = useState('')
  async function salvar() {
    const texto = motivo === 'Outro' ? outro.trim() : motivo
    if (!texto) return setErro('Diga o motivo.')
    try {
      await store.ignorarMovimento(m.id, texto, sempre ? chaveExtrato(m.descricao) : null)
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }
  return (
    <Modal titulo="Ignorar movimento" aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <p className="text-sm">{m.descricao} · {dataCurta(m.data)} · <b>{reais(m.valor)}</b></p>
        <Campo rotulo="Motivo">
          <select className={estiloEntrada} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            {MOTIVOS.map((x) => <option key={x}>{x}</option>)}
          </select>
        </Campo>
        {motivo === 'Outro' && <input className={estiloEntrada} value={outro} onChange={(e) => setOutro(e.target.value)} placeholder="Qual?" />}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sempre} onChange={(e) => setSempre(e.target.checked)} />
          Sugerir ignorar sempre que aparecer "{chaveExtrato(m.descricao)}"
        </label>
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={salvar}>Ignorar</Botao>
        </div>
      </div>
    </Modal>
  )
}
