import { useCallback, useEffect, useMemo, useState } from 'react'
import { Botao, Campo, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, diaSemana, hoje, inicioDaSemana } from '../lib/datas'
import { soDigitos } from '../lib/store'
import { apelidoUnidade, nomeCurto, type DiariaFreela, type Funcionario, type Freelancer, type PagamentoFreela, type TurnoFreela } from '../lib/types'
import { reais } from './Fichas'

const FUNCOES = ['Chapeiro', 'Auxiliar de cozinha', 'Pizzaiolo', 'Atendente', 'Caixa', 'Entregador', 'Limpeza']
const NOME_TURNO: Record<TurnoFreela, string> = { manha: 'Manhã', noite: 'Noite' }

export { cpfValido, formatarCpf } from '../lib/cpf'
import { cpfValido, formatarCpf } from '../lib/cpf'
import ArquivoBanco from '../components/ArquivoBanco'
import EnviosFreela from '../components/EnviosFreela'
import type { PagamentoBanco } from '../lib/sispag'

type Aba = 'lancamentos' | 'enviadas' | 'relatorio' | 'cadastro'

// Freelancer ligado a um cadastro: funcionário ativo (diária na folga) ou ex-funcionário que voltou como freela.
const vinculo = (f: Freelancer, equipe: Funcionario[]) => {
  if (!f.funcionarioId) return null
  return equipe.find((p) => p.id === f.funcionarioId)?.status === 'inativo' ? 'ex' : 'funcionario'
}

export default function Freelancers() {
  const { store, avisar } = useApp()
  const [aba, setAba] = useState<Aba>('lancamentos')
  const [semana, setSemana] = useState(inicioDaSemana(hoje()))
  const [freelas, setFreelas] = useState<Freelancer[] | null>(null)
  const [diarias, setDiarias] = useState<DiariaFreela[]>([])
  const [pagos, setPagos] = useState<PagamentoFreela[]>([])
  const [lancando, setLancando] = useState<string | null>(null)
  const [editando, setEditando] = useState<Freelancer | 'novo' | null>(null)
  const [pendentes, setPendentes] = useState(0)

  const fim = addDias(semana, 6)
  const pagamento = addDias(semana, 7)

  const carregar = useCallback(async () => {
    const [f, d, p, e] = await Promise.all([
      store.freelancers(), store.diariasFreela(semana, addDias(semana, 6)), store.pagamentosFreela(semana), store.enviosFreela('pendente'),
    ])
    setPendentes(e.length)
    setFreelas(f)
    setDiarias(d)
    setPagos(p)
  }, [store, semana])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (!freelas) return <p className="text-stone-400">Carregando…</p>

  const porId = new Map(freelas.map((f) => [f.id, f]))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Freelancers</h1>
          <p className="text-sm text-stone-500">Trabalhou de segunda a domingo, recebe na segunda seguinte.</p>
        </div>
        {aba === 'cadastro' ? (
          <Botao onClick={() => setEditando('novo')}>+ Novo freelancer</Botao>
        ) : (
          <Botao onClick={() => setLancando(semana <= hoje() && hoje() <= fim ? hoje() : semana)}>+ Lançar diária</Botao>
        )}
      </div>

      <div className="grid grid-cols-4 gap-1 rounded-xl bg-stone-200 p-1 text-sm font-semibold">
        {([['lancamentos', 'Semana'], ['enviadas', 'Enviadas'], ['relatorio', 'Pagamento'], ['cadastro', 'Cadastro']] as const).map(([a, nome]) => (
          <button key={a} onClick={() => setAba(a)} className={`flex items-center justify-center gap-1 rounded-lg py-2 ${aba === a ? 'bg-white shadow-sm' : 'text-stone-600'}`}>
            {nome}
            {a === 'enviadas' && pendentes > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[11px] leading-5 text-white">{pendentes}</span>}
          </button>
        ))}
      </div>

      {aba === 'enviadas' && <EnviosFreela freelas={freelas} aoMudar={carregar} />}

      {(aba === 'lancamentos' || aba === 'relatorio') && (
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-white p-2 ring-1 ring-stone-200">
          <button onClick={() => setSemana(addDias(semana, -7))} className="rounded-xl px-3 py-2 text-lg hover:bg-stone-100" aria-label="Semana anterior">‹</button>
          <div className="text-center">
            <div className="font-semibold">{dataCurta(semana)} a {dataCurta(fim)}</div>
            <div className="text-xs text-stone-500">Pagamento na segunda, {dataCurta(pagamento)}</div>
          </div>
          <button onClick={() => setSemana(addDias(semana, 7))} className="rounded-xl px-3 py-2 text-lg hover:bg-stone-100" aria-label="Próxima semana">›</button>
        </div>
      )}

      {aba === 'lancamentos' && (
        <Semana
          semana={semana}
          diarias={diarias}
          porId={porId}
          lancar={setLancando}
          excluir={async (d) => {
            if (!confirm(`Apagar a diária de ${nomeCurto(porId.get(d.freelancerId)?.nome ?? '')} em ${dataCurta(d.data)}?`)) return
            await store.excluirDiaria(d.id)
            await carregar()
            avisar('Diária apagada')
          }}
        />
      )}

      {aba === 'relatorio' && (
        <Relatorio
          semana={semana}
          diarias={diarias}
          pagos={pagos}
          porId={porId}
          alternarPago={async (f, total, pago) => {
            if (pago) await store.desfazerPagoFreela(f.id, semana)
            else await store.marcarPagoFreela(f.id, semana, total)
            await carregar()
            avisar(pago ? 'Pagamento desmarcado' : `${nomeCurto(f.nome)} marcado como pago`)
          }}
        />
      )}

      {aba === 'cadastro' && <Cadastro freelas={freelas} editar={setEditando} />}

      {lancando && (
        <FormDiaria
          data={lancando}
          semana={semana}
          freelas={freelas.filter((f) => f.ativo)}
          ultimas={diarias}
          aoFechar={() => setLancando(null)}
          novoFreela={() => {
            setLancando(null)
            setEditando('novo')
          }}
          aoSalvar={async () => {
            setLancando(null)
            await carregar()
            avisar('Diária lançada')
          }}
        />
      )}

      {editando && (
        <FormFreelancer
          existente={editando === 'novo' ? undefined : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={async () => {
            setEditando(null)
            await carregar()
            avisar('Cadastro salvo')
          }}
        />
      )}
    </div>
  )
}

function Semana({
  semana, diarias, porId, lancar, excluir,
}: { semana: string; diarias: DiariaFreela[]; porId: Map<string, Freelancer>; lancar: (data: string) => void; excluir: (d: DiariaFreela) => void }) {
  const { unidades } = useApp()
  const nomeLoja = (id: string) => apelidoUnidade(unidades.find((u) => u.id === id)?.nome ?? id)
  const dias = Array.from({ length: 7 }, (_, i) => addDias(semana, i))
  const total = diarias.reduce((s, d) => s + d.valor, 0)

  return (
    <div className="space-y-2">
      {dias.map((dia) => {
        const doDia = diarias.filter((d) => d.data === dia).sort((a, b) => a.turno.localeCompare(b.turno))
        return (
          <section key={dia} className={`rounded-2xl bg-white p-3 ring-1 ${dia === hoje() ? 'ring-carvao' : 'ring-stone-200'}`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">
                {diaSemana(dia)}, {dataCurta(dia)}
                {dia === hoje() && <span className="ml-2 text-xs font-bold text-stone-500 uppercase">hoje</span>}
              </h2>
              <button onClick={() => lancar(dia)} className="rounded-lg px-2 py-1 text-sm font-semibold text-stone-600 hover:bg-stone-100">
                + Lançar
              </button>
            </div>
            {doDia.length > 0 && (
              <ul className="mt-2 divide-y divide-stone-100">
                {doDia.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{porId.get(d.freelancerId)?.nome ?? 'Freelancer removido'}</div>
                      <div className="text-xs text-stone-500">
                        {NOME_TURNO[d.turno]} · {nomeLoja(d.unidadeId)} · {d.funcao}
                        {d.observacao && ` · ${d.observacao}`}
                      </div>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">{reais(d.valor)}</span>
                    <button onClick={() => excluir(d)} className="shrink-0 rounded-full p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-700" aria-label="Apagar diária">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
      <p className="text-right text-sm text-stone-600">
        {diarias.length} {diarias.length === 1 ? 'diária' : 'diárias'} na semana · <b className="text-stone-900">{reais(total)}</b>
      </p>
    </div>
  )
}

function Relatorio({
  semana, diarias, pagos, porId, alternarPago,
}: {
  semana: string; diarias: DiariaFreela[]; pagos: PagamentoFreela[]; porId: Map<string, Freelancer>
  alternarPago: (f: Freelancer, total: number, pago: boolean) => void
}) {
  const { unidades, avisar, equipe } = useApp()
  const nomeLoja = (id: string) => apelidoUnidade(unidades.find((u) => u.id === id)?.nome ?? id)
  const linhas = useMemo(() => {
    const m = new Map<string, DiariaFreela[]>()
    for (const d of diarias) m.set(d.freelancerId, [...(m.get(d.freelancerId) ?? []), d])
    return [...m.entries()]
      .map(([id, ds]) => ({ f: porId.get(id)!, ds: ds.sort((a, b) => a.data.localeCompare(b.data)), total: ds.reduce((s, d) => s + d.valor, 0) }))
      .filter((l) => l.f)
      .sort((a, b) => a.f.nome.localeCompare(b.f.nome))
  }, [diarias, porId])
  const total = linhas.reduce((s, l) => s + l.total, 0)
  const pagamento = addDias(semana, 7)
  const [pix, setPix] = useState(false)
  // Quem ainda não foi pago nesta semana, no formato do arquivo do banco (e da API, depois).
  const aPagar: PagamentoBanco[] = linhas
    .filter((l) => !pagos.some((p) => p.freelancerId === l.f.id))
    .map((l) => ({ nome: l.f.nome, cpf: l.f.cpf ?? '', chavePix: l.f.pix ?? '', valor: l.total, seuNumero: `DIARIA ${semana}` }))

  // Relatório para copiar, separado por loja. Quem trabalhou em mais de uma loja aparece em cada uma com a sua parte.
  const plural = (n: number) => `${n} ${n === 1 ? 'diária' : 'diárias'}`
  const texto = [
    `Freelancers, semana ${dataCurta(semana)} a ${dataCurta(addDias(semana, 6))} (pagar em ${dataCurta(pagamento)})`,
    ...unidades
      .filter((u) => diarias.some((d) => d.unidadeId === u.id))
      .flatMap((u) => {
        const daLoja = linhas
          .map((l) => ({ ...l, ds: l.ds.filter((d) => d.unidadeId === u.id) }))
          .filter((l) => l.ds.length)
          .map((l) => ({ ...l, total: l.ds.reduce((s, d) => s + d.valor, 0) }))
        const sub = daLoja.reduce((s, l) => s + l.total, 0)
        return [
          '',
          `*${apelidoUnidade(u.nome)}*`,
          ...daLoja.map((l) => `${l.f.nome}: ${reais(l.total)} (${plural(l.ds.length)}: ${l.ds.map((d) => `${diaSemana(d.data)} ${NOME_TURNO[d.turno].toLowerCase()}`).join(', ')}) · Pix: ${l.f.pix}`),
          `Subtotal: ${reais(sub)}`,
        ]
      }),
    '',
    `*Total geral: ${reais(total)}*`,
  ].join('\n')

  const copiar = async (t: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(t)
      avisar(msg)
    } catch {
      avisar('Não deu para copiar neste aparelho')
    }
  }

  if (!linhas.length) return <Vazio>Nenhuma diária lançada nesta semana.</Vazio>

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-carvao p-3 text-white">
          <div className="text-sm text-stone-300">Total a pagar em {dataCurta(pagamento)}</div>
          <div className="text-xl font-bold tabular-nums">{reais(total)}</div>
        </div>
        <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
          <div className="text-sm text-stone-500">Já pago</div>
          <div className="text-xl font-bold tabular-nums">{reais(pagos.reduce((s, p) => s + p.valor, 0))}</div>
        </div>
      </div>

      {linhas.map(({ f, ds, total: t }) => {
        const pago = pagos.find((p) => p.freelancerId === f.id)
        return (
          <div key={f.id} className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{f.nome}</div>
                <div className="text-xs text-stone-500">{vinculo(f, equipe) === 'funcionario' ? 'Funcionário, diária na folga' : `${vinculo(f, equipe) === 'ex' ? 'Ex-funcionário · ' : ''}${f.cpf ? `CPF ${formatarCpf(f.cpf)}` : ''}`}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-lg font-bold tabular-nums">{reais(t)}</div>
                {pago ? <Selo cor="verde">Pago</Selo> : <Selo cor="ambar">A pagar</Selo>}
              </div>
            </div>
            <ul className="mt-2 space-y-0.5 text-sm text-stone-600">
              {ds.map((d) => (
                <li key={d.id} className="flex justify-between gap-2">
                  <span>
                    {diaSemana(d.data)} {dataCurta(d.data)} · {NOME_TURNO[d.turno]} · {nomeLoja(d.unidadeId)} · {d.funcao}
                  </span>
                  <span className="tabular-nums">{reais(d.valor)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
              <span className="w-full min-w-0 text-sm sm:w-auto sm:flex-1">
                <span className="text-stone-500">Pix:</span> <b className="break-all">{f.pix}</b>
              </span>
              <Botao variante="secundario" className="py-1.5!" onClick={() => copiar(f.pix, 'Pix copiado')}>Copiar Pix</Botao>
              <Botao variante={pago ? 'fantasma' : 'primario'} className="py-1.5!" onClick={() => alternarPago(f, t, !!pago)}>
                {pago ? 'Desmarcar' : 'Marcar como pago'}
              </Botao>
            </div>
          </div>
        )
      })}

      <div className="flex flex-wrap gap-2 print:hidden">
        <Botao className="basis-full" onClick={() => setPix(true)} disabled={!aPagar.length}>Pix em lote das diárias</Botao>
        <Botao variante="secundario" className="flex-1" onClick={() => copiar(texto, 'Relatório copiado')}>Copiar relatório</Botao>
        <Botao variante="secundario" className="flex-1" onClick={() => print()}>Imprimir</Botao>
      </div>
      {pix && (
        <ArquivoBanco
          tipo="freelancer"
          referencia={semana}
          dataPagamento={pagamento}
          historico="DIARIAS"
          pagamentos={aPagar}
          aoFechar={() => setPix(false)}
        />
      )}
    </div>
  )
}

function Cadastro({ freelas, editar }: { freelas: Freelancer[]; editar: (f: Freelancer) => void }) {
  const { equipe } = useApp()
  const [busca, setBusca] = useState('')
  if (!freelas.length) return <Vazio>Nenhum freelancer cadastrado ainda.</Vazio>
  const termo = busca.trim().toLowerCase()
  const lista = freelas.filter((f) => !termo || f.nome.toLowerCase().includes(termo) || (f.cpf ?? '').includes(soDigitos(termo) || '§'))
  return (
    <div className="space-y-2">
      <input className={estiloEntrada} type="search" placeholder="Buscar por nome ou CPF" value={busca} onChange={(e) => setBusca(e.target.value)} />
      {lista.map((f) => (
        <button key={f.id} onClick={() => editar(f)} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left ring-1 ring-stone-200 hover:ring-carvao">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{f.nome}</div>
            <div className="truncate text-xs text-stone-500">{f.cpf ? `CPF ${formatarCpf(f.cpf)} · ` : ''}Pix {f.pix}</div>
          </div>
          {vinculo(f, equipe) === 'funcionario' && <Selo cor="azul">Funcionário</Selo>}
          {vinculo(f, equipe) === 'ex' && <Selo cor="ambar">Ex-funcionário</Selo>}
          {!f.ativo && <Selo>Inativo</Selo>}
        </button>
      ))}
    </div>
  )
}

function FormFreelancer({ existente, aoFechar, aoSalvar }: { existente?: Freelancer; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const [f, setF] = useState({
    nome: existente?.nome ?? '', cpf: existente?.cpf ? formatarCpf(existente.cpf) : '', pix: existente?.pix ?? '',
    celular: existente?.celular ?? '', ativo: existente?.ativo ?? true,
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (f.nome.trim().split(/\s+/).length < 2) return setErro('Coloque o nome completo.')
    const doQuadro = !!existente?.funcionarioId
    if ((!doQuadro || f.cpf) && !cpfValido(f.cpf)) return setErro('CPF inválido. Confira os números.')
    setErro('')
    setSalvando(true)
    try {
      await store.salvarFreelancer({ ...f, id: existente?.id, cpf: f.cpf || null, celular: f.celular || null, funcionarioId: existente?.funcionarioId ?? null })
      aoSalvar()
    } catch (err) {
      const msg = (err as Error).message
      setErro(/duplicate|freelancers_cpf/.test(msg) ? 'Já existe freelancer com esse CPF.' : msg)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal titulo={existente ? 'Editar freelancer' : 'Novo freelancer'} aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Nome completo">
          <input className={estiloEntrada} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required />
        </Campo>
        <Campo rotulo={existente?.funcionarioId ? 'CPF (opcional)' : 'CPF'}>
          <input
            className={estiloEntrada}
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={f.cpf}
            onChange={(e) => setF({ ...f, cpf: e.target.value })}
            onBlur={() => cpfValido(f.cpf) && setF({ ...f, cpf: formatarCpf(f.cpf) })}
            required={!existente?.funcionarioId}
          />
        </Campo>
        <Campo rotulo="Chave Pix" dica="CPF, celular, e-mail ou chave aleatória.">
          <input className={estiloEntrada} value={f.pix} onChange={(e) => setF({ ...f, pix: e.target.value })} required />
        </Campo>
        <Campo rotulo="Celular (opcional)">
          <input className={estiloEntrada} inputMode="tel" value={f.celular} onChange={(e) => setF({ ...f, celular: e.target.value })} />
        </Campo>
        {existente && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} />
            Ativo (aparece na lista para lançar diárias)
          </label>
        )}
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
      </form>
    </Modal>
  )
}

function FormDiaria({
  data, semana, freelas, ultimas, aoFechar, aoSalvar, novoFreela,
}: {
  data: string; semana: string; freelas: Freelancer[]; ultimas: DiariaFreela[]
  aoFechar: () => void; aoSalvar: () => void; novoFreela: () => void
}) {
  const { store, unidades, eu, equipe } = useApp()
  // Funcionário também pode fazer diária na folga: aparece na lista e ganha um cadastro de freelancer ao lançar.
  const semFreela = (status: Funcionario['status']) =>
    equipe.filter((f) => f.status === status && f.nivel !== 'proprietario' && !freelas.some((x) => x.funcionarioId === f.id)).sort((a, b) => a.nome.localeCompare(b.nome))
  const doQuadro = semFreela('ativo')
  // Quem saiu da empresa e voltou só como freelancer: aproveita nome, CPF e Pix do cadastro antigo.
  const exFuncionarios = semFreela('inativo')
  const [pixFunc, setPixFunc] = useState('')
  const [d, setD] = useState({
    freelancerId: '', data, turno: 'noite' as TurnoFreela, unidadeId: eu.unidadeId, funcao: '', valor: '', observacao: '',
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Sugere função e valor da última diária da mesma pessoa.
  const escolher = (freelancerId: string) => {
    setPixFunc(equipe.find((f) => 'func:' + f.id === freelancerId)?.pix ?? '')
    const ultima = [...ultimas].reverse().find((x) => x.freelancerId === freelancerId)
    setD({ ...d, freelancerId, funcao: d.funcao || ultima?.funcao || '', valor: d.valor || (ultima ? String(ultima.valor) : ''), unidadeId: ultima?.unidadeId ?? d.unidadeId })
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    const valor = Number(d.valor.replace(',', '.'))
    if (!(valor >= 0)) return setErro('Valor inválido.')
    setErro('')
    setSalvando(true)
    try {
      let freelancerId = d.freelancerId
      if (freelancerId.startsWith('func:')) {
        const func = equipe.find((f) => 'func:' + f.id === freelancerId)!
        if (!pixFunc.trim()) throw new Error(`Informe o Pix de ${func.nome.split(' ')[0]} para o pagamento.`)
        const criado = await store.salvarFreelancer({
          nome: func.nome, cpf: func.status === 'inativo' ? func.cpf ?? null : null, pix: pixFunc.trim(), celular: func.celular, ativo: true, funcionarioId: func.id,
        })
        freelancerId = criado.id
      }
      await store.lancarDiaria({ ...d, freelancerId, valor, observacao: d.observacao || null })
      aoSalvar()
    } catch (err) {
      const msg = (err as Error).message
      setErro(/duplicate|unique/.test(msg) ? 'Esse freelancer já tem diária lançada nesse dia e turno.' : msg)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal titulo="Lançar diária" aberto aoFechar={aoFechar}>
      {freelas.length === 0 && doQuadro.length === 0 && exFuncionarios.length === 0 ? (
        <div className="space-y-3">
          <Vazio>Cadastre o freelancer antes de lançar a diária.</Vazio>
          <Botao className="w-full" onClick={novoFreela}>+ Novo freelancer</Botao>
        </div>
      ) : (
        <form onSubmit={salvar} className="space-y-4">
          <Campo rotulo="Quem trabalhou">
            <select className={estiloEntrada} value={d.freelancerId} onChange={(e) => escolher(e.target.value)} required>
              <option value="">Escolha…</option>
              <optgroup label="Freelancers">
                {freelas.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}{vinculo(f, equipe) === 'funcionario' ? ' (funcionário)' : vinculo(f, equipe) === 'ex' ? ' (ex-funcionário)' : ''}</option>
                ))}
              </optgroup>
              {doQuadro.length > 0 && (
                <optgroup label="Funcionários (diária na folga)">
                  {doQuadro.map((f) => (
                    <option key={f.id} value={'func:' + f.id}>{f.nome}</option>
                  ))}
                </optgroup>
              )}
              {exFuncionarios.length > 0 && (
                <optgroup label="Ex-funcionários (voltaram como freela)">
                  {exFuncionarios.map((f) => (
                    <option key={f.id} value={'func:' + f.id}>{f.nome}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </Campo>
          {d.freelancerId.startsWith('func:') && (
            <Campo rotulo="Pix para a diária" dica="Vem do cadastro do funcionário; dá para trocar aqui.">
              <input className={estiloEntrada} value={pixFunc} onChange={(e) => setPixFunc(e.target.value)} required />
            </Campo>
          )}
          <button type="button" onClick={novoFreela} className="-mt-2 text-sm font-semibold text-sky-700">Não está na lista? Cadastrar</button>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Dia">
              <input className={estiloEntrada} type="date" min={addDias(semana, -28)} value={d.data} onChange={(e) => setD({ ...d, data: e.target.value })} required />
            </Campo>
            {/* div e não Campo: um <label> em volta de botões aciona o primeiro ao tocar em qualquer lugar. */}
            <div>
              <span className="mb-1 block text-sm font-medium text-stone-700">Turno</span>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1">
                {(['manha', 'noite'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setD({ ...d, turno: t })} className={`rounded-lg py-2 text-sm font-semibold ${d.turno === t ? 'bg-carvao text-white' : 'text-stone-600'}`}>
                    {NOME_TURNO[t]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Campo rotulo="Loja">
            <select className={estiloEntrada} value={d.unidadeId} onChange={(e) => setD({ ...d, unidadeId: e.target.value })}>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Função">
              <input className={estiloEntrada} list="funcoes-freela" value={d.funcao} onChange={(e) => setD({ ...d, funcao: e.target.value })} required />
              <datalist id="funcoes-freela">
                {FUNCOES.map((f) => <option key={f} value={f} />)}
              </datalist>
            </Campo>
            <Campo rotulo="Valor (R$)">
              <input className={estiloEntrada} inputMode="decimal" placeholder="0,00" value={d.valor} onChange={(e) => setD({ ...d, valor: e.target.value })} required />
            </Campo>
          </div>
          <Campo rotulo="Observação (opcional)">
            <input className={estiloEntrada} placeholder="Ex.: ficou até mais tarde" value={d.observacao} onChange={(e) => setD({ ...d, observacao: e.target.value })} />
          </Campo>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <Botao className="w-full" disabled={salvando}>{salvando ? 'Salvando…' : 'Lançar'}</Botao>
        </form>
      )}
    </Modal>
  )
}
