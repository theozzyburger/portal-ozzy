import { useCallback, useEffect, useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import { Botao, Selo, Vazio, estiloEntrada } from './ui'
import Impressao from './Impressao'
import { NOME_TURNO } from './CamposDiaria'
import { useApp } from '../lib/contexto'
import { dataCurta, diaSemana } from '../lib/datas'
import { soDigitos } from '../lib/store'
import { apelidoUnidade, type EnvioFreela, type Freelancer } from '../lib/types'
import { formatarCpf } from '../lib/cpf'
import logo from '../assets/logo.png'

const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const linkDiaria = (lojaId: string) => `${location.origin}${location.pathname}#/diaria/${lojaId}`

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

// Link de cada loja para mandar aos freelas (WhatsApp) e cartaz com QR Code para colar na loja.
function LinksDasLojas() {
  const { unidades, avisar } = useApp()
  const [cartaz, setCartaz] = useState<string | null>(null)
  const copiar = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t)
      avisar('Link copiado')
    } catch {
      avisar('Não deu para copiar neste aparelho')
    }
  }
  const loja = unidades.find((u) => u.id === cartaz)
  const qr = useMemo(() => {
    if (!cartaz) return ''
    const q = qrcode(0, 'M')
    q.addData(linkDiaria(cartaz))
    q.make()
    return q.createDataURL(8, 2)
  }, [cartaz])

  return (
    <details className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
      <summary className="cursor-pointer text-sm font-semibold">Link para os freelas mandarem as diárias</summary>
      <p className="mt-2 text-sm text-stone-600">
        Mande o link da loja no WhatsApp ou cole o cartaz com QR Code. O freela entra com CPF e celular, marca os dias e
        a diária aparece aqui para aprovar. Funcionário manda pelo próprio login, em "Fiz diária na folga".
      </p>
      <div className="mt-2 space-y-2">
        {unidades.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 text-sm font-medium">{apelidoUnidade(u.nome)}</span>
            <Botao variante="secundario" className="py-1.5!" onClick={() => copiar(linkDiaria(u.id))}>Copiar link</Botao>
            <Botao variante="secundario" className="py-1.5!" onClick={() => setCartaz(u.id)}>Cartaz</Botao>
            <a href={linkDiaria(u.id)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-sky-700">Abrir</a>
          </div>
        ))}
      </div>
      {cartaz && loja && (
        <Impressao titulo={`Cartaz · ${apelidoUnidade(loja.nome)}`} aoFechar={() => setCartaz(null)}>
          <div className="flex flex-col items-center gap-6 py-6 text-center">
            <img src={logo} alt="The Ozzy" className="h-24 w-24" />
            <div>
              <div className="text-3xl font-bold">Trabalhou de freela?</div>
              <div className="mt-2 text-xl">Mande aqui os dias para receber na segunda</div>
            </div>
            <img src={qr} alt="QR Code" className="h-72 w-72" style={{ imageRendering: 'pixelated' }} />
            <div className="text-lg">Aponte a câmera do celular · {loja.nome}</div>
            <div className="max-w-md text-sm text-stone-600">
              Você vai precisar do CPF, do celular e da chave Pix. A gerente confere e aprova; o pagamento sai por Pix na
              segunda-feira seguinte à semana trabalhada.
            </div>
          </div>
        </Impressao>
      )}
    </details>
  )
}
