import { useEffect, useState } from 'react'
import { Botao, Modal, Selo, estiloEntrada } from './ui'
import { useApp } from '../lib/contexto'
import { NOMES_VALORES, aplicarValores, juntarValores, lerHolerites, liquidoLido, separarPaginas, type ValoresHolerite } from '../lib/holerite'
import { nomeMesAno } from '../lib/datas'
import { dataPagamento, diaMes, salarioVazio } from '../lib/salarios'
import { reais } from '../lib/financeiro'
import type { Funcionario, RubricaHolerite, Salario } from '../lib/types'

interface Grupo {
  chave: string
  arquivo: File
  paginas: number[]
  texto: string
  funcionarioId: string
  valores: ValoresHolerite
  rubricas: RubricaHolerite[]
  nome: string | null
  mes: string | null
  aplicar: boolean
}

// Lê os PDFs da contabilidade, separa por pessoa e mostra o que achou para a gestão conferir antes de gravar.
export default function ImportarHolerites({ arquivos, pessoas, lancamento, aoFechar, aoConcluir }: {
  arquivos: File[]
  pessoas: Funcionario[]
  lancamento: (p: Funcionario) => Salario
  aoFechar: () => void
  aoConcluir: (n: number, mes: string | null) => void
}) {
  const { store, equipe } = useApp()
  const [grupos, setGrupos] = useState<Grupo[] | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const todos: Grupo[] = []
        for (const arquivo of arquivos) {
          const paginas = await lerHolerites(arquivo, equipe)
          // Páginas seguidas da mesma pessoa (frente e verso, 2 vias) viram um grupo só.
          for (const p of paginas) {
            const id = p.funcionarioId ?? ''
            const ultimo = todos[todos.length - 1]
            if (ultimo && ultimo.arquivo === arquivo && ultimo.funcionarioId === id && id) {
              ultimo.paginas.push(p.pagina)
              // Página repetida (2ª via) não soma; continuação (rubricas que não couberam) soma.
              if (p.texto === ultimo.texto) continue
              ultimo.texto = p.texto
              ultimo.valores = juntarValores(ultimo.valores, p.valores)
              ultimo.rubricas = [...ultimo.rubricas, ...p.rubricas]
            } else {
              todos.push({ chave: `${arquivo.name}-${p.pagina}`, arquivo, paginas: [p.pagina], texto: p.texto, funcionarioId: id, valores: { ...p.valores }, rubricas: p.rubricas, nome: p.nome, mes: p.mes, aplicar: true })
            }
          }
        }
        setGrupos(todos)
      } catch (e) {
        setErro('Não consegui ler esse PDF: ' + (e as Error).message)
        setGrupos([])
      }
    })()
    // Lê uma vez, quando a janela abre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mudar = (i: number, m: Partial<Grupo>) => setGrupos(grupos!.map((g, j) => (j === i ? { ...g, ...m } : g)))
  const prontos = grupos?.filter((g) => g.funcionarioId) ?? []

  const gravar = async () => {
    setSalvando(true)
    setErro('')
    try {
      // O holerite mensal vai para o pagamento de salário do mês dele (o do dia 05), mesmo que a tela esteja em outro.
      const doMes = new Map<string, Salario[]>()
      for (const g of prontos) {
        const p = equipe.find((f) => f.id === g.funcionarioId)!
        let s = lancamento(p)
        if (g.mes && (g.mes !== s.mes || s.tipo !== 'salario')) {
          if (!doMes.has(g.mes)) doMes.set(g.mes, await store.salarios(g.mes))
          s = doMes.get(g.mes)!.find((x) => x.funcionarioId === p.id && x.tipo === 'salario') ?? salarioVazio(p, { mes: g.mes, tipo: 'salario' })
        }
        if (g.aplicar) s = aplicarValores(s, g.valores, g.rubricas)
        await store.salvarSalario(s)
        await store.enviarHolerite(s, await separarPaginas(g.arquivo, g.paginas))
      }
      aoConcluir(prontos.length, prontos.find((g) => g.mes)?.mes ?? null)
    } catch (e) {
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  return (
    <Modal titulo="Importar holerites" aberto aoFechar={aoFechar}>
      {!grupos ? (
        <p className="py-6 text-center text-stone-500">Lendo o PDF…</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-stone-600">
            Confira cada pessoa e os valores encontrados. O holerite de cada um é separado do PDF e fica no perfil dela quando o mês for liberado.
          </p>
          {grupos.length === 0 && !erro && <p className="text-sm text-stone-500">Nenhuma página encontrada.</p>}
          {grupos.map((g, i) => {
            const achados = (Object.entries(g.valores) as [keyof ValoresHolerite, number][]).filter(([k]) => k !== 'liquido')
            const confere = g.valores.liquido === undefined ? null : Math.abs(liquidoLido(g.valores) - g.valores.liquido) < 0.01
            return (
              <div key={g.chave} className={`space-y-2 rounded-xl p-3 ring-1 ${g.funcionarioId ? 'ring-stone-200' : 'bg-ozzy-50 ring-ozzy-300'}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                  <span className="truncate">{g.arquivo.name}</span>
                  <span>· página{g.paginas.length > 1 ? 's' : ''} {g.paginas.join(', ')}</span>
                  {!g.funcionarioId && <Selo cor="ambar">Escolha a pessoa</Selo>}
                </div>
                {g.nome && <p className="text-sm font-semibold">{g.nome}</p>}
                {g.mes && <p className="text-xs text-stone-500">Vai para o salário de {nomeMesAno(g.mes)} (pago em {diaMes(dataPagamento({ mes: g.mes, tipo: 'salario' }))})</p>}
                <select className={`${estiloEntrada} py-2!`} value={g.funcionarioId} onChange={(e) => mudar(i, { funcionarioId: e.target.value })} aria-label={`Pessoa da página ${g.paginas[0]}`}>
                  <option value="">Ignorar esta página</option>
                  {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                {achados.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
                      {achados.map(([k, v]) => (
                        <span key={k}><span className="text-stone-500">{NOMES_VALORES[k]}</span> <b className="tabular-nums">{reais(v)}</b></span>
                      ))}
                    </div>
                    {g.rubricas.length > 0 && (
                      <p className="text-xs text-stone-500">Outros: {g.rubricas.map((r) => `${r.descricao} ${r.tipo === 'desconto' ? '−' : '+'}${reais(r.valor)}`).join(' · ')}</p>
                    )}
                    {confere !== null && (
                      <p className={`text-xs font-semibold ${confere ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {confere ? `✓ Líquido do holerite confere: ${reais(g.valores.liquido!)}` : `Líquido do holerite ${reais(g.valores.liquido!)} não bate com a soma lida (${reais(liquidoLido(g.valores))}); confira no lançamento.`}
                      </p>
                    )}
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="size-4 accent-carvao" checked={g.aplicar} onChange={(e) => mudar(i, { aplicar: e.target.checked })} />
                      Preencher o lançamento com esses valores
                    </label>
                  </>
                ) : (
                  <p className="text-xs text-stone-500">Não reconheci valores nesta página; só o PDF será anexado.</p>
                )}
              </div>
            )
          })}
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <Botao className="w-full" disabled={salvando || !prontos.length} onClick={gravar}>
            {salvando ? 'Gravando…' : `Gravar ${prontos.length} holerite${prontos.length === 1 ? '' : 's'}`}
          </Botao>
        </div>
      )}
    </Modal>
  )
}
