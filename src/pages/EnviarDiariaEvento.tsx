import { useEffect, useState } from 'react'
import { Botao, Campo, estiloEntrada } from '../components/ui'
import logo from '../assets/logo.png'
import { cpfValido, formatarCpf } from '../lib/cpf'
import { addDias, dataCurta, diaSemana, hoje } from '../lib/datas'
import { pegarLocalizacao, soDigitos, type Store } from '../lib/store'
import type { EventoAberto, QuemSouFreela } from '../lib/types'
import { FUNCOES_EVENTO } from './FreelasEventos'

// Link (ou QR Code) dos freelas de evento (#/diaria-evento[/<evento>]): manda as diárias sem login.
// Chega para a gestão aprovar em Eventos › Freelancers. Base separada da dos freelas das lojas.
export default function EnviarDiariaEvento({ store, eventoId }: { store: Store; eventoId?: string }) {
  const [eventos, setEventos] = useState<EventoAberto[] | null>(null)
  const [cpf, setCpf] = useState('')
  const [celular, setCelular] = useState('')
  const [quem, setQuem] = useState<QuemSouFreela | null>(null)
  const [nome, setNome] = useState('')
  const [pix, setPix] = useState('')
  const [trocarPix, setTrocarPix] = useState(false)
  const [evento, setEvento] = useState(eventoId ?? '')
  const [funcao, setFuncao] = useState('')
  const [observacao, setObservacao] = useState('')
  const [marcados, setMarcados] = useState<string[]>([])
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviadas, setEnviadas] = useState<number | null>(null)
  const [semLocal, setSemLocal] = useState(false)

  useEffect(() => {
    store.eventosAbertosDiaria().then((es) => {
      setEventos(es)
      if (es.length === 1) setEvento(es[0].id)
      else if (eventoId && !es.some((e) => e.id === eventoId)) setEvento('')
    })
  }, [store, eventoId])

  const ev = eventos?.find((e) => e.id === evento)

  const identificar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cpfValido(cpf)) return setErro('CPF inválido. Confira os números.')
    if (soDigitos(celular).length < 10) return setErro('Coloque o celular com DDD.')
    setErro('')
    setEnviando(true)
    try {
      setQuem(await store.freelaEventoQuemSou(soDigitos(cpf), soDigitos(celular)))
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
    if (!evento) return setErro('Escolha o evento.')
    if (!funcao.trim()) return setErro('Diga a função que você fez.')
    if (!marcados.length) return setErro('Marque pelo menos um dia.')
    setErro('')
    setEnviando(true)
    try {
      // Mandada do evento, no dia, vale como presença.
      const local = await pegarLocalizacao()
      setSemLocal(!local)
      const n = await store.enviarDiariasEvento({
        cpf: soDigitos(cpf), celular: soDigitos(celular), nome: novo ? nome : '', pix: novo || trocarPix ? pix : '',
        eventoId: evento, funcao, dias: marcados.map((data) => ({ data, observacao: observacao.trim() || undefined })), local,
      })
      setEnviadas(n)
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-full bg-[#f6f5f3]">
      <header className="bg-carvao px-4 pt-6 pb-5 text-white">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <img src={logo} alt="The Ozzy" className="h-12 w-12" />
          <div>
            <div className="text-lg font-bold">Diárias de evento</div>
            <div className="text-sm text-ozzy-400">{ev?.nome ?? 'The Ozzy Eventos'}</div>
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
            <p className="text-sm text-stone-600">A gestão confere e aprova. O pagamento cai por Pix.</p>
            {semLocal && (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                Não conseguimos sua localização, então a diária vai para a gestão conferir. Da próxima vez, permita a localização quando o celular pedir.
              </p>
            )}
            <Botao variante="secundario" className="w-full" onClick={() => { setEnviadas(null); setMarcados([]); setObservacao('') }}>Mandar outro dia</Botao>
          </div>
        ) : eventos && !eventos.length ? (
          <div className="rounded-2xl bg-white p-5 text-center text-sm text-stone-600 ring-1 ring-stone-200">
            Nenhum evento aberto para mandar diária agora. Se você trabalhou num evento nas últimas duas semanas, fale com a gestão.
          </div>
        ) : !quem || quem.tipo === 'invalido' || quem.tipo === 'celular_errado' ? (
          <form onSubmit={identificar} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
            <p className="text-sm text-stone-600">Trabalhou de freela num evento da The Ozzy? Mande aqui os dias para entrar no pagamento.</p>
            <Campo rotulo="Seu CPF">
              <input className={estiloEntrada} inputMode="numeric" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)}
                onBlur={() => cpfValido(cpf) && setCpf(formatarCpf(cpf))} required />
            </Campo>
            <Campo rotulo="Seu celular (com DDD)">
              <input className={estiloEntrada} inputMode="tel" placeholder="(11) 90000-0000" value={celular} onChange={(e) => setCelular(e.target.value)} required />
            </Campo>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <Botao className="w-full" disabled={enviando}>{enviando ? 'Conferindo…' : 'Continuar'}</Botao>
          </form>
        ) : (
          <form onSubmit={enviar} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
            {quem.tipo === 'freelancer' || quem.tipo === 'funcionario' ? (
              <div className="space-y-2">
                <h1 className="text-lg font-bold">Oi, {quem.nome}!</h1>
                {!trocarPix ? (
                  <p className="text-sm text-stone-600">
                    O Pix vai para a chave que termina em <b>{quem.pixFinal}</b>.{' '}
                    <button type="button" className="font-semibold text-sky-700" onClick={() => setTrocarPix(true)}>Trocar chave</button>
                  </p>
                ) : (
                  <Campo rotulo="Nova chave Pix" dica="A gestão confere antes de trocar.">
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
            <Campo rotulo="Evento">
              <select className={estiloEntrada} value={evento} onChange={(e) => { setEvento(e.target.value); setMarcados([]) }} required>
                <option value="">Escolha…</option>
                {(eventos ?? []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Função">
              <input className={estiloEntrada} list="funcoes-diaria-evento" placeholder="Ex.: Pizzaiolo" value={funcao} onChange={(e) => setFuncao(e.target.value)} required />
              <datalist id="funcoes-diaria-evento">{FUNCOES_EVENTO.map((f) => <option key={f} value={f} />)}</datalist>
            </Campo>
            {ev && (
              <div>
                <span className="mb-1 block text-sm font-medium text-stone-700">Dias que você trabalhou</span>
                <div className="divide-y divide-stone-100 rounded-xl bg-white ring-1 ring-stone-200">
                  {ev.dias.map((d) => {
                    const marcado = marcados.includes(d)
                    return (
                      <button key={d} type="button" aria-pressed={marcado} onClick={() => setMarcados(marcado ? marcados.filter((x) => x !== d) : [...marcados, d])}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left">
                        <span className="flex-1 text-sm">{d === hoje() ? 'Hoje' : d === addDias(hoje(), -1) ? 'Ontem' : diaSemana(d)}, {dataCurta(d)}</span>
                        <span className={`w-24 rounded-lg py-1.5 text-center text-sm font-semibold ${marcado ? 'bg-carvao text-white' : 'bg-stone-100 text-stone-600'}`}>
                          {marcado ? 'Trabalhei' : 'Marcar'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <Campo rotulo="Observação (opcional)">
              <input className={estiloEntrada} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: fiquei na desmontagem" />
            </Campo>
            <p className="text-xs text-stone-500">📍 Mande daqui do evento, no dia em que trabalhou: o celular vai pedir sua localização, e isso vale como sua presença.</p>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <Botao className="w-full" disabled={enviando}>{enviando ? 'Enviando…' : marcados.length > 1 ? `Enviar ${marcados.length} diárias` : 'Enviar diária'}</Botao>
            <button type="button" className="w-full text-sm font-semibold text-stone-500" onClick={() => setQuem(null)}>Voltar</button>
          </form>
        )}
      </main>
    </div>
  )
}
