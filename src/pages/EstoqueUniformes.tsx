import { useCallback, useEffect, useState } from 'react'
import { Botao, Campo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { dataCurta, hoje } from '../lib/datas'
import { lerNumero } from '../lib/financeiro'
import { GRADE, chaveVariante, descricaoVariante, nomeLinha, saldosUniforme } from '../lib/uniformes'
import type { Modelagem, MovimentoUniforme, NovoMovimentoUniforme, TipoMovUniforme, VarianteUniforme } from '../lib/types'

type Modo = 'contagem' | 'entrada' | 'baixa'
const MODOS: { id: Modo; nome: string; ajuda: string }[] = [
  { id: 'contagem', nome: 'Contar estoque', ajuda: 'Coloque quanto tem de cada peça agora. Só as que você mudar são gravadas.' },
  { id: 'entrada', nome: 'Entrada', ajuda: 'Coloque quantas chegaram de cada peça (compra avulsa, peça devolvida em bom estado).' },
  { id: 'baixa', nome: 'Baixa', ajuda: 'Coloque quantas saíram sem ser entrega (perdeu, rasgou, foi descartada).' },
]
const NOME_TIPO: Record<TipoMovUniforme, string> = { contagem: 'Contagem', entrada: 'Entrada', entrega: 'Entrega', devolucao: 'Devolução', baixa: 'Baixa' }

interface Linha { cor: string | null; modelagem: Modelagem | null }

// Estoque de uniformes (Heitor, 09/10): quanto tem de cada peça, cor, modelagem e tamanho.
// Entregas no perfil tiram do estoque sozinhas; pedido de compra recebido dá entrada.
export default function EstoqueUniformes() {
  const { store, nomeDe, avisar } = useApp()
  const [movs, setMovs] = useState<MovimentoUniforme[] | null>(null)
  const [modo, setModo] = useState<Modo | null>(null)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [outras, setOutras] = useState<{ item: string; tamanho: string; qtd: string }[]>([])
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [desfazer, setDesfazer] = useState<string | null>(null)
  const [verTudo, setVerTudo] = useState(false)
  const carregar = useCallback(() => store.movimentosUniforme().then(setMovs), [store])
  useEffect(() => {
    carregar()
  }, [carregar])
  if (!movs) return <p className="text-stone-400">Carregando…</p>

  const saldos = saldosUniforme(movs)
  const variantes = new Map<string, VarianteUniforme>()
  for (const m of movs) variantes.set(chaveVariante(m), { item: m.item, cor: m.cor, modelagem: m.modelagem, tamanho: m.tamanho })
  const total = [...saldos.values()].reduce((s, q) => s + Math.max(0, q), 0)
  const ultimaContagem = [...movs].reverse().find((m) => m.tipo === 'contagem')

  // Linhas da grade: as padrão e qualquer outra combinação que já tenha movimento (ex.: camiseta unissex).
  const linhasDe = (item: string, padrao: Linha[]) => {
    const extras: Linha[] = []
    for (const v of variantes.values())
      if (v.item === item && ![...padrao, ...extras].some((l) => l.cor === v.cor && l.modelagem === v.modelagem)) extras.push({ cor: v.cor, modelagem: v.modelagem })
    return [...padrao, ...extras]
  }
  const foraDaGrade = [...variantes.values()]
    .filter((v) => !GRADE.some((g) => g.item === v.item && g.tamanhos.includes(v.tamanho)))
    .sort((a, b) => descricaoVariante(a).localeCompare(descricaoVariante(b), 'pt-BR'))

  const comecar = (m: Modo) => {
    setModo(m)
    setObs('')
    setOutras([])
    setValores(m === 'contagem' ? Object.fromEntries([...saldos].map(([k, q]) => [k, String(q)])) : {})
  }

  const salvar = async () => {
    if (!modo) return
    const ref = `manual:${crypto.randomUUID()}`
    const linhas: NovoMovimentoUniforme[] = []
    const tudo = new Map(variantes)
    for (const g of GRADE)
      for (const l of linhasDe(g.item, g.linhas))
        for (const t of g.tamanhos) {
          const v = { item: g.item, cor: l.cor, modelagem: l.modelagem, tamanho: t }
          tudo.set(chaveVariante(v), v)
        }
    for (const [k, v] of tudo) {
      const txt = valores[k]?.trim()
      if (!txt) continue
      const q = Math.round(lerNumero(txt) ?? NaN)
      if (!Number.isFinite(q) || q < 0) return avisar(`Quantidade inválida em ${descricaoVariante(v)}`)
      if (modo === 'contagem') {
        if (q !== (saldos.get(k) ?? 0) || !saldos.has(k)) linhas.push({ ...v, tipo: 'contagem', quantidade: q, referencia: ref, observacao: obs })
      } else if (q > 0) linhas.push({ ...v, tipo: modo, quantidade: modo === 'baixa' ? -q : q, referencia: ref, observacao: obs })
    }
    for (const o of outras) {
      const q = Math.round(lerNumero(o.qtd) ?? 0)
      if (!o.item.trim() || !q) continue
      const v = { item: o.item.trim(), cor: null, modelagem: null, tamanho: o.tamanho.trim() || 'Único' }
      linhas.push({ ...v, tipo: modo, quantidade: modo === 'baixa' ? -Math.abs(q) : Math.abs(q), referencia: ref, observacao: obs })
    }
    if (!linhas.length) return avisar(modo === 'contagem' ? 'Nenhuma quantidade mudou' : 'Coloque a quantidade de pelo menos uma peça')
    setSalvando(true)
    try {
      await store.movimentarUniformes(linhas.map((l) => ({ ...l, data: hoje() })))
      await carregar()
      setModo(null)
      avisar(`${MODOS.find((x) => x.id === modo)!.nome}: ${linhas.length} peça${linhas.length > 1 ? 's' : ''} gravada${linhas.length > 1 ? 's' : ''}`)
    } catch (e) {
      avisar((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  // Histórico agrupado: tudo o que foi feito junto (uma contagem, uma entrega, um pedido recebido).
  const grupos = new Map<string, MovimentoUniforme[]>()
  for (const m of [...movs].reverse()) grupos.set(m.referencia, [...(grupos.get(m.referencia) ?? []), m])
  const listaGrupos = [...grupos.entries()].slice(0, verTudo ? undefined : 15)
  const origem = (ref: string, m: MovimentoUniforme) =>
    ref.startsWith('entrega:') ? 'Entrega no perfil' : ref.startsWith('pedido:') ? 'Pedido de compra recebido' : NOME_TIPO[m.tipo]

  const celula = (v: VarianteUniforme) => {
    const k = chaveVariante(v)
    const q = saldos.get(k)
    if (modo)
      return (
        <input
          className="w-12 rounded-lg border border-stone-300 px-1 py-1 text-center text-sm"
          inputMode="numeric"
          value={valores[k] ?? ''}
          placeholder={modo === 'contagem' ? '0' : ''}
          onChange={(e) => setValores({ ...valores, [k]: e.target.value.replace(/[^\d]/g, '') })}
          aria-label={descricaoVariante(v)}
        />
      )
    return <span className={q === undefined || q === 0 ? 'text-stone-300' : q < 0 ? 'font-semibold text-red-600' : 'font-semibold'}>{q === undefined || q === 0 ? '–' : q}</span>
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
        <div className="text-2xl font-bold">{total} peça{total === 1 ? '' : 's'} no estoque</div>
        <p className="text-sm text-stone-500">
          {ultimaContagem ? `Última contagem em ${dataCurta(ultimaContagem.data)}.` : 'Ainda não foi contado. Comece por "Contar estoque".'} Entregas no perfil tiram do estoque sozinhas.
        </p>
        {!modo && (
          <div className="mt-3 flex flex-wrap gap-2">
            {MODOS.map((m) => (
              <Botao key={m.id} variante={m.id === 'contagem' ? 'primario' : 'secundario'} onClick={() => comecar(m.id)}>{m.nome}</Botao>
            ))}
          </div>
        )}
        {modo && <p className="mt-3 rounded-xl bg-ozzy-100 p-3 text-sm">{MODOS.find((m) => m.id === modo)!.ajuda}</p>}
      </section>

      {GRADE.map((g) => {
        const linhas = linhasDe(g.item, g.linhas)
        const soma = linhas.reduce((s, l) => s + g.tamanhos.reduce((t, tam) => t + Math.max(0, saldos.get(chaveVariante({ item: g.item, ...l, tamanho: tam })) ?? 0), 0), 0)
        return (
          <section key={g.item} className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="font-bold">{g.item}</h3>
              <span className="text-sm text-stone-500">{soma} no total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead>
                  <tr className="text-xs text-stone-500">
                    <th className="pr-3 text-left font-medium" />
                    {g.tamanhos.map((t) => <th key={t} className="px-1 pb-1 text-center font-medium">{t}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={nomeLinha(l) || 'unica'} className="border-t border-stone-100">
                      <td className="whitespace-nowrap py-1.5 pr-3 capitalize text-stone-700">{nomeLinha(l) || 'Quantidade'}</td>
                      {g.tamanhos.map((t) => <td key={t} className="px-1 py-1 text-center">{celula({ item: g.item, ...l, tamanho: t })}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

      {(foraDaGrade.length > 0 || modo) && (
        <section className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <h3 className="font-bold">Outras peças</h3>
          {foraDaGrade.map((v) => (
            <div key={chaveVariante(v)} className="flex items-center justify-between gap-2 text-sm">
              <span>{descricaoVariante(v)}</span>
              {celula(v)}
            </div>
          ))}
          {modo && (
            <>
              {outras.map((o, i) => (
                <div key={i} className="grid grid-cols-[1fr_5rem_3.5rem] gap-2">
                  <input className={estiloEntrada} placeholder="Peça (ex.: Dólmã)" value={o.item} onChange={(e) => setOutras(outras.map((x, k) => (k === i ? { ...x, item: e.target.value } : x)))} aria-label="Peça" />
                  <input className={estiloEntrada} placeholder="Tam." value={o.tamanho} onChange={(e) => setOutras(outras.map((x, k) => (k === i ? { ...x, tamanho: e.target.value } : x)))} aria-label="Tamanho" />
                  <input className={estiloEntrada} inputMode="numeric" placeholder="Qtd" value={o.qtd} onChange={(e) => setOutras(outras.map((x, k) => (k === i ? { ...x, qtd: e.target.value.replace(/[^\d]/g, '') } : x)))} aria-label="Quantidade" />
                </div>
              ))}
              <button type="button" onClick={() => setOutras([...outras, { item: '', tamanho: '', qtd: '' }])} className="text-sm font-semibold underline decoration-ozzy-500 decoration-2 underline-offset-4">
                + Outra peça
              </button>
            </>
          )}
        </section>
      )}

      {modo && (
        <section className="sticky bottom-2 space-y-3 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-stone-200">
          <Campo rotulo="Observação (opcional)">
            <input className={estiloEntrada} value={obs} onChange={(e) => setObs(e.target.value)} placeholder={modo === 'baixa' ? 'Ex.: 2 camisetas rasgadas' : 'Ex.: contagem do armário do escritório'} />
          </Campo>
          <div className="flex flex-wrap gap-2">
            <Botao disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : `Salvar ${MODOS.find((m) => m.id === modo)!.nome.toLowerCase()}`}</Botao>
            <Botao variante="secundario" onClick={() => setModo(null)}>Cancelar</Botao>
          </div>
        </section>
      )}

      {!modo && (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <h3 className="mb-2 font-bold">Histórico</h3>
          {listaGrupos.length === 0 ? (
            <Vazio>Nenhum movimento ainda.</Vazio>
          ) : (
            <ul className="divide-y divide-stone-100">
              {listaGrupos.map(([ref, ms]) => {
                const m = ms[0]
                const soma = ms.reduce((s, x) => s + x.quantidade, 0)
                return (
                  <li key={ref} className="py-2.5 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{origem(ref, m)}</span>
                      <span className="text-xs text-stone-500">{dataCurta(m.data)}{m.criadoPor ? ` · ${nomeDe(m.criadoPor).split(' ')[0]}` : ''}</span>
                    </div>
                    <div className="text-stone-700">
                      {ms.map((x) => `${m.tipo === 'contagem' ? '' : x.quantidade > 0 ? '+' : ''}${x.quantidade} ${descricaoVariante(x)}`).join(' · ')}
                    </div>
                    {m.observacao && <div className="text-xs text-stone-500">{m.observacao}</div>}
                    {m.tipo !== 'contagem' && ms.length > 1 && <div className="text-xs text-stone-500">{soma > 0 ? '+' : ''}{soma} peças</div>}
                    {desfazer === ref ? (
                      <div className="mt-1 flex gap-3">
                        <button
                          className="text-xs font-semibold text-red-600"
                          onClick={async () => { await store.desfazerMovimentoUniforme(ref); setDesfazer(null); await carregar(); avisar('Movimento desfeito') }}
                        >
                          Confirmar: desfazer
                        </button>
                        <button className="text-xs text-stone-500" onClick={() => setDesfazer(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <button className="mt-1 text-xs text-stone-400 underline" onClick={() => setDesfazer(ref)}>Desfazer</button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {grupos.size > 15 && !verTudo && <button className="mt-2 text-sm font-semibold text-stone-500" onClick={() => setVerTudo(true)}>Ver todos ({grupos.size})</button>}
        </section>
      )}
    </div>
  )
}
