import { useCallback, useEffect, useRef, useState } from 'react'
import Assinatura from '../components/Assinatura'
import { Botao, Selo } from '../components/ui'
import { useApp } from '../lib/contexto'
import { podeGerenciar } from '../lib/permissoes'
import { GRAUS, INFRACOES, SECOES_REGULAMENTO, VERSAO_REGULAMENTO, termoRegulamento } from '../lib/regulamento'
import { nomeCurto, type LeituraRegulamento } from '../lib/types'

const COR_GRAU: Record<number, 'cinza' | 'ambar' | 'vermelho'> = { 1: 'cinza', 2: 'ambar', 3: 'vermelho', 4: 'vermelho' }

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export default function Regras() {
  const { eu, store, equipe, avisar } = useApp()
  const gestao = podeGerenciar(eu.nivel)
  const [leituras, setLeituras] = useState<LeituraRegulamento[]>([])
  const [assinatura, setAssinatura] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const fim = useRef<HTMLDivElement>(null)

  const carregar = useCallback(() => store.leiturasRegulamento().then(setLeituras), [store])
  useEffect(() => {
    carregar()
  }, [carregar])

  const vigentes = leituras.filter((l) => l.versao === VERSAO_REGULAMENTO)
  const minha = vigentes.find((l) => l.funcionarioId === eu.id)
  const ativos = equipe.filter((f) => f.status === 'ativo')
  const faltam = ativos.filter((f) => !vigentes.some((l) => l.funcionarioId === f.id))

  const ir = (id: string) => document.getElementById('reg-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const assinar = async () => {
    try {
      setErro('')
      await store.assinarRegulamento(VERSAO_REGULAMENTO, assinatura!)
      await carregar()
      avisar('Regulamento assinado')
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="rotulo-marca text-[11px] text-stone-500">Regras e processos</div>
        <h1 className="text-xl font-bold">Regulamento interno</h1>
        <p className="text-sm text-stone-500">Revisado em 2025. Vale para todas as unidades.</p>
      </div>

      {minha ? (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-800 ring-1 ring-emerald-200">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-bold text-white">✓</span>
          <span className="text-sm">
            <b>Você assinou este regulamento</b> em {quando(minha.assinadoEm)}.
          </span>
        </div>
      ) : (
        <button
          onClick={() => fim.current?.scrollIntoView({ behavior: 'smooth' })}
          className="flex w-full items-center gap-3 rounded-2xl bg-ozzy-400 p-4 text-left text-carvao"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-carvao text-lg font-bold text-ozzy-400">!</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Leia com atenção e assine no final</span>
            <span className="block text-sm">A assinatura fica guardada no seu cadastro.</span>
          </span>
          <span className="text-xl">↓</span>
        </button>
      )}

      {gestao && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <div className="flex items-baseline justify-between gap-2">
            <div className="font-bold">Assinaturas da equipe</div>
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
        </div>
      )}

      <nav className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Seções do regulamento">
        {SECOES_REGULAMENTO.map((s) => (
          <button key={s.id} onClick={() => ir(s.id)} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-stone-600 ring-1 ring-stone-300 hover:text-carvao">
            {s.titulo}
          </button>
        ))}
      </nav>

      <article className="space-y-6 rounded-2xl bg-white p-5 ring-1 ring-stone-200 sm:p-7">
        {SECOES_REGULAMENTO.map((s) => (
          <section key={s.id} id={'reg-' + s.id} className="scroll-mt-32">
            <h2 className="mb-2 text-base font-bold">{s.titulo}</h2>
            {s.paragrafos?.map((p, i) => (
              <p key={i} className="mb-2 text-[15px] leading-relaxed text-stone-700">
                {p}
              </p>
            ))}
            {s.itens && (
              <ul className="list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-stone-700 marker:text-ozzy-500">
                {s.itens.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            )}
            {s.id === 'infracoes' && <TabelaInfracoes />}
          </section>
        ))}
      </article>

      <div ref={fim} className="scroll-mt-32 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
        <h2 className="mb-2 font-bold">Assinatura</h2>
        <p className="rounded-xl bg-stone-50 p-3 text-sm leading-relaxed text-stone-700">{termoRegulamento(eu.nome)}</p>
        {minha ? (
          <div className="mt-3">
            <img src={minha.assinatura} alt={`Assinatura de ${eu.nome}`} className="h-24 w-full rounded-xl border border-stone-200 bg-white object-contain" />
            <p className="mt-2 text-xs text-stone-500">Assinado em {quando(minha.assinadoEm)}, pelo próprio login no portal.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <Assinatura aoMudar={setAssinatura} />
            <Botao className="w-full" disabled={!assinatura} onClick={assinar}>
              Li e concordo, assinar
            </Botao>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-stone-500">Em breve aqui: POPs por área, manual de exceções e um assistente que tira dúvidas só com base nas regras oficiais.</p>
    </div>
  )
}

function TabelaInfracoes() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {GRAUS.map((g) => (
          <Selo key={g.grau} cor={COR_GRAU[g.grau]}>
            Grau {g.grau}: {g.medida}
          </Selo>
        ))}
      </div>
      {GRAUS.map((g) => (
        <div key={g.grau}>
          <h3 className="mb-1 text-sm font-bold text-stone-800">
            Grau {g.grau} · {g.medida}
          </h3>
          <ul className="divide-y divide-stone-100 rounded-xl ring-1 ring-stone-200">
            {INFRACOES.filter((i) => i.grau === g.grau).map((i) => (
              <li key={i.exemplo} className="px-3 py-2 text-[15px] text-stone-700">
                {i.exemplo}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
