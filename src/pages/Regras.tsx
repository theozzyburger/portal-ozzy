import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Assinatura from '../components/Assinatura'
import { Botao, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { podeGerenciar } from '../lib/permissoes'
import { lerRegulamento, mudancas, termoRegulamento, type Secao } from '../lib/regulamento'
import { nomeCurto, type LeituraRegulamento, type VersaoRegulamento } from '../lib/types'

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

export default function Regras() {
  const { eu, store, equipe, nomeDe, avisar } = useApp()
  const gestao = podeGerenciar(eu.nivel)
  const [versoes, setVersoes] = useState<VersaoRegulamento[]>([])
  const [leituras, setLeituras] = useState<LeituraRegulamento[]>([])
  const [assinatura, setAssinatura] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [erro, setErro] = useState('')
  const fim = useRef<HTMLDivElement>(null)

  const carregar = useCallback(
    () => Promise.all([store.versoesRegulamento(), store.leiturasRegulamento()]).then(([v, l]) => {
      setVersoes(v)
      setLeituras(l)
    }),
    [store],
  )
  useEffect(() => {
    carregar()
  }, [carregar])

  const atual = versoes[0]
  const doc = useMemo(() => (atual ? lerRegulamento(atual.texto) : null), [atual])
  if (!atual || !doc) return <p className="text-stone-400">Carregando…</p>

  const daVersao = leituras.filter((l) => l.versaoId === atual.id)
  const minha = daVersao.find((l) => l.funcionarioId === eu.id)
  const minhaAnterior = !minha && leituras.some((l) => l.funcionarioId === eu.id)
  const anterior = versoes[1]
  const ativos = equipe.filter((f) => f.status === 'ativo')
  const faltam = ativos.filter((f) => !daVersao.some((l) => l.funcionarioId === f.id))

  const ir = (id: string) => document.getElementById('reg-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const assinar = async () => {
    try {
      setErro('')
      await store.assinarRegulamento(atual.id, assinatura!)
      await carregar()
      avisar('Regulamento assinado')
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="rotulo-marca text-[11px] text-stone-500 print:hidden">Regras e processos</div>
          <h1 className="text-xl font-bold">{doc.titulo ?? 'Regulamento interno'}</h1>
          <p className="text-sm text-stone-500">
            Versão {atual.numero}, publicada em {dia(atual.publicadoEm)}. Vale para todas as unidades.
          </p>
        </div>
        {gestao && (
          <Botao variante="secundario" onClick={() => setEditando(true)} className="print:hidden">
            Publicar nova versão
          </Botao>
        )}
      </div>

      {minha ? (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-800 ring-1 ring-emerald-200 print:hidden">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-bold text-white">✓</span>
          <span className="text-sm">
            <b>Você assinou esta versão</b> em {quando(minha.assinadoEm)}.
          </span>
        </div>
      ) : (
        <button
          onClick={() => fim.current?.scrollIntoView({ behavior: 'smooth' })}
          className="flex w-full items-center gap-3 rounded-2xl bg-ozzy-400 p-4 text-left text-carvao print:hidden"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-carvao text-lg font-bold text-ozzy-400">!</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{minhaAnterior ? 'O regulamento mudou: leia e assine de novo' : 'Leia com atenção e assine no final'}</span>
            <span className="block text-sm">A assinatura fica guardada no seu cadastro.</span>
          </span>
          <span className="text-xl">↓</span>
        </button>
      )}

      {anterior && <OQueMudou anterior={anterior} atual={atual} />}

      {gestao && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200 print:hidden">
          <div className="flex items-baseline justify-between gap-2">
            <div className="font-bold">Assinaturas da versão {atual.numero}</div>
            <div className="text-sm tabular-nums text-stone-600">
              {ativos.length - faltam.length} de {ativos.length}
            </div>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full bg-carvao" style={{ width: `${ativos.length ? ((ativos.length - faltam.length) / ativos.length) * 100 : 0}%` }} />
          </div>
          {faltam.length > 0 ? (
            <p className="mt-2 text-sm text-stone-600">
              <span className="font-semibold text-stone-800">Faltam assinar:</span> {faltam.map((f) => nomeCurto(f.nome)).join(', ')}
            </p>
          ) : (
            <p className="mt-2 text-sm text-emerald-700">Toda a equipe ativa já assinou.</p>
          )}
          {versoes.length > 1 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold text-stone-700">Versões anteriores</summary>
              <ul className="mt-2 space-y-1.5">
                {versoes.slice(1).map((v) => (
                  <li key={v.id} className="text-stone-600">
                    <b className="text-stone-800">Versão {v.numero}</b>, {dia(v.publicadoEm)}
                    {v.publicadoPor && ` por ${nomeCurto(nomeDe(v.publicadoPor))}`}: {leituras.filter((l) => l.versaoId === v.id).length} assinaturas
                    {v.nota && <span className="block text-xs text-stone-500">{v.nota}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <nav className="flex gap-1.5 overflow-x-auto pb-1 print:hidden" aria-label="Seções do regulamento">
        {doc.secoes.filter((s) => s.titulo).map((s) => (
          <button key={s.id} onClick={() => ir(s.id)} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-stone-600 ring-1 ring-stone-300 hover:text-carvao">
            {s.titulo}
          </button>
        ))}
      </nav>

      <article className="rounded-2xl bg-white p-5 ring-1 ring-stone-200 sm:p-7 print:p-0 print:ring-0">
        <ConteudoRegulamento secoes={doc.secoes} />
      </article>

      <div ref={fim} className="scroll-mt-32 rounded-2xl bg-white p-5 ring-1 ring-stone-200 print:break-inside-avoid print:ring-0">
        <h2 className="mb-2 font-bold">Assinatura</h2>
        <p className="rounded-xl bg-stone-50 p-3 text-sm leading-relaxed text-stone-700">{termoRegulamento(eu.nome, atual.numero, dia(atual.publicadoEm))}</p>
        {minha ? (
          <div className="mt-3">
            <img src={minha.assinatura} alt={`Assinatura de ${eu.nome}`} className="h-24 w-full rounded-xl border border-stone-200 bg-white object-contain" />
            <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs text-stone-600 sm:grid-cols-[auto_1fr]">
              <dt className="font-semibold text-stone-800">Assinado em</dt>
              <dd>{quando(minha.assinadoEm)}, pelo próprio login no portal</dd>
              <dt className="font-semibold text-stone-800">Código do texto</dt>
              <dd className="font-mono break-all">{minha.hash || '—'}</dd>
              {minha.ip && (
                <>
                  <dt className="font-semibold text-stone-800">IP</dt>
                  <dd>{minha.ip}</dd>
                </>
              )}
              {minha.dispositivo && (
                <>
                  <dt className="font-semibold text-stone-800">Aparelho</dt>
                  <dd className="break-all">{minha.dispositivo}</dd>
                </>
              )}
            </dl>
            <Botao variante="secundario" className="mt-3 print:hidden" onClick={() => window.print()}>
              Imprimir ou salvar em PDF
            </Botao>
          </div>
        ) : (
          <div className="mt-3 space-y-3 print:hidden">
            <Assinatura aoMudar={setAssinatura} />
            <Botao className="w-full" disabled={!assinatura} onClick={assinar}>
              Li e concordo, assinar
            </Botao>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-stone-500 print:hidden">Em breve aqui: POPs por área, manual de exceções e um assistente que tira dúvidas só com base nas regras oficiais.</p>

      {editando && (
        <Editor
          atual={atual}
          totalAtivos={ativos.length}
          aoFechar={() => setEditando(false)}
          aoPublicar={async () => {
            setEditando(false)
            await carregar()
            avisar('Nova versão publicada. A equipe vai ser avisada para assinar.')
          }}
        />
      )}
    </div>
  )
}

function OQueMudou({ anterior, atual }: { anterior: VersaoRegulamento; atual: VersaoRegulamento }) {
  const m = mudancas(anterior.texto, atual.texto)
  const linhas: [string, string[]][] = [
    ['Seções novas', m.novas],
    ['Seções alteradas', m.alteradas],
    ['Seções retiradas', m.removidas],
  ]
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200 print:hidden">
      <div className="font-bold">O que mudou na versão {atual.numero}</div>
      {atual.nota && <p className="mt-1 text-sm text-stone-700">{atual.nota}</p>}
      <ul className="mt-2 space-y-1 text-sm text-stone-600">
        {linhas.filter(([, l]) => l.length).map(([rotulo, l]) => (
          <li key={rotulo}>
            <span className="font-semibold text-stone-800">{rotulo}:</span> {l.join(', ')}
          </li>
        ))}
      </ul>
    </div>
  )
}

const negrito = (texto: string): ReactNode =>
  texto.split(/(\*\*[^*]+\*\*)/).map((parte, i) => (parte.startsWith('**') && parte.endsWith('**') ? <b key={i}>{parte.slice(2, -2)}</b> : <Fragment key={i}>{parte}</Fragment>))

export function ConteudoRegulamento({ secoes }: { secoes: Secao[] }) {
  return (
    <div className="space-y-6">
      {secoes.map((s) => (
        <section key={s.id} id={'reg-' + s.id} className="scroll-mt-32">
          {s.titulo && <h2 className="mb-2 text-base font-bold">{s.titulo}</h2>}
          <div className="space-y-2 text-[15px] leading-relaxed text-stone-700">
            {s.blocos.map((b, i) =>
              b.tipo === 'p' ? (
                <p key={i}>{negrito(b.texto)}</p>
              ) : b.tipo === 'lista' ? (
                <ul key={i} className="list-disc space-y-1 pl-5 marker:text-ozzy-500">
                  {b.itens.map((x, k) => (
                    <li key={k}>{negrito(x)}</li>
                  ))}
                </ul>
              ) : (
                <Tabela key={i} cabecalho={b.cabecalho} linhas={b.linhas} />
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  )
}

function Tabela({ cabecalho, linhas }: { cabecalho: string[]; linhas: string[][] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl ring-1 ring-stone-200 sm:block print:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs tracking-wide text-stone-500 uppercase">
            <tr>
              {cabecalho.map((c, i) => (
                <th key={i} className="px-3 py-2 font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {linhas.map((l, i) => (
              <tr key={i}>
                {cabecalho.map((_, k) => (
                  <td key={k} className={`px-3 py-2 ${k === 0 ? 'text-stone-800' : 'text-stone-600'}`}>
                    {negrito(l[k] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-stone-100 rounded-xl ring-1 ring-stone-200 sm:hidden print:hidden">
        {linhas.map((l, i) => (
          <li key={i} className="px-3 py-2">
            <div className="text-stone-800">{negrito(l[0] ?? '')}</div>
            <div className="text-xs text-stone-500">
              {cabecalho.slice(1).map((c, k) => `${c}: ${l[k + 1] ?? ''}`).join(' · ')}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

function Editor({ atual, totalAtivos, aoFechar, aoPublicar }: { atual: VersaoRegulamento; totalAtivos: number; aoFechar: () => void; aoPublicar: () => void }) {
  const { store } = useApp()
  const [texto, setTexto] = useState(atual.texto)
  const [nota, setNota] = useState('')
  const [aba, setAba] = useState<'texto' | 'previa'>('texto')
  const [confirmar, setConfirmar] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const doc = useMemo(() => lerRegulamento(texto), [texto])
  const m = useMemo(() => mudancas(atual.texto, texto), [atual.texto, texto])
  const mudou = texto.trim() !== atual.texto.trim()
  const resumo = [
    m.novas.length && `${m.novas.length} seção(ões) nova(s)`,
    m.alteradas.length && `${m.alteradas.length} alterada(s)`,
    m.removidas.length && `${m.removidas.length} retirada(s)`,
  ].filter(Boolean)

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aoFechar])

  const publicar = async () => {
    try {
      setEnviando(true)
      setErro('')
      await store.publicarRegulamento(texto.trim() + '\n', nota.trim())
      aoPublicar()
    } catch (e) {
      setErro((e as Error).message)
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f6f5f3] print:hidden" role="dialog" aria-label="Publicar nova versão do regulamento">
      <div className="flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="font-bold">Nova versão do regulamento</div>
          <div className="text-xs text-stone-500">Vai virar a versão {atual.numero + 1}. Cole o texto revisado no lugar do atual.</div>
        </div>
        <Botao variante="fantasma" onClick={aoFechar}>
          Cancelar
        </Botao>
      </div>

      <div className="flex gap-1 border-b border-stone-200 bg-white px-4 py-2 lg:hidden">
        {(['texto', 'previa'] as const).map((a) => (
          <button key={a} onClick={() => setAba(a)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${aba === a ? 'bg-carvao text-white' : 'text-stone-600'}`}>
            {a === 'texto' ? 'Texto' : 'Prévia'}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-2">
        <div className={`min-h-0 flex-col p-4 lg:flex ${aba === 'texto' ? 'flex' : 'hidden'}`}>
          <textarea
            className={`${estiloEntrada} min-h-0 flex-1 resize-none font-mono text-[13px]! leading-relaxed`}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              setConfirmar(false)
            }}
            aria-label="Texto do regulamento"
            spellCheck
          />
          <p className="mt-2 text-xs text-stone-500">
            <b>## </b>no começo da linha = título de seção · <b>- </b>= item de lista · <b>| a | b |</b> = linha de tabela · <b>**texto**</b> = negrito. Linha em branco separa parágrafos.
          </p>
        </div>
        <div className={`min-h-0 overflow-y-auto p-4 lg:block lg:border-l lg:border-stone-200 ${aba === 'previa' ? 'block' : 'hidden'}`}>
          <div className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
            {doc.titulo && <h1 className="mb-4 text-xl font-bold">{doc.titulo}</h1>}
            <ConteudoRegulamento secoes={doc.secoes} />
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-stone-200 bg-white px-4 py-3">
        <input
          className={estiloEntrada}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="O que mudou, em uma frase (a equipe vê isso). Ex.: novas regras de refeição"
          aria-label="O que mudou"
        />
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-sm text-stone-600">
            {!mudou ? 'Nenhuma mudança no texto ainda.' : resumo.length ? `${resumo.join(', ')}.` : 'Mudanças só de formatação.'}
            {confirmar && <b className="block text-carvao">Os {totalAtivos} funcionários ativos vão ter que assinar de novo. Confirma?</b>}
          </p>
          {confirmar ? (
            <>
              <Botao variante="secundario" onClick={() => setConfirmar(false)}>
                Voltar
              </Botao>
              <Botao onClick={publicar} disabled={enviando}>
                Confirmar e publicar
              </Botao>
            </>
          ) : (
            <Botao onClick={() => setConfirmar(true)} disabled={!mudou || !doc.secoes.length}>
              Publicar versão {atual.numero + 1}
            </Botao>
          )}
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
      </div>
    </div>
  )
}
