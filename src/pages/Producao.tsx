import { useCallback, useEffect, useMemo, useState } from 'react'
import { Botao, Campo, Modal, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, diaSemana, hoje } from '../lib/datas'
import { lerValor, mostrarQtd, nomeCentro, reais } from '../lib/financeiro'
import type { CentroCusto, Insumo, Producao as ProducaoT, Receita, VersaoReceita } from '../lib/types'

// Menu Produção (Heitor, 09/10). Primeiro passo: lançar o que a produção fez no dia (entra o preparo,
// saem os ingredientes da ficha). Depois vêm os pedidos das lojas e a lista de preparo.

interface Dados { insumos: Insumo[]; receitas: Receita[]; versoes: VersaoReceita[]; centros: CentroCusto[]; producoes: ProducaoT[] }

export default function Producao() {
  const { store, avisar, nomeDe } = useApp()
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [lancando, setLancando] = useState(false)
  const carregar = useCallback(
    () => Promise.all([store.insumos(), store.receitas(), store.versoesReceitas(), store.centrosCusto(), store.producoes(addDias(hoje(), -30), hoje())])
      .then(([insumos, receitas, versoes, centros, producoes]) => setD({ insumos, receitas, versoes, centros, producoes }), (e) => setErro(e.message)),
    [store],
  )
  useEffect(() => { carregar() }, [carregar])

  if (erro) return <p className="text-red-700">{erro}</p>
  if (!d) return <p className="text-stone-400">Carregando…</p>

  const insumo = (id: string) => d.insumos.find((i) => i.id === id)
  const dias = [...new Set(d.producoes.map((p) => p.data))]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Produção</h1>
          <p className="text-sm text-stone-500">Lance o que foi produzido: entra o preparo e saem os ingredientes da ficha, no estoque da cozinha que produziu.</p>
        </div>
        <Botao onClick={() => setLancando(true)}>+ Lançar produção</Botao>
      </div>

      {d.producoes.length === 0 ? <Vazio>Nenhuma produção lançada nos últimos 30 dias.</Vazio> : dias.map((dia) => (
        <div key={dia} className="space-y-1">
          <p className="text-sm font-semibold text-stone-600">{diaSemana(dia)}, {dataCurta(dia)}</p>
          <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
            {d.producoes.filter((p) => p.data === dia).map((p) => {
              const i = insumo(p.insumoId)
              return (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{mostrarQtd(p.quantidade)} {i?.unidade} de {i?.nome ?? 'preparo'}</div>
                    <div className="truncate text-xs text-stone-500">
                      {nomeCentro(d.centros.find((c) => c.id === p.centroCustoId))}
                      {p.custoTotal ? ` · custo ${reais(p.custoTotal)} (${reais(p.custoTotal / p.quantidade)}/${i?.unidade})` : ''}
                      {p.criadoPor ? ` · ${nomeDe(p.criadoPor)}` : ''}{p.observacao ? ` · ${p.observacao}` : ''}
                    </div>
                  </div>
                  <button className="text-xs font-semibold text-stone-500 underline hover:text-red-700" onClick={async () => {
                    if (!confirm('Desfazer esta produção? O preparo sai do estoque e os ingredientes voltam.')) return
                    try { await store.desfazerProducao(p.id); await carregar(); avisar('Produção desfeita') } catch (e) { setErro((e as Error).message) }
                  }}>Desfazer</button>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {lancando && <LancarProducao d={d} aoFechar={() => setLancando(false)} aoSalvar={async () => { setLancando(false); await carregar(); avisar('Produção lançada: estoque atualizado') }} />}
    </div>
  )
}

interface Saida { insumoId: string; qtd: string; daFicha: string | null }

function LancarProducao({ d, aoFechar, aoSalvar }: { d: Dados; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const preparos = useMemo(() => d.receitas.filter((r) => r.tipo === 'preparo' && r.ativo).sort((a, b) => a.nome.localeCompare(b.nome)), [d.receitas])
  const ativos = useMemo(() => d.insumos.filter((i) => i.ativo).sort((a, b) => a.nome.localeCompare(b.nome)), [d.insumos])
  const [centro, setCentro] = useState(d.centros.some((c) => c.id === 'central') ? 'central' : d.centros[0]?.id ?? '')
  const [data, setData] = useState(hoje())
  const [receitaId, setReceitaId] = useState('')
  const [insumoId, setInsumoId] = useState('')
  const [qtd, setQtd] = useState('')
  const [saidas, setSaidas] = useState<Saida[]>([])
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const receita = d.receitas.find((r) => r.id === receitaId)
  const versao = receita ? d.versoes.find((v) => v.receitaId === receita.id && v.numero === receita.versaoAtual) : undefined
  const unidade = receita?.unidade ?? d.insumos.find((i) => i.id === insumoId)?.unidade ?? ''
  // Item de estoque de um preparo usado dentro de outro (o ligado à ficha ou um com o mesmo nome).
  const insumoDoPreparo = (r: Receita | undefined) => r && (r.insumoId ?? d.insumos.find((i) => i.nome.toLowerCase() === r.nome.toLowerCase())?.id ?? null)

  // Ingredientes pela ficha, proporcionais ao que foi produzido (comprar = líquido ÷ aproveitamento).
  function pelaFicha(rid: string, q: string) {
    const r = d.receitas.find((x) => x.id === rid)
    const v = r ? d.versoes.find((x) => x.receitaId === r.id && x.numero === r.versaoAtual) : undefined
    const n = lerValor(q)
    if (!v || !n || n <= 0) return setSaidas([])
    const fator = n / v.rendimento
    setSaidas(v.itens.map((it) => {
      const id = it.insumoId ?? insumoDoPreparo(d.receitas.find((x) => x.id === it.subReceitaId)) ?? ''
      const valor = Math.round((it.quantidade / it.aproveitamento) * fator * 1000) / 1000
      const sub = it.subReceitaId ? d.receitas.find((x) => x.id === it.subReceitaId)?.nome ?? null : null
      return { insumoId: id, qtd: String(valor).replace('.', ','), daFicha: id ? null : sub }
    }))
  }

  const custo = saidas.reduce((t, s) => t + (lerValor(s.qtd) ?? 0) * (d.insumos.find((i) => i.id === s.insumoId)?.preco ?? 0), 0)
  const semPreco = saidas.filter((s) => s.insumoId && d.insumos.find((i) => i.id === s.insumoId)?.preco == null).length
  const n = lerValor(qtd)

  async function salvar() {
    setErro('')
    if (!centro) return setErro('Escolha a cozinha.')
    if (!receitaId && !insumoId) return setErro('Escolha o que foi produzido.')
    if (!n || n <= 0) return setErro('Diga quanto foi produzido.')
    if (saidas.some((s) => !s.insumoId)) return setErro('Tem ingrediente sem item de estoque: escolha o item ou tire a linha.')
    if (saidas.some((s) => lerValor(s.qtd) === null || lerValor(s.qtd)! < 0)) return setErro('Confira as quantidades dos ingredientes.')
    setSalvando(true)
    try {
      await store.lancarProducao({
        centroCustoId: centro, data, receitaId: receitaId || null, insumoId: receitaId ? null : insumoId, quantidade: n, observacao: obs,
        saidas: saidas.map((s) => ({ insumoId: s.insumoId, quantidade: lerValor(s.qtd)! })).filter((s) => s.quantidade > 0),
      })
      aoSalvar()
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  return (
    <Modal titulo="Lançar produção" aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Cozinha que produziu">
            <select className={estiloEntrada} value={centro} onChange={(e) => setCentro(e.target.value)}>
              {d.centros.map((c) => <option key={c.id} value={c.id}>{nomeCentro(c)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Dia"><input type="date" className={estiloEntrada} value={data} max={hoje()} onChange={(e) => setData(e.target.value)} /></Campo>
        </div>
        <Campo rotulo="O que foi produzido">
          <select className={estiloEntrada} value={receitaId || (insumoId ? 'i:' + insumoId : '')} aria-label="O que foi produzido"
            onChange={(e) => {
              const v = e.target.value
              if (v.startsWith('i:')) { setReceitaId(''); setInsumoId(v.slice(2)); setSaidas([]) } else { setReceitaId(v); setInsumoId(''); pelaFicha(v, qtd) }
            }}>
            <option value="">Escolher</option>
            <optgroup label="Pela ficha de preparo">
              {preparos.map((r) => <option key={r.id} value={r.id}>{r.nome}{r.versaoAtual ? '' : ' (ficha sem ingredientes)'}</option>)}
            </optgroup>
            <optgroup label="Sem ficha (você põe os ingredientes)">
              {ativos.map((i) => <option key={i.id} value={'i:' + i.id}>{i.nome}</option>)}
            </optgroup>
          </select>
        </Campo>
        <Campo rotulo={`Quanto ficou pronto${unidade ? ` (${unidade})` : ''}`}>
          <input className={estiloEntrada} inputMode="decimal" value={qtd} aria-label="Quanto ficou pronto"
            onChange={(e) => { setQtd(e.target.value); if (receitaId) pelaFicha(receitaId, e.target.value) }} />
        </Campo>
        {versao && n ? <p className="text-xs text-stone-500">A ficha rende {mostrarQtd(versao.rendimento)} {receita?.unidade}: os ingredientes abaixo são para {mostrarQtd(n)} {receita?.unidade}. Se usou diferente, ajuste.</p> : null}

        {(saidas.length > 0 || (!receitaId && insumoId)) && (
          <div className="space-y-2 rounded-xl bg-stone-50 p-3">
            <p className="text-sm font-semibold">Saem do estoque</p>
            {saidas.map((s, k) => {
              const ins = d.insumos.find((i) => i.id === s.insumoId)
              return (
                <div key={k} className="flex items-center gap-2">
                  {s.insumoId && !s.daFicha ? (
                    <span className="min-w-0 flex-1 truncate text-sm">{ins?.nome}</span>
                  ) : (
                    <select className={estiloEntrada + ' min-w-0 flex-1 py-1.5!'} value={s.insumoId} aria-label="Ingrediente"
                      onChange={(e) => setSaidas(saidas.map((x, j) => (j === k ? { ...x, insumoId: e.target.value, daFicha: null } : x)))}>
                      <option value="">{s.daFicha ? `${s.daFicha}: qual item do estoque?` : 'Escolher ingrediente'}</option>
                      {ativos.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
                    </select>
                  )}
                  <input className={estiloEntrada + ' w-24! shrink-0 py-1.5! text-right'} inputMode="decimal" value={s.qtd} aria-label={`Quantidade de ${ins?.nome ?? 'ingrediente'}`}
                    onChange={(e) => setSaidas(saidas.map((x, j) => (j === k ? { ...x, qtd: e.target.value } : x)))} />
                  <span className="w-6 shrink-0 text-xs text-stone-500">{ins?.unidade}</span>
                  <button className="px-1 text-stone-400 hover:text-red-700" aria-label="Tirar" onClick={() => setSaidas(saidas.filter((_, j) => j !== k))}>✕</button>
                </div>
              )
            })}
            <button className="text-sm font-semibold underline" onClick={() => setSaidas([...saidas, { insumoId: '', qtd: '', daFicha: null }])}>+ Ingrediente</button>
            {custo > 0 && n ? (
              <p className="text-xs text-stone-600">
                Custo: <b>{reais(custo)}</b> ({reais(custo / n)} por {unidade}){semPreco ? ` · ${semPreco} sem preço cadastrado` : ''}. Vira o preço do preparo no estoque.
              </p>
            ) : null}
          </div>
        )}
        <Campo rotulo="Observação (opcional)"><input className={estiloEntrada} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: lote da tarde, pedido da PSD" /></Campo>
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={salvar} disabled={salvando}>{salvando ? 'Lançando…' : 'Lançar'}</Botao>
        </div>
      </div>
    </Modal>
  )
}
