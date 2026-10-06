import { useEffect, useRef, useState, type ReactNode } from 'react'

// Gráficos simples em SVG, desenhados em pixels reais (o texto não encolhe no celular).
// Regras: barras finas com ponta arredondada de 4px, linhas de 2px, grade fina e discreta,
// texto sempre em cinza/preto (nunca na cor da série) e dica ao passar o dedo/mouse.

export const TINTA = { forte: '#0b0b0c', media: '#57534e', fraca: '#898781', grade: '#e7e5e4', base: '#c3c2b7' }

export const numero = (n: number) => Math.round(n).toLocaleString('pt-BR')
export const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
export const moedaCurta = (n: number) =>
  n >= 1000 ? `R$ ${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: n >= 100000 ? 0 : 1 })} mil` : moeda(n)
export const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`

function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [largura, setLargura] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setLargura(Math.floor(e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, largura] as const
}

// Marcas redondas na escala: 0, 100, 200…
function escala(max: number, alvo = 4) {
  if (max <= 0) return [0, 1]
  const bruto = max / alvo
  const pot = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto)!
  const marcas = []
  for (let v = 0; v <= max + passo * 0.001 || marcas.length < 2; v += passo) marcas.push(v)
  if (marcas[marcas.length - 1] < max) marcas.push(marcas[marcas.length - 1] + passo)
  return marcas
}

// Coluna com ponta arredondada em cima e reta na base.
function coluna(x: number, y: number, w: number, h: number, r = 4) {
  if (h <= 0) return ''
  const rr = Math.min(r, h, w / 2)
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}

interface DicaEstado {
  x: number
  y: number
  conteudo: ReactNode
}

function Dica({ dica, largura }: { dica: DicaEstado | null; largura: number }) {
  if (!dica) return null
  const aDireita = dica.x < largura / 2
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-36 rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-stone-200"
      style={{ top: Math.max(0, dica.y - 8), ...(aDireita ? { left: dica.x + 12 } : { right: largura - dica.x + 12 }) }}
    >
      {dica.conteudo}
    </div>
  )
}

export function LinhaDica({ cor, valor, nome, traco = 'linha' }: { cor: string; valor: string; nome: string; traco?: 'linha' | 'bloco' }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className={traco === 'linha' ? 'h-0.5 w-3 rounded' : 'h-2.5 w-2.5 rounded-sm'} style={{ background: cor }} />
      <span className="font-bold tabular-nums text-carvao">{valor}</span>
      <span className="text-stone-500">{nome}</span>
    </div>
  )
}

export function Legenda({ itens }: { itens: { nome: string; cor: string; tipo?: 'bloco' | 'linha' }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
      {itens.map((i) => (
        <span key={i.nome} className="flex items-center gap-1.5">
          <span className={i.tipo === 'linha' ? 'h-0.5 w-4 rounded' : 'h-2.5 w-2.5 rounded-sm'} style={{ background: i.cor }} />
          {i.nome}
        </span>
      ))}
    </div>
  )
}

export interface Semana {
  rotulo: string
  periodo: string
  pedidos: number
  faturamento: number
  atual?: boolean
  estimativa?: number // pedidos que ainda devem entrar até domingo
}

export const COR_SEMANA = { anterior: '#d6d3d1', atual: TINTA.forte, estimativa: '#eee41d' }

// Colunas por semana: semanas anteriores em cinza, esta semana em preto e a estimativa em amarelo por cima.
export function ColunasSemanas({ semanas }: { semanas: Semana[] }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [dica, setDica] = useState<DicaEstado | null>(null)
  const altura = 210
  const m = { topo: 22, base: 24, esq: 36, dir: 4 }
  const max = Math.max(...semanas.map((s) => s.pedidos + (s.estimativa ?? 0)), 1)
  const marcas = escala(max)
  const topo = marcas[marcas.length - 1]
  const h = altura - m.topo - m.base
  const y = (v: number) => m.topo + h - (v / topo) * h
  const banda = (largura - m.esq - m.dir) / semanas.length
  const w = Math.min(24, banda * 0.6)

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setDica(null)}>
      {largura > 0 && (
        <svg width={largura} height={altura} role="img" aria-label="Pedidos por semana">
          {marcas.map((v) => (
            <g key={v}>
              <line x1={m.esq} x2={largura - m.dir} y1={y(v)} y2={y(v)} stroke={v === 0 ? TINTA.base : TINTA.grade} strokeWidth={1} />
              <text x={m.esq - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill={TINTA.fraca} className="tabular-nums">
                {numero(v)}
              </text>
            </g>
          ))}
          {semanas.map((s, i) => {
            const cx = m.esq + banda * i + banda / 2
            const x = cx - w / 2
            const est = s.estimativa ?? 0
            const yReal = y(s.pedidos)
            const yTotal = y(s.pedidos + est)
            const rotular = s.atual || i === semanas.length - 2
            const ativo = dica && Math.abs(dica.x - cx) < 1
            return (
              <g key={s.rotulo} opacity={dica && !ativo ? 0.55 : 1}>
                {est > 0 ? (
                  <>
                    <path d={`M${x},${yReal}V${m.topo + h}H${x + w}V${yReal}Z`} fill={COR_SEMANA.atual} />
                    <path d={coluna(x, yTotal, w, Math.max(0, yReal - yTotal - 2))} fill={COR_SEMANA.estimativa} />
                  </>
                ) : (
                  <path d={coluna(x, yReal, w, m.topo + h - yReal)} fill={s.atual ? COR_SEMANA.atual : COR_SEMANA.anterior} />
                )}
                {rotular && (
                  <text x={cx} y={yTotal - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={TINTA.forte} className="tabular-nums">
                    {numero(s.pedidos + est)}
                  </text>
                )}
                {(banda >= 44 || (semanas.length - 1 - i) % 2 === 0) && (
                  <text x={cx} y={altura - 6} textAnchor="middle" fontSize={11} fill={s.atual ? TINTA.forte : TINTA.fraca} fontWeight={s.atual ? 600 : 400}>
                    {s.rotulo}
                  </text>
                )}
                <rect
                  x={cx - banda / 2}
                  y={m.topo}
                  width={banda}
                  height={h}
                  fill="transparent"
                  tabIndex={0}
                  onPointerMove={() => setDica({ x: cx, y: yTotal, conteudo: conteudoSemana(s) })}
                  onFocus={() => setDica({ x: cx, y: yTotal, conteudo: conteudoSemana(s) })}
                  onBlur={() => setDica(null)}
                  aria-label={`${s.periodo}: ${numero(s.pedidos)} pedidos`}
                />
              </g>
            )
          })}
        </svg>
      )}
      <Dica dica={dica} largura={largura} />
    </div>
  )
}

function conteudoSemana(s: Semana) {
  return (
    <>
      <div className="mb-1 font-semibold text-stone-600">{s.periodo}</div>
      <LinhaDica traco="bloco" cor={s.atual ? COR_SEMANA.atual : COR_SEMANA.anterior} valor={numero(s.pedidos)} nome={s.atual ? 'pedidos até hoje' : 'pedidos'} />
      {s.estimativa ? <LinhaDica traco="bloco" cor={COR_SEMANA.estimativa} valor={`+${numero(s.estimativa)}`} nome="estimativa até domingo" /> : null}
      <div className="mt-1 text-stone-500">
        <span className="font-semibold text-carvao tabular-nums">{moeda(s.faturamento)}</span> faturados
      </div>
    </>
  )
}

export interface Serie {
  nome: string
  cor: string
  valores: (number | null)[]
}

// Linhas por dia da semana, com régua vertical que acompanha o dedo/mouse.
export function LinhasDias({ rotulos, series, formato = numero }: { rotulos: string[]; series: Serie[]; formato?: (n: number) => string }) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [i, setI] = useState<number | null>(null)
  const altura = 200
  const m = { topo: 14, base: 24, esq: 36, dir: 40 }
  const max = Math.max(1, ...series.flatMap((s) => s.valores.map((v) => v ?? 0)))
  const marcas = escala(max)
  const topo = marcas[marcas.length - 1]
  const h = altura - m.topo - m.base
  const passo = (largura - m.esq - m.dir) / Math.max(1, rotulos.length - 1)
  const x = (k: number) => m.esq + passo * k
  const y = (v: number) => m.topo + h - (v / topo) * h

  const mover = (clienteX: number, el: SVGSVGElement) => {
    const px = clienteX - el.getBoundingClientRect().left
    setI(Math.max(0, Math.min(rotulos.length - 1, Math.round((px - m.esq) / passo))))
  }

  return (
    <div ref={ref} className="relative">
      {largura > 0 && (
        <svg
          width={largura}
          height={altura}
          role="img"
          aria-label={series.map((s) => s.nome).join(' e ')}
          onPointerMove={(e) => mover(e.clientX, e.currentTarget)}
          onPointerLeave={() => setI(null)}
          className="touch-pan-y"
        >
          {marcas.map((v) => (
            <g key={v}>
              <line x1={m.esq} x2={largura - m.dir} y1={y(v)} y2={y(v)} stroke={v === 0 ? TINTA.base : TINTA.grade} strokeWidth={1} />
              <text x={m.esq - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill={TINTA.fraca} className="tabular-nums">
                {formato(v)}
              </text>
            </g>
          ))}
          {rotulos.map((r, k) => (
            <text key={r} x={x(k)} y={altura - 6} textAnchor="middle" fontSize={11} fill={k === i ? TINTA.forte : TINTA.fraca}>
              {r}
            </text>
          ))}
          {i !== null && <line x1={x(i)} x2={x(i)} y1={m.topo} y2={m.topo + h} stroke={TINTA.base} strokeWidth={1} />}
          {series.map((s) => {
            const pontos = s.valores.map((v, k) => (v === null ? null : ([x(k), y(v)] as const))).filter(Boolean) as (readonly [number, number])[]
            const ult = s.valores.reduce<number>((a, v, k) => (v === null ? a : k), -1)
            return (
              <g key={s.nome}>
                <polyline points={pontos.map((p) => p.join(',')).join(' ')} fill="none" stroke={s.cor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {ult >= 0 && (
                  <>
                    <circle cx={x(ult)} cy={y(s.valores[ult]!)} r={4} fill={s.cor} stroke="#fff" strokeWidth={2} />
                    <text x={x(ult) + 8} y={y(s.valores[ult]!)} dy="0.32em" fontSize={11} fontWeight={600} fill={TINTA.forte} className="tabular-nums">
                      {formato(s.valores[ult]!)}
                    </text>
                  </>
                )}
                {i !== null && s.valores[i] !== null && <circle cx={x(i)} cy={y(s.valores[i]!)} r={4} fill={s.cor} stroke="#fff" strokeWidth={2} />}
              </g>
            )
          })}
        </svg>
      )}
      <Dica
        largura={largura}
        dica={
          i === null
            ? null
            : {
                x: x(i),
                y: m.topo,
                conteudo: (
                  <>
                    <div className="mb-1 font-semibold text-stone-600">{rotulos[i]}</div>
                    {series.map((s) => (
                      <LinhaDica key={s.nome} cor={s.cor} nome={s.nome} valor={s.valores[i] === null ? '—' : formato(s.valores[i]!)} />
                    ))}
                  </>
                ),
              }
        }
      />
    </div>
  )
}

export interface Fatia {
  nome: string
  cor: string
  valor: number
  tintaClara?: boolean // texto branco por cima da cor
  detalhe?: string
}

// Barra 100% empilhada (participação de cada parte), com espaço de 2px entre as partes.
export function BarraParticipacao({ fatias, rotulo }: { fatias: Fatia[]; rotulo: string }) {
  const [dica, setDica] = useState<{ i: number; x: number } | null>(null)
  const [ref, largura] = useLargura<HTMLDivElement>()
  const total = fatias.reduce((a, f) => a + f.valor, 0) || 1
  let acumulado = 0
  return (
    <div ref={ref} className="relative" onPointerLeave={() => setDica(null)}>
      <div className="flex h-7 gap-0.5" role="img" aria-label={`${rotulo}: ${fatias.map((f) => `${f.nome} ${pct((f.valor / total) * 100)}`).join(', ')}`}>
        {fatias.map((f, i) => {
          const p = (f.valor / total) * 100
          const inicio = acumulado
          acumulado += p
          if (p <= 0) return null
          const primeira = i === fatias.findIndex((x) => x.valor > 0)
          const ultima = i === fatias.length - 1 - [...fatias].reverse().findIndex((x) => x.valor > 0)
          return (
            <div
              key={f.nome}
              tabIndex={0}
              onPointerMove={() => setDica({ i, x: ((inicio + p / 2) / 100) * largura })}
              onFocus={() => setDica({ i, x: ((inicio + p / 2) / 100) * largura })}
              onBlur={() => setDica(null)}
              className={`flex min-w-0 items-center justify-center text-[11px] font-semibold tabular-nums outline-none transition-opacity ${primeira ? 'rounded-l' : ''} ${ultima ? 'rounded-r' : ''} ${dica && dica.i !== i ? 'opacity-60' : ''}`}
              style={{ width: `${p}%`, background: f.cor, color: f.tintaClara ? '#fff' : TINTA.forte }}
            >
              {(p / 100) * largura >= 38 ? pct(p) : ''}
            </div>
          )
        })}
      </div>
      {dica && (
        <Dica
          largura={largura}
          dica={{
            x: dica.x,
            y: 30,
            conteudo: (
              <>
                <div className="mb-1 font-semibold text-stone-600">{rotulo}</div>
                <LinhaDica traco="bloco" cor={fatias[dica.i].cor} nome={fatias[dica.i].nome} valor={pct((fatias[dica.i].valor / total) * 100)} />
                {fatias[dica.i].detalhe && <div className="mt-0.5 text-stone-500">{fatias[dica.i].detalhe}</div>}
              </>
            ),
          }}
        />
      )}
    </div>
  )
}
