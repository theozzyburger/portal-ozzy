import { useEffect, useMemo, useState } from 'react'
import { Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { podeGerenciar } from '../lib/permissoes'
import type { Ficha, ItemFicha } from '../lib/types'

const GRUPOS = ['Lanches e porções', 'Combos', 'Pizzas', 'Adicionais', 'Bebidas', 'Sobremesas', 'Preparos'] as const
type Grupo = (typeof GRUPOS)[number]

// O Lucro Fácil quase não tem categoria preenchida, então o grupo sai do nome.
export function grupoDa(f: Ficha): Grupo {
  const n = f.nome.toLowerCase()
  if (f.preparo || n.startsWith('base ') || n.startsWith('!')) return 'Preparos'
  if (/^adc|^extra /.test(n)) return 'Adicionais'
  if (f.categoria === 'pizza' || f.categoria === 'sabor_pizza' || n.includes('pizza') || n.startsWith('#')) return 'Pizzas'
  if (n.includes('combo') || n.includes(' + ')) return 'Combos'
  if (f.categoria === 'bebida' || /coca|guaran|água|agua|suco|lemonade|limonada|refri|milkshake|cerveja/.test(n)) return 'Bebidas'
  if (f.categoria === 'sobremesa' || /brownie|cookie|sobremesa|pudim|nutella|bolo/.test(n)) return 'Sobremesas'
  return 'Lanches e porções'
}

const NOME_TAMANHO: Record<string, string> = { broto: 'Broto', media: 'Média', grande: 'Grande', familia: 'Família' }
const ORDEM_TAMANHO = ['broto', 'media', 'grande', 'familia']

// Quantidade do jeito que a cozinha mede: 0,04 kg vira 40 g.
export function quantidade(qtd: number, unidade: string) {
  const num = (n: number, casas = 2) => n.toLocaleString('pt-BR', { maximumFractionDigits: casas })
  if (unidade === 'kg') return qtd < 1 ? `${num(qtd * 1000, 1)} g` : `${num(qtd, 3)} kg`
  if (unidade === 'l') return qtd < 1 ? `${num(qtd * 1000, 0)} ml` : `${num(qtd, 2)} L`
  if (unidade === 'g') return `${num(qtd, 1)} g`
  if (unidade === 'ml') return `${num(qtd, 0)} ml`
  if (unidade === 'hour') return `${num(qtd)} h`
  return `${num(qtd, 3)} un`
}

export const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const porcento = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

export function atualizadoEm(iso: string | null) {
  if (!iso) return 'ainda não copiado'
  return 'atualizado em ' + new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function Fichas() {
  const { eu, store } = useApp()
  const gestao = podeGerenciar(eu.nivel)
  const [dados, setDados] = useState<{ fichas: Ficha[]; atualizadoEm: string | null } | null>(null)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [grupo, setGrupo] = useState<Grupo | ''>('')
  const [aberta, setAberta] = useState<number | null>(null)

  useEffect(() => {
    store.fichas().then(setDados, (e) => setErro(e.message))
  }, [store])

  const porGrupo = useMemo(() => {
    const m = new Map<Grupo, Ficha[]>()
    for (const f of dados?.fichas ?? []) {
      const g = grupoDa(f)
      m.set(g, [...(m.get(g) ?? []), f])
    }
    for (const lista of m.values()) lista.sort((a, b) => limpo(a.nome).localeCompare(limpo(b.nome), 'pt-BR'))
    return m
  }, [dados])

  if (erro) return <Vazio>{erro}</Vazio>
  if (!dados) return <p className="text-stone-400">Carregando…</p>

  const termo = semAcento(busca.trim())
  const passa = (f: Ficha) => !termo || semAcento(f.nome).includes(termo) || f.itens.some((i) => semAcento(i.nome).includes(termo))
  const grupos = GRUPOS.filter((g) => porGrupo.has(g))
  const visiveis = (grupo ? [grupo] : grupos).map((g) => [g, (porGrupo.get(g) ?? []).filter(passa)] as const).filter(([, l]) => l.length)
  const porId = new Map(dados.fichas.map((f) => [f.produtoId, f]))
  const selecionada = aberta != null ? porId.get(aberta) : undefined

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Fichas técnicas</h1>
        <p className="text-sm text-stone-500">
          Do Lucro Fácil, {atualizadoEm(dados.atualizadoEm)}. Para corrigir uma ficha, altere lá; aqui é só consulta.
        </p>
      </div>

      {dados.fichas.length === 0 ? (
        <Vazio>As fichas ainda não foram copiadas do Lucro Fácil.</Vazio>
      ) : (
        <>
          <div className="space-y-2">
            <input
              className={estiloEntrada}
              type="search"
              placeholder="Buscar produto ou insumo (ex.: Melbourne, cheddar)"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
              <Filtro ativo={!grupo} onClick={() => setGrupo('')}>Todas</Filtro>
              {grupos.map((g) => (
                <Filtro key={g} ativo={grupo === g} onClick={() => setGrupo(grupo === g ? '' : g)}>
                  {g} <span className="opacity-60">{porGrupo.get(g)!.length}</span>
                </Filtro>
              ))}
            </div>
          </div>

          {visiveis.length === 0 && <Vazio>Nenhuma ficha com “{busca}”.</Vazio>}

          {visiveis.map(([g, lista]) => (
            <section key={g}>
              <h2 className="mb-2 text-sm font-bold tracking-wide text-stone-500 uppercase">{g}</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {lista.map((f) => (
                  <button
                    key={f.produtoId}
                    onClick={() => setAberta(f.produtoId)}
                    className="flex items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-stone-200 transition hover:ring-carvao"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{limpo(f.nome)}</div>
                      <div className="text-xs text-stone-500">
                        {f.itens.length === 0 ? 'sem itens na ficha' : `${insumosUnicos(f.itens)} ${insumosUnicos(f.itens) === 1 ? 'insumo' : 'insumos'}`}
                      </div>
                    </div>
                    {gestao && f.custo && <ResumoCusto custo={f.custo} preparo={f.preparo} />}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      <Modal titulo={selecionada ? limpo(selecionada.nome) : ''} aberto={!!selecionada} aoFechar={() => setAberta(null)}>
        {selecionada && <Detalhe ficha={selecionada} gestao={gestao} porId={porId} abrir={setAberta} />}
      </Modal>
    </div>
  )
}

function ResumoCusto({ custo, preparo }: { custo: NonNullable<Ficha['custo']>; preparo: boolean }) {
  const cmv = custo.preco > 0 ? (custo.total / custo.preco) * 100 : null
  return (
    <div className="shrink-0 text-right">
      <div className="text-sm font-semibold tabular-nums">{reais(custo.total)}</div>
      {!preparo && (
        <div className={`text-xs tabular-nums ${cmv == null ? 'text-stone-400' : cmv > 40 ? 'font-semibold text-red-700' : 'text-stone-500'}`}>
          {cmv == null ? 'sem preço' : `CMV ${porcento(cmv)}`}
        </div>
      )}
    </div>
  )
}

function Detalhe({ ficha, gestao, porId, abrir }: { ficha: Ficha; gestao: boolean; porId: Map<number, Ficha>; abrir: (id: number) => void }) {
  const custos = gestao ? ficha.custo : undefined
  // Pizzas têm uma lista por tamanho; o resto, uma só.
  const tamanhos = [...new Set(ficha.itens.map((i) => i.tamanho ?? ''))].sort((a, b) => ORDEM_TAMANHO.indexOf(a) - ORDEM_TAMANHO.indexOf(b))
  const usadoEm = ficha.preparo ? [...porId.values()].filter((f) => f.itens.some((i) => i.preparoId === ficha.produtoId)) : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <Selo>{grupoDa(ficha)}</Selo>
        {ficha.preparo && <Selo cor="azul">Usado dentro de outras fichas</Selo>}
      </div>

      {custos && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Caixa rotulo="Custo" valor={reais(custos.total)} />
          <Caixa rotulo="Preço" valor={custos.preco > 0 ? reais(custos.preco) : '—'} />
          <Caixa
            rotulo="CMV"
            valor={custos.preco > 0 ? porcento((custos.total / custos.preco) * 100) : '—'}
            alerta={custos.preco > 0 && custos.total / custos.preco > 0.4}
          />
        </div>
      )}

      {ficha.itens.length === 0 && <Vazio>Esta ficha está sem itens no Lucro Fácil.</Vazio>}

      {custos && faltando(custos) > 0.05 && (
        <p className="rounded-xl bg-ozzy-100 p-3 text-sm text-stone-800">
          O Lucro Fácil não mandou todos os itens desta ficha: {reais(faltando(custos))} do custo são de itens que não aparecem aqui.
          Confira a ficha lá.
        </p>
      )}

      {tamanhos.map((t) => (
        <div key={t}>
          {t && <h3 className="mb-1.5 text-sm font-bold">{NOME_TAMANHO[t] ?? t}</h3>}
          <ul className="divide-y divide-stone-100 rounded-2xl ring-1 ring-stone-200">
            {ficha.itens.map((item, i) =>
              (item.tamanho ?? '') !== t ? null : (
                <li key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    {item.preparoId && porId.has(item.preparoId) ? (
                      <button onClick={() => abrir(item.preparoId!)} className="text-left font-medium text-sky-700 underline decoration-sky-200 underline-offset-2">
                        {item.nome}
                      </button>
                    ) : (
                      <span className="font-medium">{item.nome}</span>
                    )}
                    {custos?.itens[i] && <div className="text-xs text-stone-500 tabular-nums">{reais(custos.itens[i].total)}</div>}
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{quantidade(item.qtd, item.unidade)}</span>
                </li>
              ),
            )}
          </ul>
        </div>
      ))}

      {usadoEm.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-sm font-bold">Vai em</h3>
          <div className="flex flex-wrap gap-1.5">
            {usadoEm.map((f) => (
              <button key={f.produtoId} onClick={() => abrir(f.produtoId)} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold hover:bg-stone-200">
                {limpo(f.nome)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Caixa({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className={`rounded-2xl p-2.5 ${alerta ? 'bg-red-50 text-red-800' : 'bg-stone-50'}`}>
      <div className="text-xs text-stone-500">{rotulo}</div>
      <div className="font-bold tabular-nums">{valor}</div>
    </div>
  )
}

function Filtro({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${ativo ? 'bg-carvao text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-100'}`}
    >
      {children}
    </button>
  )
}

// Tira os marcadores que o Lucro Fácil usa para ordenar ("# Pizza Atum", "! TAMANHO…").
const limpo = (nome: string) => nome.replace(/^[#!]\s*/, '')
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
// Diferença entre o custo da ficha e a soma dos itens que vieram (o Lucro Fácil às vezes omite itens).
const faltando = (c: NonNullable<Ficha['custo']>) => c.total - c.itens.reduce((s, i) => s + i.total, 0)
const insumosUnicos = (itens: ItemFicha[]) => new Set(itens.map((i) => i.nome)).size
