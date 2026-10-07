import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Store } from './store'
import type { Funcionario, Unidade } from './types'

interface Contexto {
  store: Store
  eu: Funcionario
  unidades: Unidade[]
  // Todos que eu posso ver (o banco já filtra pelo meu nível).
  equipe: Funcionario[]
  recarregarEquipe: () => Promise<void>
  nomeDe: (id?: string | null) => string
  nomeUnidade: (id?: string | null) => string
  avisar: (texto: string) => void
}

const Ctx = createContext<Contexto | null>(null)

export function ProvedorApp({ store, eu, children }: { store: Store; eu: Funcionario; children: ReactNode }) {
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [equipe, setEquipe] = useState<Funcionario[]>([])
  const [nomes, setNomes] = useState<{ id: string; nome: string }[]>([])
  const [aviso, setAviso] = useState<string | null>(null)

  const recarregarEquipe = useCallback(async () => setEquipe(await store.funcionarios()), [store])

  useEffect(() => {
    store.unidades().then(setUnidades)
    store.nomes().then(setNomes)
    recarregarEquipe()
  }, [store, recarregarEquipe])

  const avisar = useCallback((texto: string) => {
    setAviso(texto)
    setTimeout(() => setAviso(null), 2800)
  }, [])

  const valor: Contexto = {
    // eu vem da lista atualizada, para refletir na hora uma foto ou dado novo.
    store, eu: equipe.find((f) => f.id === eu.id) ?? eu, unidades, equipe, recarregarEquipe, avisar,
    nomeDe: (id) => equipe.find((f) => f.id === id)?.nome ?? nomes.find((n) => n.id === id)?.nome ?? '—',
    nomeUnidade: (id) => (id ? unidades.find((u) => u.id === id)?.nome ?? id : 'Todas as unidades'),
  }

  return (
    <Ctx.Provider value={valor}>
      {children}
      {aviso && (
        <div className="fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 sm:bottom-8">
          <div className="rounded-xl bg-carvao px-4 py-3 text-sm font-medium text-white shadow-lg">{aviso}</div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useApp() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useApp fora do ProvedorApp')
  return c
}
