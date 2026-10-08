import { useCallback, useEffect, useState } from 'react'
import Impressao from './Impressao'
import { Botao, Campo, Cartao, Modal, Selo, estiloEntrada } from './ui'
import logo from '../assets/logo.png'
import { useApp } from '../lib/contexto'
import { formatarCpf } from '../lib/cpf'
import { dataLonga, hoje } from '../lib/datas'
import { EMPRESAS } from '../lib/empresas'
import type { DevolucaoUniforme, EntregaUniforme, Funcionario, ItemDevolucao } from '../lib/types'

const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const falta = (i: ItemDevolucao) => Math.max(0, i.entregue - i.devolvido)

// Soma tudo o que a pessoa recebeu, por peça e tamanho.
function entregue(entregas: EntregaUniforme[]): Omit<ItemDevolucao, 'devolvido' | 'valor'>[] {
  const mapa = new Map<string, { item: string; tamanho?: string; entregue: number }>()
  for (const e of entregas)
    for (const i of e.itens) {
      // "Único" e sem tamanho são a mesma coisa.
      const tamanho = i.tamanho && i.tamanho !== 'Único' ? i.tamanho : undefined
      const chave = `${i.item.trim().toLowerCase()}|${tamanho ?? ''}`
      const x = mapa.get(chave)
      if (x) x.entregue += i.quantidade
      else mapa.set(chave, { item: i.item.trim(), tamanho, entregue: i.quantidade })
    }
  return [...mapa.values()].sort((a, b) => a.item.localeCompare(b.item))
}

// Valor da tabela: o nome exato ou a primeira palavra ("Camiseta preta" usa o de "Camiseta").
const valorDe = (tabela: Record<string, number>, item: string) => tabela[item] ?? tabela[item.split(' ')[0]] ?? 0

// Conferência da devolução de uniforme (reunião de RH de 08/10): o escritório confere o que voltou contra o que
// foi entregue; o que faltar é descontado pela tabela de valores.
export default function DevolucaoUniformes({ pessoa, entregas, gestao }: { pessoa: Funcionario; entregas: EntregaUniforme[]; gestao: boolean }) {
  const { store, nomeDe, avisar } = useApp()
  const [lista, setLista] = useState<DevolucaoUniforme[]>([])
  const [conferir, setConferir] = useState(false)
  const [imprimir, setImprimir] = useState<DevolucaoUniforme | null>(null)

  const carregar = useCallback(() => store.devolucoesUniforme(pessoa.id).then(setLista).catch(() => setLista([])), [store, pessoa.id])
  useEffect(() => {
    carregar()
  }, [carregar])

  if (!gestao && lista.length === 0) return null
  return (
    <div className="space-y-2 pt-3">
      <h3 className="text-sm font-semibold text-stone-700">Devolução</h3>
      {lista.map((d) => {
        const faltou = d.itens.reduce((t, i) => t + falta(i), 0)
        return (
          <Cartao key={d.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {dataLonga(d.data)}
                  {faltou === 0 ? <Selo cor="verde">Tudo devolvido</Selo> : <Selo cor="vermelho">Faltou {faltou} {faltou === 1 ? 'peça' : 'peças'}</Selo>}
                </div>
                <div className="mt-1 text-sm text-stone-700">
                  {d.totalDesconto > 0 ? <>Desconto na rescisão: <b>{reais(d.totalDesconto)}</b></> : 'Sem desconto'}
                </div>
                <div className="mt-1 text-xs text-stone-500">Conferido por {nomeDe(d.conferidoPor)}{d.observacao && ` · ${d.observacao}`}</div>
              </div>
              <div className="flex gap-2">
                <Botao variante="secundario" onClick={() => setImprimir(d)}>Imprimir termo</Botao>
                {gestao && (
                  <Botao
                    variante="fantasma"
                    onClick={async () => {
                      if (!confirm('Apagar esta conferência?')) return
                      await store.excluirDevolucao(d.id)
                      await carregar()
                      avisar('Conferência apagada')
                    }}
                  >
                    Apagar
                  </Botao>
                )}
              </div>
            </div>
          </Cartao>
        )
      })}
      {gestao && (
        <Botao variante="secundario" className="w-full" onClick={() => setConferir(true)} disabled={entregas.length === 0}>
          {entregas.length === 0 ? 'Nenhuma entrega registrada para conferir' : 'Conferir devolução de uniforme'}
        </Botao>
      )}
      {conferir && (
        <Conferir
          pessoa={pessoa}
          entregas={entregas}
          aoFechar={() => setConferir(false)}
          aoSalvar={async (d) => {
            setConferir(false)
            await carregar()
            avisar(d.totalDesconto > 0 ? `Devolução conferida: desconto de ${reais(d.totalDesconto)}` : 'Devolução conferida: tudo devolvido')
            setImprimir(d)
          }}
        />
      )}
      {imprimir && <TermoDevolucao d={imprimir} pessoa={pessoa} aoFechar={() => setImprimir(null)} />}
    </div>
  )
}

function Conferir({ pessoa, entregas, aoFechar, aoSalvar }: { pessoa: Funcionario; entregas: EntregaUniforme[]; aoFechar: () => void; aoSalvar: (d: DevolucaoUniforme) => void }) {
  const { store } = useApp()
  const [itens, setItens] = useState<(ItemDevolucao & { valorTexto: string })[]>([])
  const [tabela, setTabela] = useState<Record<string, number>>({})
  const [data, setData] = useState(pessoa.dataDesligamento && pessoa.dataDesligamento <= hoje() ? hoje() : hoje())
  const [observacao, setObservacao] = useState('')
  const [salvarTabela, setSalvarTabela] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    store.valoresUniforme().then((t) => {
      setTabela(t)
      setItens(entregue(entregas).map((i) => {
        const v = valorDe(t, i.item)
        return { ...i, devolvido: i.entregue, valor: v, valorTexto: v ? String(v).replace('.', ',') : '' }
      }))
    })
  }, [store, entregas])

  const mudar = (k: number, p: Partial<ItemDevolucao & { valorTexto: string }>) => setItens(itens.map((x, i) => (i === k ? { ...x, ...p } : x)))
  const numero = (s: string) => Number(s.replace(/\./g, '').replace(',', '.')) || 0
  const total = itens.reduce((t, i) => t + falta(i) * numero(i.valorTexto), 0)
  const semValor = itens.filter((i) => falta(i) > 0 && !numero(i.valorTexto))

  const salvar = async () => {
    setErro('')
    setSalvando(true)
    try {
      const final = itens.map(({ valorTexto, ...i }) => ({ ...i, valor: numero(valorTexto) }))
      if (salvarTabela) {
        const novos: Record<string, number> = {}
        for (const i of final) if (i.valor && valorDe(tabela, i.item) !== i.valor) novos[i.item] = i.valor
        if (Object.keys(novos).length) await store.salvarValoresUniforme(novos)
      }
      aoSalvar(await store.registrarDevolucao({ funcionarioId: pessoa.id, data, itens: final, observacao }))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal titulo="Conferir devolução de uniforme" aberto aoFechar={aoFechar}>
      <div className="space-y-4">
        <p className="text-sm text-stone-600">Tudo o que {pessoa.nome.split(' ')[0]} recebeu, somando as entregas. Ajuste quantas peças voltaram.</p>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_3.5rem_4.5rem_5.5rem] gap-2 text-[11px] font-semibold text-stone-500 uppercase">
            <span>Peça</span>
            <span className="text-center">Recebeu</span>
            <span className="text-center">Voltou</span>
            <span>Valor un.</span>
          </div>
          {itens.map((i, k) => (
            <div key={k} className={`grid grid-cols-[1fr_3.5rem_4.5rem_5.5rem] items-center gap-2 rounded-lg ${falta(i) ? 'bg-red-50' : ''}`}>
              <span className="min-w-0 text-sm">
                <span className="block truncate font-medium">{i.item}</span>
                {i.tamanho && <span className="text-xs text-stone-500">{i.tamanho}</span>}
              </span>
              <span className="text-center text-sm tabular-nums">{i.entregue}</span>
              <input
                className={`${estiloEntrada} text-center`}
                type="number" min={0} max={i.entregue} value={i.devolvido}
                onChange={(e) => mudar(k, { devolvido: Math.min(i.entregue, Math.max(0, Number(e.target.value))) })}
                aria-label={`Quantas ${i.item} voltaram`}
              />
              <input className={estiloEntrada} inputMode="decimal" placeholder="0,00" value={i.valorTexto} onChange={(e) => mudar(k, { valorTexto: e.target.value })} aria-label={`Valor de ${i.item}`} />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-xl bg-stone-100 px-3 py-2 text-sm">
          <span>Desconto na rescisão</span>
          <b className="text-base tabular-nums">{reais(total)}</b>
        </div>
        {semValor.length > 0 && <p className="text-sm text-amber-800">Falta o valor de: {semValor.map((i) => i.item).join(', ')}. Sem valor, não desconta.</p>}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data">
            <input className={estiloEntrada} type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo rotulo="Observação">
            <input className={estiloEntrada} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </Campo>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={salvarTabela} onChange={(e) => setSalvarTabela(e.target.checked)} />
          Guardar os valores na tabela de descontos
        </label>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" disabled={salvando || itens.length === 0} onClick={salvar}>
          {salvando ? 'Salvando…' : 'Salvar e gerar termo'}
        </Botao>
      </div>
    </Modal>
  )
}

function TermoDevolucao({ d, pessoa, aoFechar }: { d: DevolucaoUniforme; pessoa: Funcionario; aoFechar: () => void }) {
  const { nomeDe } = useApp()
  const empresa = EMPRESAS[pessoa.unidadeId] ?? EMPRESAS['burger-psd']
  return (
    <Impressao titulo={`Devolução de uniforme · ${pessoa.nome}`} aoFechar={aoFechar}>
      <header className="mb-6 flex items-center gap-4 border-b-2 border-black pb-3">
        <img src={logo} alt="The Ozzy" className="h-16 w-16 shrink-0" />
        <div className="text-xs leading-snug">
          <div className="text-base font-bold uppercase">{empresa.razaoSocial}</div>
          <div>CNPJ {empresa.cnpj}</div>
        </div>
      </header>
      <h1 className="mb-5 text-center text-lg font-bold tracking-wide uppercase">Termo de devolução de uniforme</h1>
      <p className="mb-4 text-justify">
        Colaborador(a): <b>{pessoa.nome}</b>{pessoa.cpf && <>, CPF {formatarCpf(pessoa.cpf)}</>}, cargo {pessoa.cargo}. Conferência feita em{' '}
        {d.data.split('-').reverse().join('/')}, comparando com os termos de recebimento assinados.
      </p>
      <table className="mb-4 w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y border-black text-left">
            <th className="py-1">Peça</th>
            <th className="py-1">Tam.</th>
            <th className="py-1 text-center">Recebeu</th>
            <th className="py-1 text-center">Devolveu</th>
            <th className="py-1 text-center">Faltou</th>
            <th className="py-1 text-right">Valor un.</th>
            <th className="py-1 text-right">Desconto</th>
          </tr>
        </thead>
        <tbody>
          {d.itens.map((i, k) => (
            <tr key={k} className="border-b border-stone-300">
              <td className="py-1">{i.item}</td>
              <td className="py-1">{i.tamanho ?? ''}</td>
              <td className="py-1 text-center">{i.entregue}</td>
              <td className="py-1 text-center">{i.devolvido}</td>
              <td className="py-1 text-center">{falta(i) || ''}</td>
              <td className="py-1 text-right">{i.valor ? reais(i.valor) : ''}</td>
              <td className="py-1 text-right">{falta(i) && i.valor ? reais(falta(i) * i.valor) : ''}</td>
            </tr>
          ))}
          <tr className="border-b border-black font-bold">
            <td colSpan={6} className="py-1">Total a descontar</td>
            <td className="py-1 text-right">{reais(d.totalDesconto)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mb-10 text-justify">
        {d.totalDesconto > 0 ? (
          <>
            Declaro que devolvi as peças acima e que não devolvi as indicadas como faltantes. Autorizo o desconto de <b>{reais(d.totalDesconto)}</b>{' '}
            na minha rescisão, conforme a tabela de valores da empresa e o termo de recebimento de uniforme.
          </>
        ) : (
          <>Declaro que devolvi todas as peças de uniforme que recebi, sem pendências.</>
        )}
        {d.observacao && <> Observação: {d.observacao}.</>}
      </p>
      <div className="grid grid-cols-2 gap-10 text-center text-[11px]">
        <div>
          <div className="mb-1 border-t border-black" />
          {pessoa.nome}
        </div>
        <div>
          <div className="mb-1 border-t border-black" />
          {nomeDe(d.conferidoPor)} (conferência)
        </div>
      </div>
      <p className="mt-6 text-[11px] text-stone-600">Se o(a) colaborador(a) se recusar a assinar, duas testemunhas assinam abaixo.</p>
      <div className="mt-10 grid grid-cols-2 gap-10 text-center text-[11px]">
        <div><div className="mb-1 border-t border-black" />Testemunha 1</div>
        <div><div className="mb-1 border-t border-black" />Testemunha 2</div>
      </div>
    </Impressao>
  )
}
