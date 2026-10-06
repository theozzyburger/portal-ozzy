import { useState } from 'react'
import { Botao, Campo, estiloEntrada } from '../components/ui'
import logo from '../assets/logo.png'
import { SENHA_DEMO, criarDemoStore } from '../lib/demoStore'
import type { Store } from '../lib/store'
import { nomeNivel, type Funcionario } from '../lib/types'

type DemoStore = ReturnType<typeof criarDemoStore>

export default function Login({ store, aoEntrar }: { store: Store; aoEntrar: (f: Funcionario) => void }) {
  const [celular, setCelular] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const demo = store.modo === 'demo' ? (store as DemoStore) : null

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      aoEntrar(await store.entrar(celular, senha))
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-carvao px-4 py-10">
      <div className="mb-8 text-center">
        <img src={logo} alt="The Ozzy Burger" className="mx-auto h-36 w-36" />
        <div className="rotulo-marca mt-4 text-xs text-ozzy-400">Portal do Funcionário</div>
      </div>

      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6">
        <Campo rotulo="Celular">
          <input className={estiloEntrada} inputMode="tel" placeholder="(11) 99999-0000" value={celular} onChange={(e) => setCelular(e.target.value)} required />
        </Campo>
        <Campo rotulo="Senha">
          <input className={estiloEntrada} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </Campo>
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
  )
}
