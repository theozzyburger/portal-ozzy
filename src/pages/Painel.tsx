import { useEffect, useState } from 'react'
import Icone from '../components/Icone'
import { Avatar, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { addMeses, dataCurta, hoje, mesDe, nomeMes, nomeMesAno, primeiroDia, ultimoDia } from '../lib/datas'
import { ir } from '../lib/rota'
import { apelidoUnidade, type Avaliacao, type Documento, type Funcionario, type Ocorrencia } from '../lib/types'
import PainelAvaliacoes from './PainelAvaliacoes'
import PainelPedidos from './PainelPedidos'
import { ResumoNumeros } from './Vencimentos'
import { pendencias } from '../lib/vencimentos'

type Aba = 'pedidos' | 'avaliacoes' | 'rh' | 'financeiro'

interface Numeros {
  ativos: number
  faltas: number
  atrasos: number
  atestados: number
  contratacoes: number
  demissoes: number
  rotatividade: number
}

// Quantos estavam ativos num dia: já admitidos e ainda não desligados.
const ativosEm = (pessoas: Funcionario[], dia: string) =>
  pessoas.filter((p) => p.dataAdmissao <= dia && (!p.dataDesligamento || p.dataDesligamento > dia)).length

// ateDia: corta o mês nesse dia, para comparar o mês em andamento com o mesmo período do anterior.
function calcular(pessoas: Funcionario[], ocorrencias: Ocorrencia[], atestados: Documento[], mes: string, ateDia?: number): Numeros {
  const ini = primeiroDia(mes)
  const corte = ateDia ? `${mes}-${String(ateDia).padStart(2, '0')}` : null
  const fim = corte && corte < ultimoDia(mes) ? corte : ultimoDia(mes)
  const noMes = (d?: string | null) => !!d && d >= ini && d <= fim
  const contratacoes = pessoas.filter((p) => noMes(p.dataAdmissao)).length
  const demissoes = pessoas.filter((p) => noMes(p.dataDesligamento)).length
  const media = (ativosEm(pessoas, ini) + ativosEm(pessoas, fim)) / 2
  return {
    ativos: ativosEm(pessoas, fim < hoje() ? fim : hoje()),
    faltas: ocorrencias.filter((o) => o.tipo === 'falta' && noMes(o.data)).length,
    atrasos: ocorrencias.filter((o) => o.tipo === 'atraso' && noMes(o.data)).length,
    atestados: atestados.filter((d) => noMes(d.inicio ?? d.criadoEm.slice(0, 10))).length,
    contratacoes,
    demissoes,
    // Rotatividade (turnover) = média de entradas e saídas ÷ média de ativos no mês.
    rotatividade: media ? (((contratacoes + demissoes) / 2) / media) * 100 : 0,
  }
}

export default function Painel() {
  const { store, equipe, unidades, nomeUnidade } = useApp()
  const [mes, setMes] = useState(mesDe(hoje()))
  const [unidade, setUnidade] = useState('')
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [atestados, setAtestados] = useState<Documento[]>([])
  const [aba, setAba] = useState<Aba>('pedidos')
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([])
  const anterior = addMeses(mes, -1)

  const [docsSaude, setDocsSaude] = useState<Documento[]>([])
  useEffect(() => {
    store.avaliacoes().then(setAvaliacoes)
    store.documentosTodos().then(setDocsSaude)
  }, [store])

  useEffect(() => {
    const ini = primeiroDia(anterior)
    const fim = ultimoDia(mes)
    store.ocorrenciasEntre(ini, fim).then(setOcorrencias)
    store.atestadosEntre(ini, fim).then(setAtestados)
  }, [store, mes, anterior])

  const daUnidade = (u: string) => {
    const pessoas = equipe.filter((p) => !u || p.unidadeId === u)
    const ids = new Set(pessoas.map((p) => p.id))
    return {
      pessoas,
      ocorrencias: ocorrencias.filter((o) => ids.has(o.funcionarioId)),
      atestados: atestados.filter((d) => ids.has(d.funcionarioId)),
    }
  }
  const sel = daUnidade(unidade)
  const atual = calcular(sel.pessoas, sel.ocorrencias, sel.atestados, mes)
  const mesAtual = mes === mesDe(hoje())
  const diaHoje = Number(hoje().slice(8))
  const antes = calcular(sel.pessoas, sel.ocorrencias, sel.atestados, anterior, mesAtual ? diaHoje : undefined)
  const comparacao = mesAtual ? `vs 1 a ${diaHoje} de ${nomeMes(anterior)}` : `vs ${nomeMes(anterior)}`

  const ini = primeiroDia(mes)
  const fim = ultimoDia(mes)
  const entraram = sel.pessoas.filter((p) => p.dataAdmissao >= ini && p.dataAdmissao <= fim)
  const sairam = sel.pessoas.filter((p) => p.dataDesligamento && p.dataDesligamento >= ini && p.dataDesligamento <= fim)
  const faltasPorPessoa = Object.entries(
    sel.ocorrencias
      .filter((o) => o.tipo === 'falta' && o.data >= ini && o.data <= fim)
      .reduce<Record<string, number>>((acc, o) => ({ ...acc, [o.funcionarioId]: (acc[o.funcionarioId] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1])
  const pessoa = (id: string) => equipe.find((p) => p.id === id)

  const abas: { id: Aba; nome: string; icone: 'pedidos' | 'avaliacoes' | 'rh' | 'financeiro' }[] = [
    { id: 'pedidos', nome: 'Pedidos', icone: 'pedidos' },
    { id: 'avaliacoes', nome: 'Avaliações', icone: 'avaliacoes' },
    { id: 'rh', nome: 'RH', icone: 'rh' },
    { id: 'financeiro', nome: 'Financeiro', icone: 'financeiro' },
  ]

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="rotulo-marca text-[11px] text-stone-500">Painel da gestão</div>
          <h2 className="text-2xl font-bold tracking-tight">{unidade ? nomeUnidade(unidade) : 'Todas as lojas'}</h2>
        </div>
        <select className={`${estiloEntrada} w-full! py-2! sm:w-auto!`} value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label="Loja">
          <option value="">Todas as lojas</option>
          {unidades.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist">
        {abas.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
              aba === a.id ? 'bg-carvao text-ozzy-400' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:text-carvao hover:ring-carvao'
            }`}
          >
            <Icone nome={a.icone} tamanho={16} />
            {a.nome}
          </button>
        ))}
      </div>

      {aba === 'pedidos' && (
        <div className="rounded-3xl bg-white p-3 ring-1 ring-stone-200 sm:p-5">
          <PainelPedidos unidade={unidade} avaliacoes={avaliacoes} />
        </div>
      )}

      {aba === 'avaliacoes' && (
        <div className="rounded-3xl bg-white p-3 ring-1 ring-stone-200 sm:p-5">
          <PainelAvaliacoes unidade={unidade} avaliacoes={avaliacoes} />
        </div>
      )}

      {aba === 'rh' && (
      <div className="rounded-3xl bg-white p-4 ring-1 ring-stone-200 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold first-letter:uppercase">{nomeMesAno(mes)}</h3>
            {mesAtual && <p className="text-sm text-stone-500">Mês em andamento, até hoje ({dataCurta(hoje())})</p>}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-xl bg-white ring-1 ring-stone-300">
              <button onClick={() => setMes(addMeses(mes, -1))} className="px-3 py-2 font-semibold text-stone-600 hover:text-carvao" aria-label="Mês anterior">
                ‹
              </button>
              <span className="min-w-24 text-center text-sm font-semibold capitalize">{nomeMes(mes)}</span>
              <button
                onClick={() => setMes(addMeses(mes, 1))}
                disabled={mesAtual}
                className="px-3 py-2 font-semibold text-stone-600 hover:text-carvao disabled:opacity-30"
                aria-label="Próximo mês"
              >
                ›
              </button>
            </div>
            <button onClick={() => ir('rh/equipe')} className="text-sm font-semibold underline decoration-ozzy-500 decoration-2 underline-offset-4">Ver equipe</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <Indicador nome="Faltas" valor={atual.faltas} comparacao={comparacao} antes={antes.faltas} subirEhRuim destaque />
          <Indicador nome="Contratações" valor={atual.contratacoes} comparacao={comparacao} antes={antes.contratacoes} />
          <Indicador nome="Demissões" valor={atual.demissoes} comparacao={comparacao} antes={antes.demissoes} subirEhRuim />
          <Indicador nome="Funcionários ativos" valor={atual.ativos} comparacao={comparacao} antes={antes.ativos} />
          <Indicador nome="Atrasos" valor={atual.atrasos} comparacao={comparacao} antes={antes.atrasos} subirEhRuim />
          <Indicador nome="Atestados" valor={atual.atestados} comparacao={comparacao} antes={antes.atestados} subirEhRuim />
          <Indicador
            nome="Rotatividade"
            valor={atual.rotatividade}
            comparacao={comparacao} antes={antes.rotatividade}
            formato={(n) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
            dica="Média de entradas e saídas ÷ ativos"
            subirEhRuim
          />
        </div>

        {!unidade && unidades.length > 1 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm tabular-nums">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="py-2 pr-3 font-semibold">Loja</th>
                  <th className="px-2 py-2 text-right font-semibold">Ativos</th>
                  <th className="px-2 py-2 text-right font-semibold">Faltas</th>
                  <th className="px-2 py-2 text-right font-semibold">Atrasos</th>
                  <th className="px-2 py-2 text-right font-semibold">Atestados</th>
                  <th className="px-2 py-2 text-right font-semibold">Contratações</th>
                  <th className="py-2 pl-2 text-right font-semibold">Demissões</th>
                </tr>
              </thead>
              <tbody>
                {unidades.map((u) => {
                  const d = daUnidade(u.id)
                  const n = calcular(d.pessoas, d.ocorrencias, d.atestados, mes)
                  return (
                    <tr key={u.id} className="border-b border-stone-100 last:border-0">
                      <td className="py-2 pr-3 font-semibold">{apelidoUnidade(u.nome)}</td>
                      <td className="px-2 py-2 text-right">{n.ativos}</td>
                      <td className="px-2 py-2 text-right">{n.faltas}</td>
                      <td className="px-2 py-2 text-right">{n.atrasos}</td>
                      <td className="px-2 py-2 text-right">{n.atestados}</td>
                      <td className="px-2 py-2 text-right">{n.contratacoes}</td>
                      <td className="py-2 pl-2 text-right">{n.demissoes}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-stone-600">Exames de saúde (hoje)</h4>
            <button onClick={() => ir('rh/exames')} className="text-sm font-semibold underline decoration-ozzy-500 decoration-2 underline-offset-4">Ver exames</button>
          </div>
          {(() => {
            const pend = pendencias(sel.pessoas, docsSaude)
            const n = (s: string) => pend.filter((p) => p.item.situacao === s).length
            return <ResumoNumeros vencidos={n('vencido')} faltando={n('faltando')} vencendo={n('vence_logo')} aoClicar={() => ir('rh/exames')} />
          })()}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Lista titulo="Quem mais faltou">
            {faltasPorPessoa.length === 0 ? (
              <Vazio>Nenhuma falta no mês.</Vazio>
            ) : (
              faltasPorPessoa.slice(0, 5).map(([id, n]) => (
                <LinhaPessoa key={id} p={pessoa(id)} extra={`${n} falta${n > 1 ? 's' : ''}`} />
              ))
            )}
          </Lista>
          <Lista titulo="Contratados">
            {entraram.length === 0 ? <Vazio>Ninguém contratado no mês.</Vazio> : entraram.map((p) => <LinhaPessoa key={p.id} p={p} extra={dataCurta(p.dataAdmissao)} />)}
          </Lista>
          <Lista titulo="Desligados">
            {sairam.length === 0 ? <Vazio>Ninguém desligado no mês.</Vazio> : sairam.map((p) => <LinhaPessoa key={p.id} p={p} extra={dataCurta(p.dataDesligamento!)} />)}
          </Lista>
        </div>
      </div>
      )}

      {aba === 'financeiro' && (
      <div className="rounded-3xl bg-white p-4 ring-1 ring-stone-200 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold">Financeiro</h3>
          <Selo>Em breve</Selo>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {['Faturamento', 'CMV', 'Ticket médio', 'Despesas'].map((n) => (
            <div key={n} className="rounded-2xl border border-dashed border-stone-300 p-3">
              <div className="text-sm text-stone-500">{n}</div>
              <div className="mt-1 text-2xl font-bold text-stone-300">—</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-stone-500">Estes números vão vir do Lucro Fácil, por loja e por mês.</p>
      </div>
      )}
    </section>
  )
}

function Indicador({
  nome, valor, antes, comparacao, subirEhRuim = false, destaque = false, formato = (n: number) => String(n), dica,
}: {
  nome: string; valor: number; antes: number; comparacao: string; subirEhRuim?: boolean; destaque?: boolean; formato?: (n: number) => string; dica?: string
}) {
  const dif = Math.round((valor - antes) * 10) / 10
  const ruim = subirEhRuim ? dif > 0 : dif < 0
  const cor = dif === 0 ? 'text-stone-500' : ruim ? 'text-red-700' : 'text-emerald-700'
  return (
    <div className={`rounded-2xl p-3 ${destaque ? 'bg-carvao text-white' : 'bg-stone-50 ring-1 ring-stone-200'}`} title={dica}>
      <div className={`text-sm ${destaque ? 'text-stone-300' : 'text-stone-500'}`}>{nome}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${destaque ? 'text-ozzy-400' : ''}`}>{formato(valor)}</div>
      <div className={`mt-0.5 text-xs font-medium ${destaque ? (dif === 0 ? 'text-stone-400' : ruim ? 'text-red-300' : 'text-emerald-300') : cor}`}>
        {dif === 0 ? `igual (${comparacao})` : `${dif > 0 ? '+' : '−'}${formato(Math.abs(dif))} ${comparacao}`}
      </div>
    </div>
  )
}

function Lista({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-stone-600">{titulo}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function LinhaPessoa({ p, extra }: { p?: Funcionario; extra: string }) {
  if (!p) return null
  return (
    <button onClick={() => ir('rh/equipe/' + p.id)} className="flex w-full min-w-0 items-center gap-2.5 rounded-xl p-1.5 text-left hover:bg-stone-50">
      <Avatar nome={p.nome} tamanho={30} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{p.nome}</div>
        <div className="truncate text-xs text-stone-500">{p.cargo}</div>
      </div>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-stone-600">{extra}</span>
    </button>
  )
}
