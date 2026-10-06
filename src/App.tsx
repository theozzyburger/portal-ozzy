import { useEffect, useMemo, useState } from 'react'
import { ProvedorApp, useApp } from './lib/contexto'
import { criarDemoStore } from './lib/demoStore'
import { criarSupabaseStore } from './lib/supabaseStore'
import { podeVerEquipe } from './lib/permissoes'
import { ir } from './lib/rota'
import type { Funcionario } from './lib/types'
import { nomeNivel } from './lib/types'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import Comunicados from './pages/Comunicados'
import Escala from './pages/Escala'
import Equipe from './pages/Equipe'
import Perfil from './pages/Perfil'

const URL_SB = import.meta.env.VITE_SUPABASE_URL as string | undefined
const CHAVE_SB = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const usarDemo = import.meta.env.MODE === 'preview' || !URL_SB || !CHAVE_SB

export default function App() {
  const store = useMemo(() => (usarDemo ? criarDemoStore() : criarSupabaseStore(URL_SB!, CHAVE_SB!)), [])
  const [eu, setEu] = useState<Funcionario | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    store.sessaoAtual().then((f) => {
      setEu(f)
      setCarregando(false)
    })
  }, [store])

  if (carregando) return <div className="flex h-full items-center justify-center text-stone-400">Carregando…</div>
  if (!eu) return <Login store={store} aoEntrar={setEu} />

  return (
    <ProvedorApp store={store} eu={eu}>
      <Casca
        aoSair={async () => {
          await store.sair()
          location.hash = ''
          setEu(null)
        }}
      />
    </ProvedorApp>
  )
}

function useRota() {
  const ler = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [partes, setPartes] = useState(ler)
  useEffect(() => {
    const ouvir = () => {
      setPartes(ler())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', ouvir)
    return () => window.removeEventListener('hashchange', ouvir)
  }, [])
  return partes
}

function Casca({ aoSair }: { aoSair: () => void }) {
  const { eu, nomeUnidade, store } = useApp()
  const [pagina = 'inicio', param] = useRota()

  const abas = [
    { id: 'inicio', nome: 'Início', icone: '⌂' },
    { id: 'comunicados', nome: 'Avisos', icone: '✉' },
    { id: 'escala', nome: 'Folgas', icone: '▦' },
    ...(podeVerEquipe(eu.nivel) ? [{ id: 'equipe', nome: 'Equipe', icone: '☰' }] : []),
    { id: 'eu', nome: 'Meu perfil', icone: '◉' },
  ]

  let conteudo
  if (pagina === 'comunicados') conteudo = <Comunicados />
  else if (pagina === 'escala') conteudo = <Escala />
  else if (pagina === 'equipe' && param) conteudo = <Perfil funcionarioId={param} />
  else if (pagina === 'equipe' && podeVerEquipe(eu.nivel)) conteudo = <Equipe />
  else if (pagina === 'eu') conteudo = <Perfil funcionarioId={eu.id} />
  else conteudo = <Inicio />

  return (
    <div className="min-h-full pb-24 sm:pb-8">
      {store.modo === 'demo' && (
        <div className="bg-ozzy-500 px-4 py-1.5 text-center text-xs font-semibold text-carvao">
          Modo demonstração: dados de exemplo, nada é salvo de verdade
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <button onClick={() => ir('inicio')} className="flex items-center gap-2">
            <span className="rounded-lg bg-carvao px-2 py-1 text-xs font-black tracking-widest text-ozzy-400">THE OZZY</span>
            <span className="hidden text-sm font-semibold text-stone-500 sm:inline">Portal do Funcionário</span>
          </button>
          <nav className="hidden gap-1 sm:flex">
            {abas.map((a) => (
              <button
                key={a.id}
                onClick={() => ir(a.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${pagina === a.id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}
              >
                {a.nome}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-right">
            <div className="leading-tight">
              <div className="text-sm font-semibold">{eu.nome.split(' ')[0]}</div>
              <div className="text-[11px] text-stone-500">
                {nomeNivel(eu.nivel)} · {nomeUnidade(eu.unidadeId).replace('The Ozzy ', '')}
              </div>
            </div>
            <button onClick={aoSair} className="rounded-lg px-2 py-1 text-xs font-semibold text-stone-500 hover:bg-stone-100">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">{conteudo}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
        <div className="flex">
          {abas.map((a) => (
            <button
              key={a.id}
              onClick={() => ir(a.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${pagina === a.id ? 'text-ozzy-600' : 'text-stone-500'}`}
            >
              <span className="text-lg leading-none">{a.icone}</span>
              {a.nome}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
