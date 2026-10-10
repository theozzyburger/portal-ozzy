import { useEffect, useState } from 'react'
import { Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { addMeses, hoje, mesDe, nomeMesAno } from '../lib/datas'
import { apelidoUnidade, type ResultadoMes } from '../lib/types'
import { reais } from '../lib/financeiro'

type Linha = Omit<ResultadoMes, 'unidadeId' | 'mes'>

const CAMPOS: Linha = {
  pedidos: 0, faturamento: 0, cmv: 0, impostos: 0, comissoes: 0, taxasPagamento: 0, custosOperacionais: 0, lucroOperacional: 0, ticketMedio: 0,
}

// Soma as lojas; o ticket médio é recalculado (faturamento ÷ pedidos), não somado.
function somar(linhas: ResultadoMes[]): Linha {
  const t = { ...CAMPOS }
  for (const l of linhas) for (const k of Object.keys(CAMPOS) as (keyof Linha)[]) t[k] += l[k]
  t.ticketMedio = t.pedidos ? t.faturamento / t.pedidos : 0
  return t
}

const DRE: { campo: keyof Linha; nome: string; sinal: '' | '−' | '=' }[] = [
  { campo: 'faturamento', nome: 'Faturamento', sinal: '' },
  { campo: 'cmv', nome: 'CMV (custo dos produtos)', sinal: '−' },
  { campo: 'impostos', nome: 'Impostos', sinal: '−' },
  { campo: 'comissoes', nome: 'Comissões das plataformas', sinal: '−' },
  { campo: 'taxasPagamento', nome: 'Taxas de pagamento', sinal: '−' },
  { campo: 'custosOperacionais', nome: 'Custos operacionais', sinal: '−' },
  { campo: 'lucroOperacional', nome: 'Lucro operacional', sinal: '=' },
]

const pct = (v: number, base: number) => (base ? `${((v / base) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—')
const mil = (n: number) => (Math.abs(n) >= 10000 ? `R$ ${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : reais(n))

// embutido: dentro do Painel da página inicial (sem título próprio).
export default function Financeiro({ embutido = false }: { embutido?: boolean }) {
  const { store, unidades } = useApp()
  const [dados, setDados] = useState<{ linhas: ResultadoMes[]; atualizadoEm: string | null } | null>(null)
  const [erro, setErro] = useState('')
  const [mes, setMes] = useState(mesDe(hoje()))
  const [loja, setLoja] = useState('')

  useEffect(() => {
    store.resultados().then((d) => {
      setDados(d)
      // Abre no mês mais recente que tiver dados.
      const meses = [...new Set(d.linhas.map((l) => l.mes))].sort()
      if (meses.length && !meses.includes(mesDe(hoje()))) setMes(meses[meses.length - 1])
    }, (e) => setErro(e.message))
  }, [store])

  if (erro) return <Vazio>{erro}</Vazio>
  if (!dados) return <p className="text-stone-400">Carregando…</p>

  const meses = [...new Set([...dados.linhas.map((l) => l.mes), mes])].sort().reverse()
  const daLoja = (l: ResultadoMes) => !loja || l.unidadeId === loja
  const atual = somar(dados.linhas.filter((l) => l.mes === mes && daLoja(l)))
  const anterior = somar(dados.linhas.filter((l) => l.mes === addMeses(mes, -1) && daLoja(l)))
  const lojas = unidades.filter((u) => dados.linhas.some((l) => l.unidadeId === u.id))
  const doMes = (id: string) => dados.linhas.find((l) => l.mes === mes && l.unidadeId === id)
  const parcial = mes === mesDe(hoje())

  return (
    <div className="space-y-4">
      {!embutido && (
        <div>
          <h1 className="text-xl font-bold">Resultado do mês</h1>
          <p className="text-sm text-stone-500">Do Lucro Fácil, {atualizadoEm(dados.atualizadoEm)}. Só Proprietário e Administrativo veem esta tela.</p>
        </div>
      )}

      {dados.linhas.length === 0 ? (
        <Vazio>O resultado ainda não foi copiado do Lucro Fácil.</Vazio>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <select className={`${estiloEntrada} w-auto!`} value={mes} onChange={(e) => setMes(e.target.value)}>
              {meses.map((m) => (
                <option key={m} value={m}>{nomeMesAno(m)}{m === mesDe(hoje()) ? ' (até hoje)' : ''}</option>
              ))}
            </select>
            <select className={`${estiloEntrada} w-auto!`} value={loja} onChange={(e) => setLoja(e.target.value)}>
              <option value="">Todas as lojas</option>
              {lojas.map((u) => (
                <option key={u.id} value={u.id}>{apelidoUnidade(u.nome)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Numero rotulo="Faturamento" valor={mil(atual.faturamento)} atual={atual.faturamento} antes={anterior.faturamento} parcial={parcial} destaque />
            <Numero rotulo="Pedidos" valor={atual.pedidos.toLocaleString('pt-BR')} atual={atual.pedidos} antes={anterior.pedidos} parcial={parcial} />
            <Numero rotulo="Ticket médio" valor={reais(atual.ticketMedio)} atual={atual.ticketMedio} antes={anterior.ticketMedio} />
            <Numero
              rotulo="Lucro operacional"
              valor={mil(atual.lucroOperacional)}
              detalhe={pct(atual.lucroOperacional, atual.faturamento) + ' do faturamento'}
            />
          </div>

          <div className="overflow-x-auto rounded-3xl bg-white ring-1 ring-stone-200">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
                  <th className="px-4 py-2.5 font-semibold">{nomeMesAno(mes)}</th>
                  {!loja && lojas.map((u) => (
                    <th key={u.id} className="px-3 py-2.5 text-right font-semibold">{apelidoUnidade(u.nome)}</th>
                  ))}
                  <th className="px-3 py-2.5 text-right font-semibold">{loja ? 'Valor' : 'Total'}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {DRE.map(({ campo, nome, sinal }) => (
                  <tr key={campo} className={sinal === '=' ? 'bg-stone-50 font-bold' : 'border-b border-stone-100'}>
                    <td className="px-4 py-2.5">
                      {sinal && <span className="mr-1.5 inline-block w-3 text-stone-400">{sinal}</span>}
                      {nome}
                    </td>
                    {!loja && lojas.map((u) => (
                      <td key={u.id} className="px-3 py-2.5 text-right tabular-nums">{reais(doMes(u.id)?.[campo] ?? 0)}</td>
                    ))}
                    <td className="px-3 py-2.5 text-right tabular-nums">{reais(atual[campo])}</td>
                    <td className="px-4 py-2.5 text-right text-stone-500 tabular-nums">{pct(atual[campo], atual.faturamento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-stone-500">
            O CMV usa as fichas técnicas do Lucro Fácil. Produto vendido sem ficha vinculada entra com custo zero, o que deixa o CMV
            menor e o lucro maior do que o real.{parcial && ' O mês atual vai até hoje; a comparação é com o mês anterior inteiro.'}
          </p>
        </>
      )}
    </div>
  )
}

function Numero({
  rotulo, valor, atual, antes, parcial, detalhe, destaque,
}: { rotulo: string; valor: string; atual?: number; antes?: number; parcial?: boolean; detalhe?: string; destaque?: boolean }) {
  // Mês em andamento contra o anterior inteiro não é comparação justa para totais.
  const variacao = atual != null && antes && !parcial ? ((atual - antes) / antes) * 100 : null
  return (
    <div className={`rounded-2xl p-3 ${destaque ? 'bg-carvao text-white' : 'bg-white ring-1 ring-stone-200'}`}>
      <div className={`text-sm ${destaque ? 'text-stone-300' : 'text-stone-500'}`}>{rotulo}</div>
      <div className="mt-0.5 text-xl font-bold tabular-nums">{valor}</div>
      {detalhe && <div className={`text-xs ${destaque ? 'text-stone-300' : 'text-stone-500'}`}>{detalhe}</div>}
      {variacao != null && (
        <div className={`text-xs font-semibold ${destaque ? (variacao >= 0 ? 'text-emerald-300' : 'text-red-300') : variacao >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
          {variacao >= 0 ? '▲' : '▼'} {Math.abs(variacao).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% vs mês anterior
        </div>
      )}
    </div>
  )
}

function atualizadoEm(iso: string | null) {
  if (!iso) return 'ainda não copiado'
  return 'atualizado em ' + new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
