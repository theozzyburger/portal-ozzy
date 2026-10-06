import Icone from '../components/Icone'
import { Selo } from '../components/ui'
import type { Modulo } from '../lib/modulos'

export default function EmBreve({ modulo }: { modulo: Pick<Modulo, 'id' | 'nome' | 'resumo' | 'itens' | 'origem'> }) {
  return (
    <div className="mx-auto max-w-xl py-6">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-carvao text-ozzy-400">
          <Icone nome={modulo.id} tamanho={24} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{modulo.nome}</h1>
          <Selo cor="ambar">Em breve</Selo>
        </div>
      </div>
      {modulo.resumo && <p className="mt-5 text-lg text-stone-700">{modulo.resumo}</p>}
      {modulo.itens && (
        <ul className="mt-5 space-y-2">
          {modulo.itens.map((i) => (
            <li key={i} className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-stone-200">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ozzy-500" />
              <span>{i}</span>
            </li>
          ))}
        </ul>
      )}
      {modulo.origem && <p className="mt-4 text-sm text-stone-500">{modulo.origem}</p>}
      <p className="mt-8 border-t border-stone-200 pt-4 text-sm text-stone-500">
        Esta área ainda está em construção. Tem uma ideia do que precisa ter aqui? Fale com o administrativo.
      </p>
    </div>
  )
}
