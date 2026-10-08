import { useCallback, useEffect, useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import { Botao, Selo, Vazio, estiloEntrada } from './ui'
import Impressao from './Impressao'
import { NOME_TURNO } from './CamposDiaria'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, diaSemana, inicioDaSemana } from '../lib/datas'
import { pegarLocalizacao, soDigitos } from '../lib/store'
import { apelidoUnidade, type EnvioFreela, type Freelancer, type LocalLoja } from '../lib/types'
import { formatarCpf } from '../lib/cpf'
import logo from '../assets/logo.png'

const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
// O link antigo com a loja no fim (#/diaria/<loja>) continua abrindo, já com a loja escolhida.
export const linkDiaria = () => `${location.origin}${location.pathname}#/diaria`

// A semana trabalhada fecha no domingo às 22h (horário de Brasília); depois disso o envio chegou atrasado.
const foraDoPrazo = (e: EnvioFreela) => {
  const domingo = addDias(inicioDaSemana(e.data), 6)
  return new Date(e.enviadoEm) > new Date(`${domingo}T22:00:00-03:00`)
}

const horaDe = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const diaDe = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
const km = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`)

// Presença: mandada de dentro da loja, no dia, vale como chegada. O resto a gerente confere antes de aprovar.
function Presenca({ e }: { e: EnvioFreela }) {
  if (e.naLoja) return <div className="text-xs font-semibold text-emerald-700">✓ Enviada da loja às {horaDe(e.enviadoEm)}</div>
  const quando = diaDe(e.enviadoEm) !== e.data ? `em ${dataCurta(diaDe(e.enviadoEm))} às ${horaDe(e.enviadoEm)}` : `às ${horaDe(e.enviadoEm)}`
  // Da loja, mas em outro dia: estava lá, só não prova o dia trabalhado.
  if (e.distanciaLojaM !== null && e.distanciaLojaM <= 150)
    return <div className="text-xs font-semibold text-amber-700">⚠ Enviada da loja, mas só {quando}. Confira com o supervisor.</div>
  const onde = e.distanciaLojaM !== null ? `a ${km(e.distanciaLojaM)} da loja` : 'sem localização'
  return <div className="text-xs font-semibold text-red-700">⚠ Enviada fora da loja ({onde}), {quando}. Confira com o supervisor.</div>
}

interface Grupo {
  chave: string
  nome: string
  envios: EnvioFreela[]
  cadastro: Freelancer | undefined
  funcionario: boolean
  pixNovo: boolean
  celularOutro: boolean
}

// Diárias que os próprios freelancers (pelo link) e funcionários (pelo login) mandaram, para a gestão aprovar.
export default function EnviosFreela({ freelas, aoMudar }: { freelas: Freelancer[]; aoMudar: () => void }) {
  const { store, unidades, avisar } = useApp()
  const [envios, setEnvios] = useState<EnvioFreela[] | null>(null)
    const [valores, setValores] = useState<Record<string, string>>({})
  const [usarPix, setUsarPix] = useState<Record<string, boolean>>({})
  const [ocupado, setOcupado] = useState(false)

  const carregar = useCallback(async () => {
    setEnvios(await store.enviosFreela('pendente'))
  }, [store])
  useEffect(() => {
    carregar()
  }, [carregar])

  const grupos = useMemo<Grupo[]>(() => {
    const m = new Map<string, EnvioFreela[]>()
    for (const e of envios ?? []) {
      const k = e.funcionarioId ?? e.cpf ?? e.id
      m.set(k, [...(m.get(k) ?? []), e])
    }
    return [...m.entries()].map(([chave, es]) => {
      const e = es[es.length - 1]
      const cadastro = freelas.find((f) => (e.freelancerId && f.id === e.freelancerId) || (e.funcionarioId && f.funcionarioId === e.funcionarioId) || (e.cpf && f.cpf === e.cpf))
      return {
        chave, nome: e.nome, envios: es, cadastro, funcionario: !!e.funcionarioId,
        pixNovo: !!cadastro && cadastro.pix.trim() !== e.pix.trim(),
        celularOutro: !!cadastro?.celular && !!e.celular && soDigitos(cadastro.celular).slice(-11) !== e.celular.slice(-11),
      }
    }).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [envios, freelas])

  // Diária padrão: R$ 100 (pedido de 08/10). A gestão muda antes de aprovar quando for outro valor.
  const VALOR_PADRAO = '100'
  const valorDe = (_g: Grupo, e: EnvioFreela) => valores[e.id] ?? VALOR_PADRAO
  const pixDo = (g: Grupo) => usarPix[g.chave] ?? !g.celularOutro

  const aprovar = async (g: Grupo, lista: EnvioFreela[]) => {
    const comValor = lista.map((e) => ({ e, valor: Number(valorDe(g, e).replace(/\./g, '').replace(',', '.')) }))
    if (comValor.some((x) => !valorDe(g, x.e).trim() || !(x.valor >= 0))) return avisar('Coloque o valor de cada diária antes de aprovar.')
    setOcupado(true)
    try {
      for (const { e, valor } of comValor) await store.aprovarEnvioFreela(e.id, valor, e.funcao, g.pixNovo && pixDo(g))
      avisar(lista.length === 1 ? 'Diária aprovada' : `${lista.length} diárias aprovadas`)
      await carregar()
      aoMudar()
    } catch (err) {
      avisar((err as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const recusar = async (e: EnvioFreela) => {
    const motivo = prompt(`Recusar a diária de ${e.nome.split(' ')[0]} em ${dataCurta(e.data)}? Diga o motivo (a pessoa vê):`, 'Não trabalhou nesse dia')
    if (motivo === null) return
    setOcupado(true)
    try {
      await store.recusarEnvioFreela(e.id, motivo)
      avisar('Diária recusada')
      await carregar()
      aoMudar()
    } finally {
      setOcupado(false)
    }
  }

  const nomeLoja = (id: string) => apelidoUnidade(unidades.find((u) => u.id === id)?.nome ?? id)

  return (
    <div className="space-y-3">
      <LinksDasLojas />
      <LocaisDasLojas />
      {!envios ? (
        <p className="text-stone-400">Carregando…</p>
      ) : !grupos.length ? (
        <Vazio>Nenhuma diária esperando aprovação.</Vazio>
      ) : (
        grupos.map((g) => (
          <div key={g.chave} className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold">{g.nome}</div>
                <div className="text-xs text-stone-500">
                  {g.envios[0].cpf ? `CPF ${formatarCpf(g.envios[0].cpf)} · ` : ''}Pix {g.envios[0].pix}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {g.funcionario && <Selo cor="azul">Funcionário, na folga</Selo>}
                {!g.cadastro && !g.funcionario && <Selo cor="ambar">Primeira vez</Selo>}
                {g.celularOutro && <Selo cor="vermelho">Celular diferente do cadastro</Selo>}
              </div>
            </div>

            {g.pixNovo && (
              <label className={`mt-2 flex items-start gap-2 rounded-xl p-2 text-sm ${g.celularOutro ? 'bg-red-50 text-red-900' : 'bg-amber-50 text-amber-900'}`}>
                <input type="checkbox" className="mt-1" checked={pixDo(g)} onChange={(e) => setUsarPix({ ...usarPix, [g.chave]: e.target.checked })} />
                <span>
                  Trocar o Pix do cadastro (<b className="break-all">{g.cadastro!.pix}</b>) pelo novo (<b className="break-all">{g.envios[0].pix}</b>).
                  {g.celularOutro && ' Atenção: veio de outro celular. Confirme com a pessoa antes.'}
                </span>
              </label>
            )}

            <ul className="mt-2 divide-y divide-stone-100">
              {g.envios.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 py-2">
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="font-medium">{diaSemana(e.data)} {dataCurta(e.data)} · {NOME_TURNO[e.turno]}</div>
                    <div className="text-xs text-stone-500">{nomeLoja(e.unidadeId)} · {e.funcao}{e.observacao && ` · ${e.observacao}`}</div>
                    <Presenca e={e} />
                    {foraDoPrazo(e) && <div className="text-xs font-semibold text-red-700">Enviada depois do prazo (domingo 22h)</div>}
                  </div>
                  <input
                    className={`${estiloEntrada} w-24! py-1.5!`}
                    inputMode="decimal"
                    placeholder="R$"
                    aria-label="Valor da diária"
                    value={valorDe(g, e)}
                    onChange={(ev) => setValores({ ...valores, [e.id]: ev.target.value })}
                  />
                  <Botao className="py-1.5!" disabled={ocupado} onClick={() => aprovar(g, [e])}>Aprovar</Botao>
                  <button disabled={ocupado} onClick={() => recusar(e)} className="rounded-full p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-700" aria-label="Recusar diária">✕</button>
                </li>
              ))}
            </ul>
            {g.envios.length > 1 && (
              <Botao variante="secundario" className="mt-2 w-full" disabled={ocupado} onClick={() => aprovar(g, g.envios)}>
                Aprovar as {g.envios.length} ({reais(g.envios.reduce((s, e) => s + (Number(valorDe(g, e).replace(/\./g, '').replace(',', '.')) || 0), 0))})
              </Botao>
            )}
          </div>
        ))
      )}
    </div>
  )
}

// Um link só para todos os freelas (pedido de 08/10): a loja ele escolhe no formulário.
// Mandar no WhatsApp ou imprimir o cartaz com QR Code para colar nas lojas.
function LinksDasLojas() {
  const { avisar } = useApp()
  const [cartaz, setCartaz] = useState(false)
  const link = linkDiaria()
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link)
      avisar('Link copiado')
    } catch {
      avisar('Não deu para copiar neste aparelho')
    }
  }
  const qr = useMemo(() => {
    const q = qrcode(0, 'M')
    q.addData(link)
    q.make()
    return q.createDataURL(8, 2)
  }, [link])

  return (
    <details className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
      <summary className="cursor-pointer text-sm font-semibold">Link para os freelas mandarem as diárias</summary>
      <p className="mt-2 text-sm text-stone-600">
        Um link só para as três lojas: mande no WhatsApp ou cole o cartaz com QR Code. O freela entra com CPF e celular,
        escolhe a loja, marca os dias e a diária aparece aqui para aprovar. Funcionário manda pelo próprio login, em "Fiz diária na folga".
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Botao variante="secundario" className="py-1.5!" onClick={copiar}>Copiar link</Botao>
        <Botao variante="secundario" className="py-1.5!" onClick={() => setCartaz(true)}>Cartaz com QR Code</Botao>
        <a href={link} target="_blank" rel="noreferrer" className="text-sm font-semibold text-sky-700">Abrir</a>
      </div>
      {cartaz && (
        <Impressao titulo="Cartaz das diárias" aoFechar={() => setCartaz(false)}>
          <div className="flex flex-col items-center gap-6 py-6 text-center">
            <img src={logo} alt="The Ozzy" className="h-24 w-24" />
            <div>
              <div className="text-3xl font-bold">Trabalhou de freela?</div>
              <div className="mt-2 text-xl">Mande aqui os dias que você trabalhou</div>
            </div>
            <img src={qr} alt="QR Code" className="h-72 w-72" style={{ imageRendering: 'pixelated' }} />
            <div className="rounded-xl border-2 border-black px-5 py-3 text-xl font-bold">Prazo: domingo até as 22h. O Pix cai até terça-feira.</div>
            <div className="text-lg">Aponte a câmera do celular</div>
            <div className="max-w-md text-sm text-stone-600">
              Você vai precisar do CPF, do celular e da chave Pix. A gerente confere e aprova; o pagamento cai por Pix até
              a terça-feira seguinte à semana trabalhada.
            </div>
          </div>
        </Impressao>
      )}
    </details>
  )
}

// Onde fica cada loja: a gestão marca uma vez, estando lá dentro, e o portal compara com o celular do freela.
function LocaisDasLojas() {
  const { store, avisar } = useApp()
  const [lojas, setLojas] = useState<LocalLoja[] | null>(null)
  const [marcando, setMarcando] = useState('')
  const carregar = useCallback(() => store.locaisLojas().then(setLojas), [store])
  useEffect(() => {
    carregar()
  }, [carregar])
  if (!lojas) return null
  const faltam = lojas.filter((l) => l.latitude === null)

  const marcar = async (l: LocalLoja) => {
    if (!confirm(`Você está dentro da ${apelidoUnidade(l.nome)} agora? O local do seu celular vai virar o local da loja.`)) return
    setMarcando(l.id)
    try {
      const local = await pegarLocalizacao()
      if (!local) return avisar('Não deu para pegar a localização. Permita a localização no navegador e tente de novo.')
      if (local.precisao && local.precisao > 200) return avisar(`Localização imprecisa (${local.precisao} m). Chegue perto da janela ou ligue o GPS e tente de novo.`)
      await store.definirLocalLoja(l.id, local.lat, local.lng)
      avisar(`Local da ${apelidoUnidade(l.nome)} marcado`)
      await carregar()
    } catch (err) {
      avisar((err as Error).message)
    } finally {
      setMarcando('')
    }
  }

  return (
    <details className="rounded-2xl bg-white p-3 ring-1 ring-stone-200" open={faltam.length > 0}>
      <summary className="cursor-pointer text-sm font-semibold">
        Local das lojas {faltam.length > 0 && <span className="text-red-700">· {faltam.length} sem local marcado</span>}
      </summary>
      <p className="mt-2 text-sm text-stone-600">
        Para a diária valer como presença, o portal compara o celular do freela com o local da loja. Marque estando
        dentro de cada loja; enquanto não marcar, as diárias dela chegam como "sem localização".
      </p>
      <div className="mt-2 space-y-2">
        {lojas.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 text-sm font-medium">{apelidoUnidade(l.nome)}</span>
            {l.latitude === null ? <Selo cor="vermelho">Sem local</Selo> : <Selo cor="verde">Marcado</Selo>}
            <Botao variante="secundario" className="py-1.5!" disabled={!!marcando} onClick={() => marcar(l)}>
              {marcando === l.id ? 'Pegando…' : l.latitude === null ? 'Marcar local desta loja' : 'Marcar de novo'}
            </Botao>
          </div>
        ))}
      </div>
    </details>
  )
}
