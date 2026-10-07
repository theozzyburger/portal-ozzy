import { useEffect, useMemo, useState } from 'react'
import { ProvedorApp, useApp } from './lib/contexto'
import { criarDemoStore } from './lib/demoStore'
import { criarSupabaseStore } from './lib/supabaseStore'
import { podeGerenciar, podeVerEquipe } from './lib/permissoes'
import { ir } from './lib/rota'
import type { Funcionario } from './lib/types'
import { nomeNivel } from './lib/types'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import Comunicados from './pages/Comunicados'
import Escala from './pages/Escala'
import Equipe from './pages/Equipe'
import Perfil from './pages/Perfil'
import EmBreve from './pages/EmBreve'
import Compras from './pages/Compras'
import Vencimentos from './pages/Vencimentos'
import Caixinha from './pages/Caixinha'
import Turnos from './pages/Turnos'
import Regras from './pages/Regras'
import Manutencao from './pages/Manutencao'
import Fichas from './pages/Fichas'
import Freelancers from './pages/Freelancers'
import Salarios from './pages/Salarios'
import Financeiro from './pages/Financeiro'
import Icone from './components/Icone'
import logo from './assets/logo.png'
import { modulosVisiveis } from './lib/modulos'

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
  const [area = 'inicio', sub, param] = useRota()
  const [menuAberto, setMenuAberto] = useState(false)
  const modulos = modulosVisiveis(eu.nivel)
  const modulo = modulos.find((m) => m.id === area) ?? modulos[0]

  useEffect(() => setMenuAberto(false), [area, sub])

  const abasRh = [
    { id: 'avisos', nome: 'Avisos' },
    { id: 'turnos', nome: 'Turnos' },
    { id: 'folgas', nome: 'Folgas' },
    ...(podeVerEquipe(eu.nivel) ? [{ id: 'equipe', nome: 'Equipe' }] : []),
    ...(podeGerenciar(eu.nivel) ? [{ id: 'exames', nome: 'Exames' }, { id: 'caixinha', nome: 'Caixinha' }, { id: 'freelancers', nome: 'Freelancers' }, { id: 'salarios', nome: 'Salários' }] : []),
    { id: 'ponto', nome: 'Ponto', emBreve: true },
    { id: 'perfil', nome: 'Meu perfil' },
  ]
  const abaRh = abasRh.find((a) => a.id === sub)?.id ?? 'avisos'

  let conteudo
  if (modulo.id === 'inicio') conteudo = <Inicio />
  else if (modulo.id === 'regras') conteudo = <Regras />
  else if (modulo.id === 'manutencao') conteudo = <Manutencao />
  else if (modulo.id === 'fichas') conteudo = <Fichas />
  else if (modulo.id === 'financeiro') conteudo = <Financeiro />
  else if (modulo.id === 'compras') conteudo = <Compras />
  else if (modulo.id !== 'rh') conteudo = <EmBreve modulo={modulo} />
  else if (abaRh === 'turnos') conteudo = <Turnos />
  else if (abaRh === 'folgas') conteudo = <Escala />
  else if (abaRh === 'equipe' && param) conteudo = <Perfil funcionarioId={param} />
  else if (abaRh === 'equipe') conteudo = <Equipe />
  else if (abaRh === 'exames') conteudo = <Vencimentos />
  else if (abaRh === 'caixinha') conteudo = <Caixinha />
  else if (abaRh === 'freelancers') conteudo = <Freelancers />
  else if (abaRh === 'salarios') conteudo = <Salarios />
  else if (abaRh === 'ponto') conteudo = <EmBreve modulo={PONTO} />
  else if (abaRh === 'perfil') conteudo = <Perfil funcionarioId={eu.id} />
  else conteudo = <Comunicados />

  const menu = (
    <nav className="flex h-full flex-col bg-carvao text-stone-300">
      <button onClick={() => ir('inicio')} className="flex items-center gap-3 px-5 pt-5 pb-1 text-left">
        <img src={logo} alt="The Ozzy" className="h-14 w-14" />
        <div>
          <div className="text-[15px] font-light tracking-[0.25em] text-white">THE OZZY</div>
          <div className="rotulo-marca text-[10px] text-ozzy-400">Portal interno</div>
        </div>
      </button>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {modulos.map((m) => {
          const ativo = m.id === modulo.id
          return (
            <button
              key={m.id}
              onClick={() => ir(m.id === 'rh' ? 'rh/avisos' : m.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                ativo ? 'bg-ozzy-500 text-carvao' : 'hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icone nome={m.id} />
              <span className="flex-1">{m.nome}</span>
              {!m.pronto && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${ativo ? 'bg-carvao/15' : 'bg-white/10 text-stone-400'}`}>
                  em breve
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="border-t border-white/10 px-5 py-4">
        <div className="text-sm font-semibold text-white">{eu.nome}</div>
        <div className="text-xs text-stone-400">
          {nomeNivel(eu.nivel)} · {nomeUnidade(eu.unidadeId)}
        </div>
        <button onClick={aoSair} className="mt-2 text-xs font-semibold text-stone-400 hover:text-white">
          Sair
        </button>
      </div>
    </nav>
  )

  return (
    <div className="min-h-full lg:pl-64 print:pl-0">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block print:hidden">{menu}</aside>

      {menuAberto && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMenuAberto(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] pt-[env(safe-area-inset-top)]" onClick={(e) => e.stopPropagation()}>
            {menu}
          </aside>
        </div>
      )}

      {store.modo === 'demo' && (
        <div className="bg-ozzy-500 px-4 py-1.5 text-center text-xs font-semibold text-carvao print:hidden">
          Modo demonstração: dados de exemplo, nada é salvo de verdade
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur lg:hidden print:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => setMenuAberto(true)} className="-ml-1 rounded-lg p-1.5 text-stone-700 hover:bg-stone-100" aria-label="Abrir menu">
            <Icone nome="menu" tamanho={22} />
          </button>
          <img src={logo} alt="The Ozzy" className="h-8 w-8" />
          <span className="flex-1 truncate text-sm font-semibold text-stone-600">{modulo.id === 'inicio' ? '' : modulo.nome}</span>
        </div>
      </header>

      {modulo.id === 'rh' && (
        <div className="sticky top-[57px] z-20 border-b border-stone-200 bg-[#f6f5f3]/95 backdrop-blur lg:top-0 print:hidden">
          <div className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 py-2">
            <span className="mr-2 hidden text-sm font-bold lg:inline">Departamento Pessoal</span>
            {abasRh.map((a) => (
              <button
                key={a.id}
                onClick={() => ir('rh/' + a.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  abaRh === a.id ? 'bg-carvao text-white' : 'text-stone-600 hover:bg-stone-200'
                }`}
              >
                {a.nome}
                {'emBreve' in a && <span className="h-1.5 w-1.5 rounded-full bg-ozzy-500" title="Em breve" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-5 pb-12">{conteudo}</main>
    </div>
  )
}

const PONTO = {
  id: 'rh' as const,
  nome: 'Ponto',
  resumo: 'Batidas do relógio Control iD dentro do portal.',
  itens: ['Espelho de ponto de cada funcionário', 'Atrasos e faltas cruzados com atestados', 'Cada pessoa vê o próprio ponto pelo celular'],
  origem: 'Primeiro por importação do relatório do Control iD; depois, se o seu modelo permitir, direto pela API.',
}
