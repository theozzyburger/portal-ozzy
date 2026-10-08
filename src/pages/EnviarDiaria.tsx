import { useEffect, useState } from 'react'
import { Botao, Campo, estiloEntrada } from '../components/ui'
import CamposDiaria, { diasMarcados, type DiariaParaEnviar } from '../components/CamposDiaria'
import logo from '../assets/logo.png'
import { cpfValido, formatarCpf } from '../lib/cpf'
import { soDigitos, type Store } from '../lib/store'
import type { QuemSouFreela, Unidade } from '../lib/types'

// Página aberta pelo link (ou QR Code) da loja: o freelancer manda as diárias que trabalhou, sem login.
// Chega para a gestão aprovar em Freelancers › Enviadas.
export default function EnviarDiaria({ store, lojaId }: { store: Store; lojaId?: string }) {
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [cpf, setCpf] = useState('')
  const [celular, setCelular] = useState('')
  const [quem, setQuem] = useState<QuemSouFreela | null>(null)
  const [nome, setNome] = useState('')
  const [pix, setPix] = useState('')
  const [trocarPix, setTrocarPix] = useState(false)
  const [v, setV] = useState<DiariaParaEnviar>({ unidadeId: lojaId ?? '', funcao: '', observacao: '', marcados: [] })
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviadas, setEnviadas] = useState<number | null>(null)

  useEffect(() => {
    store.lojasParaDiaria().then((us) => {
      setUnidades(us)
      if (lojaId && !us.some((u) => u.id === lojaId)) setV((x) => ({ ...x, unidadeId: '' }))
    })
  }, [store, lojaId])

  const loja = unidades.find((u) => u.id === lojaId)

  const identificar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cpfValido(cpf)) return setErro('CPF inválido. Confira os números.')
    if (soDigitos(celular).length < 10) return setErro('Coloque o celular com DDD.')
    setErro('')
    setEnviando(true)
    try {
      setQuem(await store.freelaQuemSou(soDigitos(cpf), soDigitos(celular)))
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    const novo = quem?.tipo === 'novo'
    if (novo && nome.trim().split(/\s+/).length < 2) return setErro('Coloque o nome completo.')
    if ((novo || trocarPix) && !pix.trim()) return setErro('Coloque a chave Pix.')
    if (!v.unidadeId) return setErro('Escolha a loja.')
    if (!v.marcados.length) return setErro('Marque pelo menos um dia.')
    setErro('')
    setEnviando(true)
    try {
      const n = await store.enviarDiarias({
        cpf: soDigitos(cpf), celular: soDigitos(celular), nome: novo ? nome : '', pix: novo || trocarPix ? pix : '',
        unidadeId: v.unidadeId, funcao: v.funcao, dias: diasMarcados(v),
      })
      setEnviadas(n)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const recomecar = () => {
    setEnviadas(null)
    setV({ unidadeId: lojaId ?? v.unidadeId, funcao: v.funcao, observacao: '', marcados: [] })
  }

  return (
    <div className="min-h-full bg-[#f6f5f3]">
      <header className="bg-carvao px-4 pt-6 pb-5 text-white">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <img src={logo} alt="The Ozzy" className="h-12 w-12" />
          <div>
            <div className="text-lg font-bold">Diárias de freelancer</div>
            <div className="text-sm text-ozzy-400">{loja?.nome ?? 'The Ozzy'}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-5">
        {enviadas !== null ? (
          <div className="space-y-4 rounded-2xl bg-white p-5 text-center ring-1 ring-stone-200">
            <div className="text-4xl">✓</div>
            <h1 className="text-lg font-bold">
              {enviadas === 0 ? 'Esses dias já tinham sido enviados' : `${enviadas} ${enviadas === 1 ? 'diária enviada' : 'diárias enviadas'}`}
            </h1>
            <p className="text-sm text-stone-600">
              A gerente confere e aprova. O pagamento sai por Pix na segunda-feira seguinte à semana trabalhada.
            </p>
            <Botao variante="secundario" className="w-full" onClick={recomecar}>Mandar outro dia</Botao>
          </div>
        ) : !quem || quem.tipo === 'invalido' ? (
          <form onSubmit={identificar} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
            <p className="text-sm text-stone-600">Trabalhou de freela com a gente? Mande aqui os dias para entrar no pagamento de segunda.</p>
            <Campo rotulo="Seu CPF">
              <input
                className={estiloEntrada}
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                onBlur={() => cpfValido(cpf) && setCpf(formatarCpf(cpf))}
                required
              />
            </Campo>
            <Campo rotulo="Seu celular (com DDD)">
              <input className={estiloEntrada} inputMode="tel" placeholder="(11) 90000-0000" value={celular} onChange={(e) => setCelular(e.target.value)} required />
            </Campo>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <Botao className="w-full" disabled={enviando}>{enviando ? 'Conferindo…' : 'Continuar'}</Botao>
          </form>
        ) : quem.tipo === 'funcionario' ? (
          <div className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
            <h1 className="text-lg font-bold">Você é do time The Ozzy</h1>
            <p className="text-sm text-stone-600">
              Diária na folga você manda pelo Portal do Time, entrando com o seu celular e senha. Lá na tela inicial, toque em
              <b> Fiz diária na folga</b>.
            </p>
            <Botao className="w-full" onClick={() => (location.hash = '/inicio')}>Abrir o Portal do Time</Botao>
            <button className="w-full text-sm font-semibold text-stone-500" onClick={() => setQuem(null)}>Não sou funcionário</button>
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
            {quem.tipo === 'freelancer' ? (
              <div className="space-y-2">
                <h1 className="text-lg font-bold">Oi, {quem.nome}!</h1>
                {!trocarPix ? (
                  <p className="text-sm text-stone-600">
                    O Pix vai para a chave que termina em <b>{quem.pixFinal}</b>.{' '}
                    <button type="button" className="font-semibold text-sky-700" onClick={() => setTrocarPix(true)}>Trocar chave</button>
                  </p>
                ) : (
                  <Campo rotulo="Nova chave Pix" dica="CPF, celular, e-mail ou chave aleatória. A gerente confere antes de trocar.">
                    <input className={estiloEntrada} value={pix} onChange={(e) => setPix(e.target.value)} required />
                  </Campo>
                )}
              </div>
            ) : (
              <>
                <p className="text-sm text-stone-600">Primeira vez por aqui? Preencha seus dados para o pagamento.</p>
                <Campo rotulo="Nome completo">
                  <input className={estiloEntrada} value={nome} onChange={(e) => setNome(e.target.value)} required />
                </Campo>
                <Campo rotulo="Chave Pix" dica="CPF, celular, e-mail ou chave aleatória. Precisa estar no seu nome.">
                  <input className={estiloEntrada} value={pix} onChange={(e) => setPix(e.target.value)} required />
                </Campo>
              </>
            )}
            <CamposDiaria v={v} mudar={setV} unidades={unidades} />
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <Botao className="w-full" disabled={enviando}>
              {enviando ? 'Enviando…' : v.marcados.length > 1 ? `Enviar ${v.marcados.length} diárias` : 'Enviar diária'}
            </Botao>
            <button type="button" className="w-full text-sm font-semibold text-stone-500" onClick={() => setQuem(null)}>Voltar</button>
          </form>
        )}
      </main>
    </div>
  )
}
