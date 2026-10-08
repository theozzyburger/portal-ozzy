import { useCallback, useEffect, useState } from 'react'
import { Botao, Cartao, Selo } from './ui'
import { useApp } from '../lib/contexto'
import { dataLonga } from '../lib/datas'
import { etapaFeita, etapasAdmissao, type ContextoAdmissao, type EtapaAdmissao } from '../lib/pessoal'
import type { Store } from '../lib/store'
import type { Admissao, Documento, Funcionario } from '../lib/types'

const vazia = (p: Funcionario): Admissao => ({ funcionarioId: p.id, dataAdmissao: p.dataAdmissao, itens: {}, concluido: false })

// Marca uma etapa da admissão (usado quando a guia ou o contrato são gerados).
export async function marcarEtapaAdmissao(store: Store, p: Funcionario, chave: string, por: string) {
  const a = (await store.admissoes(p.id)).find((x) => x.dataAdmissao === p.dataAdmissao) ?? vazia(p)
  if (a.itens[chave]) return
  await store.salvarAdmissao({ ...a, itens: { ...a.itens, [chave]: { por, em: new Date().toISOString() } } })
}

// O que o portal precisa saber para as etapas automáticas.
export async function contextoAdmissao(store: Store, p: Funcionario, docs?: Documento[]): Promise<ContextoAdmissao> {
  const [d, entregas, versoes, leituras] = await Promise.all([
    docs ?? store.documentos(p.id),
    store.uniformes(p.id),
    store.versoesRegulamento(),
    store.leiturasRegulamento().catch(() => []),
  ])
  const vigente = versoes[0]?.id
  return { docs: d, entregas, assinouRegulamento: !!vigente && leituras.some((l) => l.funcionarioId === p.id && l.versaoId === vigente) }
}

// Passo a passo da admissão no perfil (pedido de 08/10): mostra o progresso e o que falta, para nenhuma etapa
// ficar para trás. Só gestão (administrativo, gerência e proprietário).
export default function ChecklistAdmissao({
  pessoa, docs, podeMarcar, aoAcao,
}: {
  pessoa: Funcionario
  docs: Documento[]
  podeMarcar: boolean
  aoAcao: (acao: NonNullable<EtapaAdmissao['acao']>, chave: string) => void
}) {
  const { eu, store, nomeDe, avisar } = useApp()
  const [admissao, setAdmissao] = useState<Admissao | null>(null)
  const [ctx, setCtx] = useState<ContextoAdmissao | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [aberto, setAberto] = useState(true)

  const carregar = useCallback(async () => {
    const [as, c] = await Promise.all([store.admissoes(pessoa.id), contextoAdmissao(store, pessoa, docs)])
    setAdmissao(as.find((a) => a.dataAdmissao === pessoa.dataAdmissao) ?? vazia(pessoa))
    setCtx(c)
  }, [store, pessoa, docs])
  useEffect(() => {
    carregar()
  }, [carregar])

  if (!admissao || !ctx) return null
  const etapas = etapasAdmissao(pessoa, ctx)
  const feitas = etapas.filter((e) => etapaFeita(e, admissao)).length
  const total = etapas.length
  const pct = Math.round((feitas / total) * 100)

  const salvar = async (a: Admissao, aviso?: string) => {
    setSalvando(true)
    try {
      await store.salvarAdmissao(a)
      setAdmissao(a)
      if (aviso) avisar(aviso)
    } catch (e) {
      avisar((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }
  const alternar = (chave: string) => {
    const itens = { ...admissao.itens }
    if (itens[chave]) delete itens[chave]
    else itens[chave] = { por: eu.id, em: new Date().toISOString() }
    salvar({ ...admissao, itens })
  }

  if (admissao.concluido)
    return (
      <Cartao className="flex items-center justify-between gap-2">
        <span className="text-sm">
          <b>Admissão concluída</b> <span className="text-stone-500">· {feitas} de {total} etapas</span>
        </span>
        {podeMarcar && (
          <Botao variante="fantasma" disabled={salvando} onClick={() => salvar({ ...admissao, concluido: false }, 'Admissão reaberta')}>
            Reabrir
          </Botao>
        )}
      </Cartao>
    )

  return (
    <Cartao className="ring-2! ring-ozzy-400!">
      <button className="flex w-full flex-wrap items-start justify-between gap-2 text-left" onClick={() => setAberto(!aberto)}>
        <div>
          <h2 className="font-bold">Admissão</h2>
          <p className="text-sm text-stone-600">Entrada em {dataLonga(pessoa.dataAdmissao)}</p>
        </div>
        <Selo cor={feitas === total ? 'verde' : 'ambar'}>
          {feitas} de {total} · {pct}%
        </Selo>
      </button>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da admissão">
        <div className="h-full rounded-full bg-carvao transition-all" style={{ width: `${pct}%` }} />
      </div>
      {aberto && (
        <ol className="mt-3 divide-y divide-stone-100">
          {etapas.map((e, i) => {
            const feito = etapaFeita(e, admissao)
            const marca = admissao.itens[e.chave]
            return (
              <li key={e.chave} className="flex items-start gap-3 py-2">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0 accent-carvao"
                  checked={feito}
                  disabled={!podeMarcar || salvando || !!e.auto}
                  onChange={() => alternar(e.chave)}
                  aria-label={e.nome}
                />
                <span className="min-w-0 flex-1 text-sm">
                  <span className={`block font-medium ${feito ? 'text-stone-500 line-through' : ''}`}>
                    <span className="mr-1 text-stone-400 tabular-nums">{i + 1}.</span>
                    {e.nome}
                  </span>
                  {e.auto ? (
                    <span className="block text-xs text-green-700">✓ Conferido pelo portal</span>
                  ) : marca ? (
                    <span className="block text-xs text-stone-500">
                      {nomeDe(marca.por)} · {dataLonga(marca.em.slice(0, 10))}
                    </span>
                  ) : (
                    e.detalhe && <span className="block text-xs text-stone-500">{e.detalhe}</span>
                  )}
                </span>
                {!feito && e.acao && podeMarcar && (
                  <button
                    type="button"
                    onClick={() => aoAcao(e.acao!, e.chave)}
                    className="shrink-0 text-xs font-semibold underline decoration-ozzy-500 decoration-2 underline-offset-2"
                  >
                    {{ editar: 'Completar', guia: 'Gerar guia', contrato: 'Gerar contrato', uniforme: 'Entregar', turno: 'Ver turnos', documento: 'Anexar' }[e.acao]}
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      )}
      {podeMarcar && aberto && (
        <div className="mt-3">
          <Botao disabled={salvando || feitas < total} onClick={() => salvar({ ...admissao, concluido: true }, 'Admissão concluída')}>
            {feitas < total ? `Faltam ${total - feitas} etapa${total - feitas > 1 ? 's' : ''}` : 'Concluir admissão'}
          </Botao>
        </div>
      )}
    </Cartao>
  )
}
