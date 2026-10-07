import { useEffect, useMemo, useState } from 'react'
import { Avatar, Botao, Campo, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { calcularCaixinha } from '../lib/caixinha'
import { hoje, nomeMesAno, primeiroDia, ultimoDia } from '../lib/datas'
import {
  anterior, baixar, creditosDe, csv, dataPagamento, descontosDe, diaMes, liquido, nomeTipo, proximo, proximoPagamento, salarioVazio,
  totalCreditos, totalDescontos, vtDe, type CampoValor, type Pagamento,
} from '../lib/salarios'
import { apelidoUnidade, type Funcionario, type Salario } from '../lib/types'
import { reais } from './Fichas'
import ImportarHolerites from '../components/ImportarHolerites'
import { lerHolerites, aplicarValores } from '../lib/holerite'

const num = (n: number) => (n ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')
const lerValor = (t: string) => Math.max(0, Number(t.replace(/[^\d,]/g, '').replace(',', '.')) || 0)

export default function Salarios() {
  const { store, equipe, unidades, nomeUnidade, avisar } = useApp()
  // Abre no próximo pagamento: adiantamento (dia 20) ou salário (dia 05).
  const [pag, setPag] = useState<Pagamento>(() => proximoPagamento(hoje()))
  const { mes, tipo } = pag
  const [todas, setTodas] = useState<Salario[] | null>(null)
  const [loja, setLoja] = useState('')
  const [editando, setEditando] = useState<Funcionario | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [importando, setImportando] = useState<File[] | null>(null)

  const carregar = () => store.salarios(mes).then(setTodas)
  useEffect(() => {
    setTodas(null)
    store.salarios(mes).then(setTodas)
  }, [store, mes])
  const linhas = useMemo(() => todas?.filter((l) => l.tipo === tipo) ?? null, [todas, tipo])

  // Quem estava na empresa no mês, mais quem já tem lançamento.
  const pessoas = useMemo(() => {
    const fim = ultimoDia(mes)
    const ini = primeiroDia(mes)
    return equipe
      .filter((p) => p.nivel !== 'proprietario')
      .filter((p) => linhas?.some((l) => l.funcionarioId === p.id) || (p.dataAdmissao <= fim && (p.status === 'ativo' || (p.dataDesligamento ?? '') >= ini)))
      .filter((p) => !loja || p.unidadeId === loja)
      .sort((a, b) => a.unidadeId.localeCompare(b.unidadeId) || a.nome.localeCompare(b.nome))
  }, [equipe, linhas, mes, loja])

  if (!linhas) return <p className="text-stone-400">Carregando…</p>

  const doMes = (id: string) => linhas.find((l) => l.funcionarioId === id)
  // Salário novo já vem com o adiantamento do dia 20 para descontar e o VT de quem optou.
  const novo = (p: Funcionario): Salario => {
    const s = salarioVazio(p, pag)
    if (tipo === 'salario') s.descAdiantamento = todas?.find((l) => l.funcionarioId === p.id && l.tipo === 'adiantamento')?.salario ?? 0
    return s
  }
  const lancadas = pessoas.map((p) => doMes(p.id)).filter((l): l is Salario => !!l)
  const total = lancadas.reduce((t, l) => t + liquido(l), 0)
  const liberado = linhas.length > 0 && linhas.every((l) => l.liberado)

  const puxarCaixinha = async () => {
    setOcupado(true)
    try {
      const [totais, ocorrencias] = await Promise.all([store.caixinhaTotais(mes), store.ocorrenciasEntre(primeiroDia(mes), ultimoDia(mes))])
      const { linhas: cx } = calcularCaixinha(equipe, ocorrencias, totais)
      if (!cx.some((c) => c.total > 0)) return avisar(`A caixinha de ${nomeMesAno(mes)} ainda não foi lançada`)
      for (const c of cx) {
        const atual = doMes(c.pessoa.id) ?? novo(c.pessoa)
        await store.salvarSalario({ ...atual, caixinha: Math.round(c.parte * 100) / 100, bonusCaixinha: Math.round(c.bonus * 100) / 100 })
      }
      await carregar()
      avisar(`Caixinha de ${cx.length} pessoas preenchida`)
    } finally {
      setOcupado(false)
    }
  }

  const alternarLiberacao = async () => {
    await store.liberarSalarios(mes, tipo, !liberado)
    await carregar()
    avisar(liberado ? 'A equipe não vê mais este mês' : 'Cada pessoa já pode ver o seu salário no perfil')
  }

  const arquivoBanco = () => {
    const semPix = lancadas.filter((l) => !equipe.find((p) => p.id === l.funcionarioId)?.pix)
    baixar(
      `${tipo}-${mes}${loja ? '-' + loja : ''}.csv`,
      csv([
        ['Nome', 'Chave Pix', 'Valor'],
        ...lancadas.filter((l) => liquido(l) > 0).map((l) => {
          const p = equipe.find((x) => x.id === l.funcionarioId)!
          return [p.nome, p.pix ?? '', liquido(l)]
        }),
      ]),
    )
    if (semPix.length) avisar(`${semPix.length} pessoa(s) sem chave Pix no cadastro`)
  }

  const planilhaCompleta = () =>
    baixar(
      `${tipo}-${mes}-completo.csv`,
      csv([
        ['Nome', 'Cargo', 'Loja', 'Chave Pix', ...creditosDe(tipo).map((c) => c.nome), ...descontosDe(tipo).map((d) => d.nome), 'Total a receber', 'Observação'],
        ...lancadas.map((l) => {
          const p = equipe.find((x) => x.id === l.funcionarioId)!
          return [p.nome, p.cargo, apelidoUnidade(nomeUnidade(p.unidadeId)), p.pix ?? '', ...creditosDe(tipo).map((c) => l[c.campo]), ...descontosDe(tipo).map((d) => l[d.campo]), liquido(l), l.observacao ?? '']
        }),
      ]),
    )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Salários</h1>
          <p className="text-sm text-stone-500">Valores que a contabilidade mandou. Só Gerente, Administrativo e Proprietário veem esta aba.</p>
        </div>
        <div className="flex items-center rounded-xl bg-white ring-1 ring-stone-300">
          <button onClick={() => setPag(anterior(pag))} className="px-3 py-2 font-semibold text-stone-600 hover:text-carvao" aria-label="Pagamento anterior">‹</button>
          <span className="min-w-44 py-1 text-center leading-tight">
            <span className="block text-sm font-semibold">{nomeTipo(tipo)} · {diaMes(dataPagamento(pag))}</span>
            <span className="block text-xs text-stone-500">referente a {nomeMesAno(mes)}</span>
          </span>
          <button
            onClick={() => setPag(proximo(pag))}
            disabled={dataPagamento(pag) > dataPagamento(proximoPagamento(hoje()))}
            className="px-3 py-2 font-semibold text-stone-600 hover:text-carvao disabled:opacity-30"
            aria-label="Próximo pagamento"
          >›</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-carvao p-3 text-white">
          <div className="text-sm text-stone-300">Total a pagar em {diaMes(dataPagamento(pag))}</div>
          <div className="mt-0.5 text-xl font-bold tabular-nums">{reais(total)}</div>
        </div>
        <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
          <div className="text-sm text-stone-500">Lançados</div>
          <div className="mt-0.5 text-xl font-bold tabular-nums">{lancadas.length} de {pessoas.length}</div>
        </div>
        <div className="col-span-2 rounded-2xl bg-white p-3 ring-1 ring-stone-200 sm:col-span-1">
          <div className="text-sm text-stone-500">Equipe vê no perfil?</div>
          <div className="mt-1">{liberado ? <Selo cor="verde">Liberado</Selo> : <Selo>Ainda não</Selo>}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className={`${estiloEntrada} w-auto!`} value={loja} onChange={(e) => setLoja(e.target.value)} aria-label="Loja">
          <option value="">Todas as lojas</option>
          {unidades.map((u) => <option key={u.id} value={u.id}>{apelidoUnidade(u.nome)}</option>)}
        </select>
        {tipo === 'salario' && <Botao variante="secundario" onClick={puxarCaixinha} disabled={ocupado}>Puxar caixinha do mês</Botao>}
        <label className="inline-flex cursor-pointer items-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold ring-1 ring-stone-300 hover:ring-carvao">
          Importar holerites (PDF)
          <input
            type="file"
            accept="application/pdf"
            multiple
            className="sr-only"
            onChange={(e) => {
              const fs = [...(e.target.files ?? [])]
              e.target.value = ''
              if (fs.length) setImportando(fs)
            }}
          />
        </label>
        <Botao variante="secundario" onClick={arquivoBanco} disabled={!lancadas.length}>Arquivo do banco</Botao>
        <Botao variante="secundario" onClick={planilhaCompleta} disabled={!lancadas.length}>Planilha completa</Botao>
        <Botao variante={liberado ? 'perigo' : 'primario'} onClick={alternarLiberacao} disabled={!linhas.length}>
          {liberado ? 'Tirar da visão da equipe' : 'Liberar para a equipe'}
        </Botao>
      </div>

      {pessoas.length === 0 ? (
        <Vazio>Ninguém na equipe neste mês.</Vazio>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-white ring-1 ring-stone-200">
          {pessoas.map((p) => {
            const l = doMes(p.id)
            return (
              <li key={p.id}>
                <button onClick={() => setEditando(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50">
                  <Avatar nome={p.nome} foto={p.fotoUrl} tamanho={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{p.nome}</div>
                    <div className="truncate text-xs text-stone-500">
                      {p.cargo} · {apelidoUnidade(nomeUnidade(p.unidadeId))}{p.optaVt ? ' · VT' : ''}{!p.pix ? ' · sem Pix' : ''}
                    </div>
                  </div>
                  {l ? (
                    <div className="text-right">
                      <div className="font-bold tabular-nums">{l.holerite && <span className="mr-1 text-xs font-semibold text-sky-700" title="Holerite anexado">PDF</span>}{reais(liquido(l))}</div>
                      <div className="text-xs text-stone-500 tabular-nums">−{reais(totalDescontos(l))}</div>
                    </div>
                  ) : (
                    <Selo cor="ambar">Lançar</Selo>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-xs text-stone-500">
        O arquivo do banco traz nome, chave Pix e valor de cada pessoa (CSV, abre no Excel). Confira os valores antes de subir no banco.
      </p>

      {importando && (
        <ImportarHolerites
          arquivos={importando}
          pessoas={pessoas}
          lancamento={(p) => doMes(p.id) ?? novo(p)}
          aoFechar={() => setImportando(null)}
          aoConcluir={async (n) => {
            setImportando(null)
            await carregar()
            avisar(`${n} holerite${n === 1 ? '' : 's'} anexado${n === 1 ? '' : 's'}`)
          }}
        />
      )}
      {editando && (
        <FormSalario
          pessoa={editando}
          atual={doMes(editando.id) ?? novo(editando)}
          aoFechar={() => setEditando(null)}
          aoSalvar={async (s, pdf) => {
            await store.salvarSalario(s)
            if (pdf) await store.enviarHolerite(s, pdf)
            await carregar()
            avisar('Salário salvo')
            setEditando(null)
          }}
        />
      )}
    </div>
  )
}

function FormSalario({ pessoa, atual, aoFechar, aoSalvar }: { pessoa: Funcionario; atual: Salario; aoFechar: () => void; aoSalvar: (s: Salario, pdf?: Blob) => Promise<void> }) {
  const { store, equipe, avisar } = useApp()
  const [pdf, setPdf] = useState<File | null>(null)
  const [lendo, setLendo] = useState(false)
  const creditos = creditosDe(atual.tipo)
  const descontos = descontosDe(atual.tipo)
  const [v, setV] = useState(() => Object.fromEntries([...creditos, ...descontos].map((c) => [c.campo, num(atual[c.campo])])) as Record<CampoValor, string>)
  const [obs, setObs] = useState(atual.observacao ?? '')
  const [salvando, setSalvando] = useState(false)
  const s: Salario = { ...atual, observacao: obs, ...(Object.fromEntries(Object.entries(v).map(([k, t]) => [k, lerValor(t)])) as Record<CampoValor, number>) }

  const mudar = (campo: CampoValor, texto: string) => {
    const novo = { ...v, [campo]: texto }
    // Com VT, o desconto acompanha o salário enquanto não for digitado à mão.
    if (atual.tipo === 'salario' && campo === 'salario' && pessoa.optaVt && lerValor(v.descVt) === vtDe(lerValor(v.salario))) novo.descVt = num(vtDe(lerValor(texto)))
    setV(novo)
  }

  const entrada = (c: { campo: CampoValor; nome: string }, dica?: string) => (
    <Campo key={c.campo} rotulo={c.nome} dica={dica}>
      <input className={`${estiloEntrada} tabular-nums`} inputMode="decimal" placeholder="0,00" value={v[c.campo]} onChange={(e) => mudar(c.campo, e.target.value)} />
    </Campo>
  )

  return (
    <Modal titulo={`${pessoa.nome.split(' ')[0]} · ${nomeTipo(atual.tipo)} de ${diaMes(dataPagamento(atual))}`} aberto aoFechar={aoFechar}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setSalvando(true)
          try { await aoSalvar(s, pdf ?? undefined) } finally { setSalvando(false) }
        }}
      >
        <div>
          <h3 className="mb-2 text-sm font-bold text-emerald-700">Recebe</h3>
          <div className="grid grid-cols-2 gap-3">{creditos.map((c) => entrada(c))}</div>
        </div>
        {descontos.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-bold text-red-700">Descontos</h3>
            <div className="grid grid-cols-2 gap-3">
              {descontos.map((d) =>
                entrada(d, d.campo === 'descVt' ? (pessoa.optaVt ? `6% de ${reais(s.salario)} = ${reais(vtDe(s.salario))}` : 'Não optou pelo VT') : undefined),
              )}
            </div>
          </div>
        )}
        <div className="space-y-2 rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">Holerite (PDF)</span>
            {atual.holerite && (
              <Botao type="button" variante="secundario" onClick={async () => {
                const url = await store.abrirHolerite(atual)
                if (url) window.open(url, '_blank')
                else avisar('Não deu para abrir o holerite')
              }}>Ver o anexado</Botao>
            )}
          </div>
          <input
            type="file"
            accept="application/pdf"
            aria-label="Anexar holerite"
            className="block w-full text-sm"
            onChange={async (e) => {
              const f = e.target.files?.[0] ?? null
              setPdf(f)
              if (!f) return
              setLendo(true)
              try {
                // Preenche os campos com o que achar no PDF; dá para corrigir antes de salvar.
                const paginas = await lerHolerites(f, equipe)
                const pagina = paginas.find((p) => p.funcionarioId === pessoa.id) ?? paginas[0]
                if (pagina) {
                  const novo = aplicarValores(s, pagina.valores)
                  setV(Object.fromEntries([...creditos, ...descontos].map((c) => [c.campo, num(novo[c.campo])])) as Record<CampoValor, string>)
                  avisar(Object.keys(pagina.valores).length ? 'Valores preenchidos pelo holerite: confira' : 'PDF anexado (não reconheci valores)')
                }
              } catch {
                avisar('Não consegui ler esse PDF, mas ele será anexado')
              } finally {
                setLendo(false)
              }
            }}
          />
          {lendo && <p className="text-xs text-stone-500">Lendo o holerite…</p>}
        </div>
        <Campo rotulo="Observação (a pessoa vê)">
          <input className={estiloEntrada} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: adiantamento descontado" />
        </Campo>
        <div className="flex items-center justify-between rounded-2xl bg-stone-100 px-4 py-3">
          <span className="text-sm text-stone-600">Total a receber</span>
          <span className="text-xl font-bold tabular-nums">{reais(liquido(s))}</span>
        </div>
        <Botao className="w-full" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Botao>
      </form>
    </Modal>
  )
}

// Detalhe de um mês, como a pessoa vê no perfil.
export function Contracheque({ s }: { s: Salario }) {
  const { store, avisar } = useApp()
  const linha = (nome: string, valor: number, sinal: '+' | '−') =>
    valor > 0 && (
      <div key={nome} className="flex justify-between py-1 text-sm">
        <span className="text-stone-600">{nome}</span>
        <span className={`tabular-nums ${sinal === '−' ? 'text-red-700' : ''}`}>{sinal === '−' ? '−' : ''}{reais(valor)}</span>
      </div>
    )
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h3 className="font-bold">{nomeTipo(s.tipo)} · {diaMes(dataPagamento(s))}</h3>
          <p className="text-xs text-stone-500">referente a {nomeMesAno(s.mes)}</p>
        </div>
        {!s.liberado && <Selo>Só a gestão vê</Selo>}
      </div>
      {creditosDe(s.tipo).map((c) => linha(c.nome, s[c.campo], '+'))}
      {s.tipo === 'salario' && (
        <div className="flex justify-between border-t border-stone-100 py-1 text-sm font-semibold">
          <span>Total bruto</span>
          <span className="tabular-nums">{reais(totalCreditos(s))}</span>
        </div>
      )}
      {descontosDe(s.tipo).map((d) => linha(d.nome, s[d.campo], '−'))}
      <div className="mt-1 flex justify-between rounded-xl bg-ozzy-400 px-3 py-2 font-bold">
        <span>Total recebido</span>
        <span className="tabular-nums">{reais(liquido(s))}</span>
      </div>
      {s.observacao && <p className="mt-2 text-xs text-stone-500">{s.observacao}</p>}
      {s.holerite && (
        <Botao variante="secundario" className="mt-3 w-full" onClick={async () => {
          const url = await store.abrirHolerite(s)
          if (url) window.open(url, '_blank')
          else avisar('Não deu para abrir o holerite agora')
        }}>
          Abrir holerite (PDF)
        </Botao>
      )}
    </div>
  )
}
