import { useEffect, useState } from 'react'
import { Selo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { podeGerenciar } from '../lib/permissoes'
import { DIAS_SEMANA, LIMITE_SEMANA_MIN, LOCAIS_EXTRAS, horas, minutosSemana, minutosTrabalhados, textoPausa, viraNoite } from '../lib/turnos'
import { apelidoUnidade, nomeCurto, type Funcionario, type Turno } from '../lib/types'

export default function Turnos() {
  const { eu, store, equipe, unidades, recarregarEquipe, avisar } = useApp()
  const gestao = podeGerenciar(eu.nivel)
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [local, setLocal] = useState('')

  useEffect(() => {
    store.turnos().then(setTurnos)
  }, [store])

  const nomeLocal = (id: string) => LOCAIS_EXTRAS[id] ?? apelidoUnidade(unidades.find((u) => u.id === id)?.nome ?? id)
  const locais = [...new Set(turnos.map((t) => t.local))]
  const ativos = equipe.filter((f) => f.status === 'ativo')
  const meuTurno = turnos.find((t) => t.id === equipe.find((f) => f.id === eu.id)?.turnoId)
  const semTurno = ativos.filter((f) => !f.turnoId || !turnos.some((t) => t.id === f.turnoId))
  const visiveis = turnos.filter((t) => !local || t.local === local)

  const atribuir = async (f: Funcionario, turno: Turno | null) => {
    await store.atribuirTurno(f.id, turno?.id ?? null)
    await recarregarEquipe()
    avisar(turno ? `${f.nome.split(' ')[0]} no turno ${turno.nome} (${nomeLocal(turno.local)})` : `${f.nome.split(' ')[0]} saiu do turno`)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Turnos</h1>
        <p className="text-sm text-stone-500">
          Horários-padrão do Cronograma 2026. {gestao ? 'Coloque cada pessoa no turno em que trabalha.' : 'Folgas do dia a dia ficam na aba Folgas.'}
        </p>
      </div>

      {meuTurno && (
        <div className="rounded-2xl bg-carvao p-4 text-white">
          <div className="rotulo-marca text-[11px] text-ozzy-400">Seu turno</div>
          <div className="mt-0.5 font-bold">
            {meuTurno.nome} · {nomeLocal(meuTurno.local)}
          </div>
          <p className="mt-1 text-sm text-stone-300">
            {meuTurno.dias
              .map((d, i) => (d ? `${DIAS_SEMANA[i]} ${d.inicio}–${d.fim}` : null))
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      )}

      {gestao && semTurno.length > 0 && (
        <div className="rounded-2xl bg-ozzy-400/30 p-4 ring-1 ring-ozzy-400">
          <div className="font-semibold">
            {semTurno.length} {semTurno.length === 1 ? 'pessoa ainda sem turno' : 'pessoas ainda sem turno'}
          </div>
          <p className="mt-0.5 text-sm text-stone-700">{semTurno.map((f) => nomeCurto(f.nome)).join(', ')}</p>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {['', ...locais].map((l) => (
          <button
            key={l}
            onClick={() => setLocal(l)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${local === l ? 'bg-carvao text-white' : 'bg-white text-stone-600 ring-1 ring-stone-300'}`}
          >
            {l ? nomeLocal(l) : 'Todos'}
          </button>
        ))}
      </div>

      {turnos.length === 0 ? (
        <Vazio>Carregando turnos…</Vazio>
      ) : (
        <div className="space-y-3">
          {visiveis.map((t) => (
            <CartaoTurno
              key={t.id}
              turno={t}
              local={nomeLocal(t.local)}
              pessoas={ativos.filter((f) => f.turnoId === t.id)}
              candidatos={ativos.filter((f) => f.turnoId !== t.id)}
              nomeTurnoDe={(f) => {
                const x = turnos.find((y) => y.id === f.turnoId)
                return x ? `${x.nome}, ${nomeLocal(x.local)}` : null
              }}
              gestao={gestao}
              aoAtribuir={atribuir}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CartaoTurno({
  turno, local, pessoas, candidatos, nomeTurnoDe, gestao, aoAtribuir,
}: {
  turno: Turno
  local: string
  pessoas: Funcionario[]
  candidatos: Funcionario[]
  nomeTurnoDe: (f: Funcionario) => string | null
  gestao: boolean
  aoAtribuir: (f: Funcionario, t: Turno | null) => void
}) {
  const semana = minutosSemana(turno)
  const acima = semana > LIMITE_SEMANA_MIN
  const livres = candidatos.filter((f) => !nomeTurnoDe(f))
  const emOutro = candidatos.filter((f) => nomeTurnoDe(f))

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold tracking-wide text-stone-500 uppercase">{local}</div>
          <h2 className="text-lg font-bold">{turno.nome}</h2>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold tabular-nums ${acima ? 'text-red-700' : ''}`}>{horas(semana)}</div>
          <div className="text-xs text-stone-500">{acima ? 'acima de 44h por semana' : 'por semana'}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-7">
        {turno.dias.map((d, i) => (
          <div
            key={i}
            className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 sm:block sm:px-2 sm:text-center ${d ? 'bg-stone-50' : 'bg-stone-100/60 text-stone-400'}`}
          >
            <div className="text-xs font-bold tracking-wide uppercase">{DIAS_SEMANA[i]}</div>
            {d ? (
              <div className="flex items-baseline gap-2 sm:block">
                <div className="text-sm font-semibold tabular-nums sm:mt-1">
                  {d.inicio}–{d.fim}
                  {viraNoite(d) && (
                    <sup className="ml-0.5 text-[10px] font-bold text-stone-500" title="Termina depois da meia-noite">
                      +1
                    </sup>
                  )}
                </div>
                <div className="text-xs text-stone-500">
                  {horas(minutosTrabalhados(d))} · pausa {textoPausa(d.pausaMin)}
                </div>
              </div>
            ) : (
              <div className="text-sm font-semibold sm:mt-1">Folga</div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-stone-100 pt-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-700">
          Quem trabalha neste turno <Selo>{pessoas.length}</Selo>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {pessoas.length === 0 && <span className="text-sm text-stone-500">{gestao ? 'Ninguém ainda.' : 'Ninguém da sua equipe.'}</span>}
          {pessoas.map((f) => (
            <span key={f.id} className="inline-flex items-center gap-1 rounded-full bg-carvao py-1 pr-1.5 pl-3 text-sm font-medium text-white">
              {nomeCurto(f.nome)}
              {gestao ? (
                <button onClick={() => aoAtribuir(f, null)} className="rounded-full px-1 text-stone-400 hover:text-white" aria-label={`Tirar ${f.nome} do turno`}>
                  ×
                </button>
              ) : (
                <span className="w-1" />
              )}
            </span>
          ))}
        </div>
        {gestao && (
          <select
            className={`${estiloEntrada} mt-2 sm:w-80`}
            value=""
            aria-label={`Colocar pessoa no turno ${turno.nome}`}
            onChange={(e) => {
              const f = candidatos.find((x) => x.id === e.target.value)
              if (f) aoAtribuir(f, turno)
            }}
          >
            <option value="">+ Colocar pessoa neste turno</option>
            {livres.length > 0 && (
              <optgroup label="Sem turno">
                {livres.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome} ({f.cargo})
                  </option>
                ))}
              </optgroup>
            )}
            {emOutro.length > 0 && (
              <optgroup label="Mudar de outro turno">
                {emOutro.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome} (hoje: {nomeTurnoDe(f)})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        )}
      </div>
    </section>
  )
}
