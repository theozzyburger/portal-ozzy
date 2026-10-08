import { Campo, estiloEntrada } from './ui'
import { addDias, dataCurta, diaSemana, hoje } from '../lib/datas'
import type { DiaEnviado, TurnoFreela, Unidade } from '../lib/types'

export const FUNCOES_FREELA = ['Chapeiro', 'Auxiliar de cozinha', 'Pizzaiolo', 'Atendente', 'Caixa', 'Entregador', 'Limpeza']
export const NOME_TURNO: Record<TurnoFreela, string> = { manha: 'Manhã', noite: 'Noite' }

export interface DiariaParaEnviar {
  unidadeId: string
  funcao: string
  observacao: string
  marcados: string[] // "AAAA-MM-DD|turno"
}

export const diasMarcados = (v: DiariaParaEnviar): DiaEnviado[] =>
  v.marcados.map((m) => {
    const [data, turno] = m.split('|')
    return { data, turno: turno as TurnoFreela, observacao: v.observacao.trim() || undefined }
  })

// Loja, função e os dias trabalhados (últimos 14), com manhã e noite separados. Serve para o freelancer (pelo
// link) e para o funcionário que fez diária na folga (pelo login).
export default function CamposDiaria({ v, mudar, unidades, jaEnviados = [] }: {
  v: DiariaParaEnviar
  mudar: (v: DiariaParaEnviar) => void
  unidades: Unidade[]
  jaEnviados?: string[]
}) {
  const dias = Array.from({ length: 14 }, (_, i) => addDias(hoje(), -i))
  const alternar = (k: string) => mudar({ ...v, marcados: v.marcados.includes(k) ? v.marcados.filter((x) => x !== k) : [...v.marcados, k] })

  return (
    <div className="space-y-4">
      <Campo rotulo="Loja">
        <select className={estiloEntrada} value={v.unidadeId} onChange={(e) => mudar({ ...v, unidadeId: e.target.value })} required>
          <option value="">Escolha…</option>
          {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Função">
        <input className={estiloEntrada} list="funcoes-diaria" placeholder="Ex.: Chapeiro" value={v.funcao} onChange={(e) => mudar({ ...v, funcao: e.target.value })} required />
        <datalist id="funcoes-diaria">
          {FUNCOES_FREELA.map((f) => <option key={f} value={f} />)}
        </datalist>
      </Campo>
      <div>
        <span className="mb-1 block text-sm font-medium text-stone-700">Dias que você trabalhou</span>
        <div className="divide-y divide-stone-100 rounded-xl bg-white ring-1 ring-stone-200">
          {dias.map((d) => (
            <div key={d} className="flex items-center gap-2 px-3 py-1.5">
              <span className="flex-1 text-sm">
                {d === hoje() ? 'Hoje' : d === addDias(hoje(), -1) ? 'Ontem' : diaSemana(d)}, {dataCurta(d)}
              </span>
              {(['manha', 'noite'] as const).map((t) => {
                const k = `${d}|${t}`
                const enviado = jaEnviados.includes(k)
                const marcado = v.marcados.includes(k)
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={enviado}
                    onClick={() => alternar(k)}
                    aria-pressed={marcado}
                    className={`w-20 rounded-lg py-1.5 text-sm font-semibold ${
                      enviado ? 'bg-emerald-50 text-emerald-700' : marcado ? 'bg-carvao text-white' : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {enviado ? 'Enviado' : NOME_TURNO[t]}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <Campo rotulo="Observação (opcional)">
        <input className={estiloEntrada} value={v.observacao} onChange={(e) => mudar({ ...v, observacao: e.target.value })} />
      </Campo>
    </div>
  )
}
