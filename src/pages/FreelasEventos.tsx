import { useCallback, useEffect, useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import { Botao, Campo, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import Impressao from '../components/Impressao'
import ArquivoBanco from '../components/ArquivoBanco'
import { useApp } from '../lib/contexto'
import { cpfValido, formatarCpf } from '../lib/cpf'
import { dataCurta, diaSemana, hoje } from '../lib/datas'
import { lerNumero, reais } from '../lib/financeiro'
import { ir } from '../lib/rota'
import { pegarLocalizacao, soDigitos } from '../lib/store'
import type { PagamentoBanco } from '../lib/sispag'
import { nomeCurto, type DiariaFreelaEvento, type Evento, type FreelaEvento } from '../lib/types'
import logo from '../assets/logo.png'

// Freelancers de eventos (pedido de 08/10): base separada da das lojas. Mesmo formato (link e cartaz com QR Code,
// CPF e celular, aprovação pela gestão), mas a diária é por dia de evento e o valor é o do evento (ou o do freela).

export const FUNCOES_EVENTO = ['Pizzaiolo', 'Forneiro', 'Auxiliar de cozinha', 'Atendente', 'Caixa', 'Chapeiro', 'Montagem', 'Limpeza']
export const linkDiariaEvento = () => `${location.origin}${location.pathname}#/diaria-evento`
const numero = (t: string) => lerNumero(t) ?? 0
const horaDe = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const diaDe = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
const km = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`)

// Valor sugerido: o do cadastro do freela; senão o do evento.
export const valorSugerido = (f: FreelaEvento | undefined, e: Evento | undefined) => f?.valorDiaria ?? e?.diariaFreela ?? null

function Presenca({ d, e }: { d: DiariaFreelaEvento; e: Evento | undefined }) {
  if (d.origem === 'gestao') return <div className="text-xs text-stone-500">Lançada pela gestão</div>
  if (d.noLocal) return <div className="text-xs font-semibold text-emerald-700">✓ Enviada do evento às {horaDe(d.enviadoEm)}</div>
  const quando = diaDe(d.enviadoEm) !== d.data ? `em ${dataCurta(diaDe(d.enviadoEm))} às ${horaDe(d.enviadoEm)}` : `às ${horaDe(d.enviadoEm)}`
  if (e && e.latitude === null) return <div className="text-xs text-stone-500">Enviada {quando} (local do evento não marcado)</div>
  const onde = d.distanciaM !== null ? `a ${km(d.distanciaM)} do evento` : 'sem localização'
  return <div className="text-xs font-semibold text-amber-700">⚠ Enviada fora do evento ({onde}), {quando}. Confira com o responsável.</div>
}

// Página do módulo: Enviadas (para aprovar), Cadastro e o link/cartaz.
export default function FreelasEventos() {
  const { store } = useApp()
  const [aba, setAba] = useState<'enviadas' | 'cadastro'>('enviadas')
  const [freelas, setFreelas] = useState<FreelaEvento[] | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [editando, setEditando] = useState<FreelaEvento | 'novo' | null>(null)
  const [erro, setErro] = useState('')
  const carregar = useCallback(async () => {
    try {
      const [f, e] = await Promise.all([store.freelasEvento(), store.eventos()])
      setFreelas(f)
      setEventos(e)
    } catch (err) {
      setErro((err as Error).message)
    }
  }, [store])
  useEffect(() => {
    carregar()
  }, [carregar])
  if (erro) return <p className="text-red-600">{erro}</p>
  if (!freelas) return <p className="text-stone-400">Carregando…</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Freelancers de eventos</h2>
          <p className="text-sm text-stone-600">Base separada da das lojas. O valor da diária é o do evento (ou o do freela, quando tem valor próprio). Os pagamentos ficam na aba Freelas de cada evento.</p>
        </div>
        {aba === 'cadastro' && <Botao onClick={() => setEditando('novo')}>+ Novo freela</Botao>}
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-200 p-1 text-sm font-semibold">
        {([['enviadas', 'Enviadas'], ['cadastro', 'Cadastro']] as const).map(([a, nome]) => (
          <button key={a} onClick={() => setAba(a)} className={`rounded-lg py-2 ${aba === a ? 'bg-white shadow-sm' : 'text-stone-600'}`}>{nome}</button>
        ))}
      </div>
      {aba === 'enviadas' ? (
        <>
          <LinkDiariaEvento />
          <PendentesEvento freelas={freelas} eventos={eventos} aoMudar={carregar} />
        </>
      ) : (
        <CadastroFreelas freelas={freelas} editar={setEditando} />
      )}
      {editando && (
        <FormFreelaEvento
          existente={editando === 'novo' ? undefined : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={async () => {
            setEditando(null)
            await carregar()
          }}
        />
      )}
    </div>
  )
}

// Um link só para todos os eventos: a pessoa escolhe o evento no formulário.
function LinkDiariaEvento() {
  const { avisar } = useApp()
  const [cartaz, setCartaz] = useState(false)
  const link = linkDiariaEvento()
  const qr = useMemo(() => {
    const q = qrcode(0, 'M')
    q.addData(link)
    q.make()
    return q.createDataURL(8, 2)
  }, [link])
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link)
      avisar('Link copiado')
    } catch {
      avisar('Não deu para copiar neste aparelho')
    }
  }
  return (
    <details className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
      <summary className="cursor-pointer text-sm font-semibold">Link para os freelas de evento mandarem as diárias</summary>
      <p className="mt-2 text-sm text-stone-600">
        Diferente do link das lojas. Mande no grupo dos freelas do evento ou cole o cartaz na barraca. A pessoa entra com CPF e celular,
        escolhe o evento, marca os dias e a diária aparece aqui para aprovar. Mandada do evento, no dia, vale como presença.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Botao variante="secundario" className="py-1.5!" onClick={copiar}>Copiar link</Botao>
        <Botao variante="secundario" className="py-1.5!" onClick={() => setCartaz(true)}>Cartaz com QR Code</Botao>
        <a href={link} target="_blank" rel="noreferrer" className="text-sm font-semibold text-sky-700">Abrir</a>
      </div>
      {cartaz && (
        <Impressao titulo="Cartaz das diárias de evento" aoFechar={() => setCartaz(false)}>
          <div className="flex flex-col items-center gap-6 py-6 text-center">
            <img src={logo} alt="The Ozzy" className="h-24 w-24" />
            <div>
              <div className="text-3xl font-bold">Trabalhou no evento?</div>
              <div className="mt-2 text-xl">Mande aqui os dias que você trabalhou</div>
            </div>
            <img src={qr} alt="QR Code" className="h-72 w-72" style={{ imageRendering: 'pixelated' }} />
            <div className="rounded-xl border-2 border-black px-5 py-3 text-xl font-bold">Mande daqui do evento, no dia: vale como presença.</div>
            <div className="text-lg">Aponte a câmera do celular</div>
            <div className="max-w-md text-sm text-stone-600">Você vai precisar do CPF, do celular e da chave Pix. A gestão confere e aprova; o pagamento cai por Pix.</div>
          </div>
        </Impressao>
      )}
    </details>
  )
}

interface Grupo {
  chave: string
  nome: string
  diarias: DiariaFreelaEvento[]
  cadastro: FreelaEvento | undefined
  pixNovo: boolean
  celularOutro: boolean
}

// Diárias mandadas pelo link esperando aprovação (de todos os eventos, ou de um).
export function PendentesEvento({ freelas, eventos, eventoId, aoMudar }: { freelas: FreelaEvento[]; eventos: Evento[]; eventoId?: string; aoMudar: () => void }) {
  const { store, avisar } = useApp()
  const [lista, setLista] = useState<DiariaFreelaEvento[] | null>(null)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [usarPix, setUsarPix] = useState<Record<string, boolean>>({})
  const [ocupado, setOcupado] = useState(false)
  const carregar = useCallback(async () => {
    const ds = await store.diariasFreelaEvento({ status: 'pendente' })
    setLista(eventoId ? ds.filter((d) => d.eventoId === eventoId) : ds)
  }, [store, eventoId])
  useEffect(() => {
    carregar()
  }, [carregar])

  const grupos = useMemo<Grupo[]>(() => {
    const m = new Map<string, DiariaFreelaEvento[]>()
    for (const d of lista ?? []) m.set(d.cpf, [...(m.get(d.cpf) ?? []), d])
    return [...m.entries()].map(([chave, ds]) => {
      const d = ds[ds.length - 1]
      const cadastro = freelas.find((f) => f.id === d.freelaId || f.cpf === d.cpf)
      return {
        chave, nome: d.nome ?? cadastro?.nome ?? '', diarias: ds, cadastro,
        pixNovo: !!cadastro && !!d.pix && cadastro.pix.trim() !== d.pix.trim(),
        celularOutro: !!cadastro?.celular && !!d.celular && cadastro.celular.slice(-11) !== d.celular.slice(-11),
      }
    }).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [lista, freelas])

  const evento = (id: string) => eventos.find((e) => e.id === id)
  const valorDe = (g: Grupo, d: DiariaFreelaEvento) => valores[d.id] ?? String(valorSugerido(g.cadastro, evento(d.eventoId)) ?? '').replace('.', ',')
  const pixDo = (g: Grupo) => usarPix[g.chave] ?? !g.celularOutro

  const aprovar = async (g: Grupo, ds: DiariaFreelaEvento[]) => {
    const comValor = ds.map((d) => ({ d, valor: numero(valorDe(g, d)) }))
    if (comValor.some((x) => !valorDe(g, x.d).trim() || !(x.valor >= 0))) return avisar('Coloque o valor de cada diária antes de aprovar.')
    setOcupado(true)
    try {
      for (const { d, valor } of comValor) await store.aprovarDiariaFreelaEvento(d.id, valor, d.funcao, g.pixNovo && pixDo(g))
      avisar(ds.length === 1 ? 'Diária aprovada' : `${ds.length} diárias aprovadas`)
      await carregar()
      aoMudar()
    } catch (err) {
      avisar((err as Error).message)
    } finally {
      setOcupado(false)
    }
  }
  const recusar = async (d: DiariaFreelaEvento) => {
    const motivo = prompt(`Recusar a diária de ${(d.nome ?? '').split(' ')[0]} em ${dataCurta(d.data)}? Diga o motivo:`, 'Não trabalhou nesse dia')
    if (motivo === null) return
    setOcupado(true)
    try {
      await store.recusarDiariaFreelaEvento(d.id, motivo)
      avisar('Diária recusada')
      await carregar()
      aoMudar()
    } finally {
      setOcupado(false)
    }
  }

  if (!lista) return <p className="text-stone-400">Carregando…</p>
  if (!grupos.length) return eventoId ? null : <Vazio>Nenhuma diária de evento esperando aprovação.</Vazio>
  return (
    <div className="space-y-3">
      {eventoId && <h3 className="font-bold">Esperando aprovação</h3>}
      {grupos.map((g) => (
        <div key={g.chave} className="rounded-2xl bg-white p-4 ring-1 ring-amber-300">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold">{g.nome}</div>
              <div className="text-xs text-stone-500">CPF {formatarCpf(g.chave)} · Pix {g.diarias[0].pix}</div>
            </div>
            <div className="flex flex-wrap gap-1">
              {!g.cadastro && <Selo cor="ambar">Primeira vez</Selo>}
              {g.cadastro?.valorDiaria != null && <Selo cor="azul">Valor próprio {reais(g.cadastro.valorDiaria)}</Selo>}
              {g.celularOutro && <Selo cor="vermelho">Celular diferente do cadastro</Selo>}
            </div>
          </div>
          {g.pixNovo && (
            <label className={`mt-2 flex items-start gap-2 rounded-xl p-2 text-sm ${g.celularOutro ? 'bg-red-50 text-red-900' : 'bg-amber-50 text-amber-900'}`}>
              <input type="checkbox" className="mt-1" checked={pixDo(g)} onChange={(e) => setUsarPix({ ...usarPix, [g.chave]: e.target.checked })} />
              <span>
                Trocar o Pix do cadastro (<b className="break-all">{g.cadastro!.pix}</b>) pelo novo (<b className="break-all">{g.diarias[0].pix}</b>).
                {g.celularOutro && ' Atenção: veio de outro celular. Confirme com a pessoa antes.'}
              </span>
            </label>
          )}
          <ul className="mt-2 divide-y divide-stone-100">
            {g.diarias.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 py-2">
                <div className="min-w-0 flex-1 basis-full text-sm sm:basis-auto">
                  <div className="font-medium">{diaSemana(d.data)} {dataCurta(d.data)} · {d.funcao}</div>
                  {!eventoId && <div className="text-xs text-stone-500">{evento(d.eventoId)?.nome ?? 'Evento'}</div>}
                  {d.observacao && <div className="text-xs text-stone-500">{d.observacao}</div>}
                  <Presenca d={d} e={evento(d.eventoId)} />
                </div>
                <input
                  className={`${estiloEntrada} w-24! py-1.5! max-sm:ml-auto`}
                  inputMode="decimal"
                  placeholder="R$"
                  aria-label="Valor da diária"
                  value={valorDe(g, d)}
                  onChange={(ev) => setValores({ ...valores, [d.id]: ev.target.value })}
                />
                <Botao className="py-1.5!" disabled={ocupado} onClick={() => aprovar(g, [d])}>Aprovar</Botao>
                <button disabled={ocupado} onClick={() => recusar(d)} className="rounded-full p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-700" aria-label="Recusar diária">✕</button>
              </li>
            ))}
          </ul>
          {g.diarias.length > 1 && (
            <Botao variante="secundario" className="mt-2 w-full" disabled={ocupado} onClick={() => aprovar(g, g.diarias)}>
              Aprovar as {g.diarias.length} ({reais(g.diarias.reduce((s, d) => s + (numero(valorDe(g, d)) || 0), 0))})
            </Botao>
          )}
          {!eventoId && (
            <button className="mt-2 text-xs font-semibold text-sky-700" onClick={() => ir(`eventos/${g.diarias[0].eventoId}/freelas`)}>Ver o evento</button>
          )}
        </div>
      ))}
    </div>
  )
}

function CadastroFreelas({ freelas, editar }: { freelas: FreelaEvento[]; editar: (f: FreelaEvento) => void }) {
  const [busca, setBusca] = useState('')
  if (!freelas.length) return <Vazio>Nenhum freela de evento cadastrado ainda. Quem manda a primeira diária pelo link entra aqui quando a gestão aprova.</Vazio>
  const termo = busca.trim().toLowerCase()
  const lista = freelas.filter((f) => !termo || f.nome.toLowerCase().includes(termo) || f.cpf.includes(soDigitos(termo) || '§') || (f.funcao ?? '').toLowerCase().includes(termo))
  return (
    <div className="space-y-2">
      <input className={estiloEntrada} type="search" placeholder="Buscar por nome, CPF ou função" value={busca} onChange={(e) => setBusca(e.target.value)} />
      {lista.map((f) => (
        <button key={f.id} onClick={() => editar(f)} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left ring-1 ring-stone-200 hover:ring-carvao">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{f.nome}</div>
            <div className="truncate text-xs text-stone-500">{f.funcao ? `${f.funcao} · ` : ''}CPF {formatarCpf(f.cpf)} · Pix {f.pix}</div>
          </div>
          {f.valorDiaria !== null && <Selo cor="azul">{reais(f.valorDiaria)}</Selo>}
          {!f.ativo && <Selo>Inativo</Selo>}
        </button>
      ))}
    </div>
  )
}

function FormFreelaEvento({ existente, aoFechar, aoSalvar }: { existente?: FreelaEvento; aoFechar: () => void; aoSalvar: () => void }) {
  const { store, avisar } = useApp()
  const [f, setF] = useState({
    nome: existente?.nome ?? '', cpf: existente ? formatarCpf(existente.cpf) : '', pix: existente?.pix ?? '', celular: existente?.celular ?? '',
    funcao: existente?.funcao ?? '', valor: existente?.valorDiaria == null ? '' : String(existente.valorDiaria).replace('.', ','),
    observacao: existente?.observacao ?? '', ativo: existente?.ativo ?? true,
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (f.nome.trim().split(/\s+/).length < 2) return setErro('Coloque o nome completo.')
    if (!cpfValido(f.cpf)) return setErro('CPF inválido. Confira os números.')
    if (f.celular && soDigitos(f.celular).length < 10) return setErro('Coloque o celular com DDD.')
    const valor = f.valor.trim() ? numero(f.valor) : null
    if (valor !== null && !(valor >= 0)) return setErro('Confira o valor da diária.')
    setErro('')
    setSalvando(true)
    try {
      await store.salvarFreelaEvento({
        id: existente?.id, nome: f.nome, cpf: soDigitos(f.cpf), pix: f.pix, celular: f.celular || null, funcao: f.funcao || null,
        valorDiaria: valor, observacao: f.observacao || null, ativo: f.ativo,
      })
      avisar('Cadastro salvo')
      aoSalvar()
    } catch (err) {
      const msg = (err as Error).message
      setErro(/duplicate|cpf_key/.test(msg) ? 'Já existe freela de evento com esse CPF.' : msg)
    } finally {
      setSalvando(false)
    }
  }
  return (
    <Modal titulo={existente ? 'Editar freela de evento' : 'Novo freela de evento'} aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <Campo rotulo="Nome completo">
          <input className={estiloEntrada} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="CPF">
            <input className={estiloEntrada} inputMode="numeric" placeholder="000.000.000-00" value={f.cpf} onChange={(e) => setF({ ...f, cpf: e.target.value })}
              onBlur={() => cpfValido(f.cpf) && setF({ ...f, cpf: formatarCpf(f.cpf) })} required />
          </Campo>
          <Campo rotulo="Celular">
            <input className={estiloEntrada} inputMode="tel" value={f.celular} onChange={(e) => setF({ ...f, celular: e.target.value })} />
          </Campo>
        </div>
        <Campo rotulo="Chave Pix" dica="CPF, celular, e-mail ou chave aleatória.">
          <input className={estiloEntrada} value={f.pix} onChange={(e) => setF({ ...f, pix: e.target.value })} required />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Função">
            <input className={estiloEntrada} list="funcoes-evento" value={f.funcao} onChange={(e) => setF({ ...f, funcao: e.target.value })} />
            <datalist id="funcoes-evento">{FUNCOES_EVENTO.map((x) => <option key={x} value={x} />)}</datalist>
          </Campo>
          <Campo rotulo="Diária própria (R$)" dica="Vazio = valor do evento">
            <input className={estiloEntrada} inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />
          </Campo>
        </div>
        <Campo rotulo="Observação">
          <input className={estiloEntrada} value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} placeholder="Ex.: só fins de semana" />
        </Campo>
        {existente && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> Ativo
          </label>
        )}
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
      </form>
    </Modal>
  )
}

// Aba "Freelas" de um evento: quem trabalhou em cada dia, quanto dá, pagamento (marcar pago, Pix em lote) e o local do evento.
export function FreelasDoEvento({ e, aoMudarEvento }: { e: Evento; aoMudarEvento: () => Promise<void> }) {
  const { store, avisar } = useApp()
  const [freelas, setFreelas] = useState<FreelaEvento[] | null>(null)
  const [diarias, setDiarias] = useState<DiariaFreelaEvento[]>([])
  const [lancando, setLancando] = useState(false)
  const [pix, setPix] = useState(false)
  const [marcando, setMarcando] = useState(false)
  const carregar = useCallback(async () => {
    const [f, d] = await Promise.all([store.freelasEvento(), store.diariasFreelaEvento({ eventoId: e.id })])
    setFreelas(f)
    setDiarias(d.filter((x) => x.status === 'aprovado'))
  }, [store, e.id])
  useEffect(() => {
    carregar()
  }, [carregar])
  if (!freelas) return <p className="text-stone-400">Carregando…</p>

  const porId = new Map(freelas.map((f) => [f.id, f]))
  const pessoas = [...new Set(diarias.map((d) => d.freelaId!))]
    .map((id) => {
      const ds = diarias.filter((d) => d.freelaId === id)
      return { f: porId.get(id), id, ds, total: ds.reduce((s, d) => s + (d.valor ?? 0), 0), pago: ds.every((d) => d.pagoEm) }
    })
    .sort((a, b) => (a.f?.nome ?? '').localeCompare(b.f?.nome ?? ''))
  const total = pessoas.reduce((s, p) => s + p.total, 0)
  const pago = pessoas.filter((p) => p.pago).reduce((s, p) => s + p.total, 0)
  const aPagar: PagamentoBanco[] = pessoas
    .filter((p) => !p.pago && p.f)
    .map((p) => ({ nome: p.f!.nome, cpf: p.f!.cpf, chavePix: p.f!.pix, valor: p.total, seuNumero: `EVENTO ${e.numero}` }))

  const marcarLocal = async () => {
    if (!confirm(`Você está no local do evento agora? O local do seu celular vai virar o local de ${e.nome}.`)) return
    setMarcando(true)
    try {
      const local = await pegarLocalizacao()
      if (!local) return avisar('Não deu para pegar a localização. Permita a localização no navegador e tente de novo.')
      if (local.precisao && local.precisao > 300) return avisar(`Localização imprecisa (${local.precisao} m). Ligue o GPS e tente de novo.`)
      await store.definirLocalEvento(e.id, local.lat, local.lng)
      await aoMudarEvento()
      avisar('Local do evento marcado')
    } catch (err) {
      avisar((err as Error).message)
    } finally {
      setMarcando(false)
    }
  }

  const texto = [
    `Freelas · ${e.nome}`,
    ...pessoas.map((p) => `${p.f?.nome ?? 'Freela'}: ${reais(p.total)} (${p.ds.length} ${p.ds.length === 1 ? 'diária' : 'diárias'}: ${p.ds.map((d) => dataCurta(d.data)).join(', ')}) · Pix: ${p.f?.pix ?? ''}${p.pago ? ' · PAGO' : ''}`),
    '',
    `*Total: ${reais(total)}*`,
  ].join('\n')
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto)
      avisar('Relatório copiado')
    } catch {
      avisar('Não deu para copiar neste aparelho')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 text-sm ring-1 ring-stone-200">
        <span className="min-w-0 flex-1">
          Diária deste evento: <b>{e.diariaFreela === null ? 'não definida' : reais(e.diariaFreela)}</b>
          {e.diariaFreela === null && <span className="text-stone-500"> (defina em Resumo › Editar)</span>}
          <span className="block text-xs text-stone-500">
            {e.latitude === null ? 'Local do evento não marcado: as diárias chegam sem conferência de presença.' : 'Local marcado: diária mandada de lá, no dia, vale como presença.'}
          </span>
        </span>
        <Botao variante="secundario" className="py-1.5!" disabled={marcando} onClick={marcarLocal}>
          {marcando ? 'Pegando…' : e.latitude === null ? 'Marcar local (estando lá)' : 'Marcar local de novo'}
        </Botao>
      </div>

      <PendentesEvento freelas={freelas} eventos={[e]} eventoId={e.id} aoMudar={carregar} />

      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="font-bold">Diárias aprovadas</h3>
        <Botao variante="secundario" onClick={() => setLancando(true)}>+ Lançar diária</Botao>
      </div>
      {!pessoas.length ? (
        <Vazio>Nenhuma diária aprovada neste evento. As do link aparecem acima para aprovar; a gestão também pode lançar.</Vazio>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-carvao p-3 text-white">
              <div className="text-sm text-stone-300">Total de freelas</div>
              <div className="text-xl font-bold tabular-nums">{reais(total)}</div>
            </div>
            <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
              <div className="text-sm text-stone-500">Já pago</div>
              <div className="text-xl font-bold tabular-nums">{reais(pago)}</div>
            </div>
          </div>
          {e.dias.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs text-stone-600">
              {e.dias.map((dia) => {
                const n = diarias.filter((d) => d.data === dia.data).length
                return <span key={dia.data} className="rounded-lg bg-stone-100 px-2 py-1">{diaSemana(dia.data)} {dataCurta(dia.data)}: <b>{n}</b> {n === 1 ? 'freela' : 'freelas'}</span>
              })}
            </div>
          )}
          {pessoas.map((p) => (
            <div key={p.id} className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{p.f?.nome ?? 'Freela removido'}</div>
                  <div className="text-xs text-stone-500">{p.f ? `CPF ${formatarCpf(p.f.cpf)}` : ''}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-bold tabular-nums">{reais(p.total)}</div>
                  {p.pago ? <Selo cor="verde">Pago</Selo> : <Selo cor="ambar">A pagar</Selo>}
                </div>
              </div>
              <ul className="mt-2 space-y-0.5 text-sm text-stone-600">
                {p.ds.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2">
                    <span>{diaSemana(d.data)} {dataCurta(d.data)} · {d.funcao}{d.observacao && ` · ${d.observacao}`}</span>
                    <span className="flex items-center gap-1 tabular-nums">
                      {reais(d.valor ?? 0)}
                      {!d.pagoEm && (
                        <button
                          className="rounded-full p-1 text-stone-400 hover:bg-red-50 hover:text-red-700"
                          aria-label="Apagar diária"
                          onClick={async () => {
                            if (!confirm(`Apagar a diária de ${nomeCurto(p.f?.nome ?? '')} em ${dataCurta(d.data)}?`)) return
                            await store.excluirDiariaFreelaEvento(d.id)
                            await carregar()
                            avisar('Diária apagada')
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
                <span className="w-full min-w-0 text-sm sm:w-auto sm:flex-1">
                  <span className="text-stone-500">Pix:</span> <b className="break-all">{p.f?.pix}</b>
                </span>
                <Botao
                  variante={p.pago ? 'fantasma' : 'primario'}
                  className="py-1.5!"
                  onClick={async () => {
                    await store.marcarPagoFreelaEvento(e.id, p.id, !p.pago)
                    await carregar()
                    avisar(p.pago ? 'Pagamento desmarcado' : `${nomeCurto(p.f?.nome ?? '')} marcado como pago`)
                  }}
                >
                  {p.pago ? 'Desmarcar' : 'Marcar como pago'}
                </Botao>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 print:hidden">
            <Botao className="basis-full" onClick={() => setPix(true)} disabled={!aPagar.length}>Pix em lote dos freelas do evento</Botao>
            <Botao variante="secundario" className="flex-1" onClick={copiar}>Copiar relatório</Botao>
            <Botao variante="secundario" className="flex-1" onClick={() => print()}>Imprimir</Botao>
          </div>
        </>
      )}
      {pix && (
        <ArquivoBanco tipo="freelancer" referencia={`evento-${e.numero}`} dataPagamento={hoje()} historico="DIARIAS EVENTO" pagamentos={aPagar} aoFechar={() => setPix(false)} />
      )}
      {lancando && (
        <LancarDiariaEvento
          e={e}
          freelas={freelas.filter((f) => f.ativo)}
          aoFechar={() => setLancando(false)}
          aoSalvar={async () => {
            setLancando(false)
            await carregar()
            avisar('Diária lançada')
          }}
        />
      )}
    </div>
  )
}

function LancarDiariaEvento({ e, freelas, aoFechar, aoSalvar }: { e: Evento; freelas: FreelaEvento[]; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  // Só dias que já aconteceram (o freela também manda pelo link no próprio dia).
  const dias = e.dias.map((d) => d.data).filter((x) => x <= hoje())
  const [d, setD] = useState({ freelaId: '', datas: [] as string[], funcao: '', valor: '', observacao: '' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const escolher = (id: string) => {
    const f = freelas.find((x) => x.id === id)
    setD({ ...d, freelaId: id, funcao: d.funcao || f?.funcao || '', valor: String(valorSugerido(f, e) ?? '').replace('.', ',') })
  }
  const salvar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const valor = numero(d.valor)
    if (!d.freelaId) return setErro('Escolha quem trabalhou.')
    if (!d.datas.length) return setErro('Marque pelo menos um dia.')
    if (!d.valor.trim() || !(valor >= 0)) return setErro('Coloque o valor da diária.')
    if (!d.funcao.trim()) return setErro('Diga a função.')
    setErro('')
    setSalvando(true)
    try {
      for (const data of d.datas) await store.lancarDiariaFreelaEvento({ eventoId: e.id, freelaId: d.freelaId, data, funcao: d.funcao, valor, observacao: d.observacao || null })
      aoSalvar()
    } catch (err) {
      const msg = (err as Error).message
      setErro(/duplicate|unique/.test(msg) ? 'Essa pessoa já tem diária num desses dias.' : msg)
      setSalvando(false)
    }
  }
  return (
    <Modal titulo="Lançar diária de freela" aberto aoFechar={aoFechar}>
      {!freelas.length ? (
        <Vazio>Cadastre o freela em Eventos › Freelancers › Cadastro antes de lançar.</Vazio>
      ) : !dias.length ? (
        <Vazio>O evento ainda não começou: lance a diária no dia ou depois.</Vazio>
      ) : (
        <form onSubmit={salvar} className="space-y-4">
          <Campo rotulo="Quem trabalhou">
            <select className={estiloEntrada} value={d.freelaId} onChange={(ev) => escolher(ev.target.value)} required>
              <option value="">Escolha…</option>
              {freelas.map((f) => <option key={f.id} value={f.id}>{f.nome}{f.funcao ? ` (${f.funcao})` : ''}</option>)}
            </select>
          </Campo>
          <div>
            <span className="mb-1 block text-sm font-medium text-stone-700">Dias</span>
            <div className="flex flex-wrap gap-1">
              {dias.map((x) => {
                const marcado = d.datas.includes(x)
                return (
                  <button key={x} type="button" aria-pressed={marcado} onClick={() => setD({ ...d, datas: marcado ? d.datas.filter((y) => y !== x) : [...d.datas, x] })}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${marcado ? 'bg-carvao text-white' : 'bg-stone-100 text-stone-600'}`}>
                    {diaSemana(x)} {dataCurta(x)}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Função">
              <input className={estiloEntrada} list="funcoes-evento-l" value={d.funcao} onChange={(ev) => setD({ ...d, funcao: ev.target.value })} required />
              <datalist id="funcoes-evento-l">{FUNCOES_EVENTO.map((x) => <option key={x} value={x} />)}</datalist>
            </Campo>
            <Campo rotulo="Valor por dia (R$)">
              <input className={estiloEntrada} inputMode="decimal" value={d.valor} onChange={(ev) => setD({ ...d, valor: ev.target.value })} required />
            </Campo>
          </div>
          <Campo rotulo="Observação (opcional)">
            <input className={estiloEntrada} value={d.observacao} onChange={(ev) => setD({ ...d, observacao: ev.target.value })} />
          </Campo>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <Botao className="w-full" disabled={salvando}>{salvando ? 'Salvando…' : d.datas.length > 1 ? `Lançar ${d.datas.length} diárias` : 'Lançar'}</Botao>
        </form>
      )}
    </Modal>
  )
}
