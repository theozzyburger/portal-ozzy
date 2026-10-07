import { useState } from 'react'
import { Botao, Campo, estiloEntrada } from '../components/ui'
import logo from '../assets/logo.png'
import arte from '../assets/banner-ozzy.jpg'
import { SENHA_DEMO, criarDemoStore } from '../lib/demoStore'
import type { Store } from '../lib/store'
import { nomeNivel, type Funcionario } from '../lib/types'

type DemoStore = ReturnType<typeof criarDemoStore>

const CHAVE_CELULAR = 'ozzy-celular'
const lerLocal = (k: string) => {
  try {
    return localStorage.getItem(k) ?? ''
  } catch {
    return ''
  }
}

export default function Login({ store, aoEntrar }: { store: Store; aoEntrar: (f: Funcionario) => void }) {
  const [celular, setCelular] = useState(() => lerLocal(CHAVE_CELULAR))
  const [lembrar, setLembrar] = useState(() => lerLocal('ozzy-lembrar') !== 'nao')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const demo = store.modo === 'demo' ? (store as DemoStore) : null

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      const f = await store.entrar(celular, senha, lembrar)
      try {
        if (lembrar) localStorage.setItem(CHAVE_CELULAR, celular)
        else localStorage.removeItem(CHAVE_CELULAR)
      } catch {
        // sem armazenamento (aba anônima): só não lembra o celular
      }
      aoEntrar(f)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-full bg-carvao lg:grid lg:grid-cols-[1.15fr_1fr]">
      {/* Arte da embalagem: no celular é o topo da tela; no computador, a metade esquerda. */}
      <div className="relative h-[46vh] min-h-72 overflow-hidden lg:sticky lg:top-0 lg:h-screen">
        <img src={arte} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover object-[50%_30%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-carvao/10 via-carvao/30 to-carvao lg:bg-gradient-to-r lg:from-transparent lg:via-carvao/20 lg:to-carvao" />
        <div className="absolute inset-x-0 bottom-0 hidden h-3/4 bg-gradient-to-t from-carvao via-carvao/75 to-transparent lg:block" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-4 text-center lg:items-start lg:pb-14 lg:pl-14 lg:text-left">
          <img src={logo} alt="The Ozzy" className="h-24 w-24 drop-shadow-[0_6px_20px_rgba(0,0,0,0.6)] lg:h-32 lg:w-32" />
          <h1 className="mt-3 leading-[0.9] font-extrabold tracking-tight uppercase drop-shadow-[0_3px_0_rgba(0,0,0,0.9)]">
            <span className="block text-4xl text-white sm:text-5xl lg:text-7xl">Portal do Time</span>
            <span className="block text-5xl text-ozzy-400 sm:text-6xl lg:text-8xl">The Ozzy</span>
          </h1>
          <p className="mt-3 max-w-xs text-sm font-medium text-stone-200 lg:max-w-sm lg:text-base">Folgas, avisos, salário e tudo do seu dia a dia num lugar só.</p>
        </div>
      </div>

      <div className="flex flex-col items-center px-4 pt-4 pb-10 lg:justify-center lg:py-10">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-[0_0_0_4px_var(--color-ozzy-400)]">
        <div className="-mt-1 mb-1 text-center text-lg font-extrabold">Bora entrar?</div>
        <Campo rotulo="Celular">
          <input className={estiloEntrada} inputMode="tel" placeholder="(11) 99999-0000" autoComplete="username" name="celular" value={celular} onChange={(e) => setCelular(e.target.value)} required />
        </Campo>
        <Campo rotulo="Senha">
          <input className={estiloEntrada} type="password" autoComplete="current-password" name="senha" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </Campo>
        <label className="flex items-center gap-2.5 text-sm text-stone-700">
          <input type="checkbox" className="size-5 accent-carvao" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
          Lembrar meu acesso neste aparelho
        </label>
        {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}
        <Botao className="w-full" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </Botao>
        <p className="text-center text-xs text-stone-500">Esqueceu a senha? Fale com o administrativo da sua unidade.</p>
      </form>

      {demo && (
        <div className="mt-6 w-full max-w-sm rounded-3xl bg-white/5 p-5 text-stone-200 ring-1 ring-white/10">
          <div className="mb-1 text-sm font-semibold text-ozzy-400">Demonstração: entre como</div>
          <p className="mb-3 text-xs text-stone-400">
            Cada perfil vê o portal de um jeito. Ou use qualquer celular da lista com a senha {SENHA_DEMO}.
          </p>
          <div className="space-y-1.5">
            {demo.perfisDemo()
              .filter((f, i, todos) => todos.findIndex((x) => x.nivel === f.nivel) === i)
              .map((f) => (
                <button
                  key={f.id}
                  onClick={async () => aoEntrar(await demo.entrarComo(f.id))}
                  className="flex w-full items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-left text-sm hover:bg-white/20"
                >
                  <span className="font-semibold">{f.nome}</span>
                  <span className="text-xs text-stone-300">{nomeNivel(f.nivel)}</span>
                </button>
              ))}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
