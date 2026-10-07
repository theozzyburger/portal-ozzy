import { useEffect, useState } from 'react'
import { atendeChamados } from '../lib/permissoes'
import { chamadoEmAberto, type Chamado } from '../lib/types'
import { haQuanto } from './Manutencao'
import { Avatar, Cartao, Selo, Titulo } from '../components/ui'
import arte from '../assets/banner-ozzy.jpg'
import Icone from '../components/Icone'
import { modulosVisiveis } from '../lib/modulos'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, diaSemana, hoje, inicioDaSemana, tempoDesde } from '../lib/datas'
import { avisaFerias, isentoDeRotinas, podeGerenciar, podeVerPainel } from '../lib/permissoes'
import { COR_SITUACAO, TEXTO_SITUACAO, alertasFerias, type AlertaFerias as AlertaFeriasT } from '../lib/ferias'
const dataBr = (d: string) => d.split('-').reverse().join('/')
import Painel from './Painel'
import { ir } from '../lib/rota'
import type { Comunicado, Documento, EntregaUniforme, Folga, Ocorrencia } from '../lib/types'
import { exigenciasDe, pendencias, textoSituacao, type Pendencia } from '../lib/vencimentos'
import { nomeTipoOcorrencia } from '../lib/types'

export default function Inicio() {
  const { eu, store, equipe, nomeDe } = useApp()
  const [comunicados, setComunicados] = useState<Comunicado[]>([])
  const [minhasFolgas, setMinhasFolgas] = useState<Folga[]>([])
  const gestao = podeGerenciar(eu.nivel)
  const painel = podeVerPainel(eu.nivel)

  const [meusDocs, setMeusDocs] = useState<Documento[]>([])
  const [meusUniformes, setMeusUniformes] = useState<EntregaUniforme[]>([])
  const [docsEquipe, setDocsEquipe] = useState<Documento[]>([])
  const [assinouRegulamento, setAssinouRegulamento] = useState(true)

  useEffect(() => {
    store.documentos(eu.id).then(setMeusDocs)
    store.uniformes(eu.id).then(setMeusUniformes)
    Promise.all([store.versoesRegulamento(), store.leiturasRegulamento()]).then(([vs, ls]) =>
      setAssinouRegulamento(!vs[0] || ls.some((l) => l.funcionarioId === eu.id && l.versaoId === vs[0].id)),
    )
    if (podeGerenciar(eu.nivel)) store.documentosTodos().then(setDocsEquipe)
  }, [store, eu.id, eu.nivel])

  useEffect(() => {
    store.comunicados().then(setComunicados)
    const ini = inicioDaSemana(hoje())
    store.folgas(ini, addDias(ini, 13)).then((fs) => setMinhasFolgas(fs.filter((f) => f.funcionarioId === eu.id)))
  }, [store, eu.id])

  const naoLidos = comunicados.filter((c) => !c.lidoPor.includes(eu.id))
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="space-y-6">
      <div className="relative h-44 overflow-hidden rounded-3xl bg-ozzy-400 sm:h-60">
        <img src={arte} alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_40%] sm:object-[50%_22%]" />
        <div className="relative flex h-full items-end p-4 sm:p-6">
          <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-carvao/90 py-2.5 pr-5 pl-3 shadow-lg ring-2 ring-ozzy-400">
            <Avatar nome={eu.nome} foto={eu.fotoUrl} tamanho={48} />
            <div className="min-w-0">
              <p className="text-sm text-white/80">{saudacao}! Bem-vindo,</p>
              <h1 className="truncate text-3xl leading-tight font-extrabold tracking-tight text-ozzy-400 uppercase sm:text-4xl">{eu.nome.split(' ')[0]}</h1>
            </div>
          </div>
        </div>
      </div>

      <MeusAvisos docs={isentoDeRotinas(eu.nivel) ? null : meusDocs} uniformes={meusUniformes} regulamento={!assinouRegulamento && !isentoDeRotinas(eu.nivel)} />

      {atendeChamados(eu.nivel) && <ResumoChamados />}

      {gestao && <AlertaEquipe pend={pendencias(equipe, docsEquipe)} />}

      {avisaFerias(eu.nivel) && <AlertaFerias />}

      {painel && <Painel />}

      {/* O proprietário não tem folga marcada nem manda atestado (pedido de 07/10): só o card de avisos. */}
      <div className={`grid gap-3 ${isentoDeRotinas(eu.nivel) ? '' : 'sm:grid-cols-3'}`}>
        <Cartao onClick={() => ir('rh/avisos')}>
          <div className="text-sm text-stone-500">Avisos não lidos</div>
          <div className="mt-1 text-3xl font-bold">{naoLidos.length}</div>
        </Cartao>
        {!isentoDeRotinas(eu.nivel) && (<>
        <Cartao onClick={() => ir('rh/folgas')}>
          <div className="text-sm text-stone-500">Minhas próximas folgas</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {minhasFolgas.filter((f) => f.data >= hoje()).length === 0 ? (
              <span className="text-sm text-stone-400">Nenhuma marcada</span>
            ) : (
              minhasFolgas
                .filter((f) => f.data >= hoje())
                .sort((a, b) => a.data.localeCompare(b.data))
                .map((f) => (
                  <Selo key={f.id} cor={f.tipo === 'feriado' ? 'azul' : 'ambar'}>
                    {diaSemana(f.data)} {dataCurta(f.data)}
                  </Selo>
                ))
            )}
          </div>
        </Cartao>
        <Cartao onClick={() => ir('rh/perfil')} className="bg-carvao! text-white ring-0!">
          <div className="text-sm text-stone-300">Mandou atestado?</div>
          <div className="mt-1 font-semibold text-ozzy-400">Enviar documento ›</div>
        </Cartao>
        </>)}
      </div>

      {gestao && !painel && <PainelGestao totalAtivos={equipe.filter((f) => f.status === 'ativo').length} />}

      <section>
        <Titulo acao={<button onClick={() => ir('rh/avisos')} className="text-sm font-semibold text-carvao underline decoration-ozzy-500 decoration-2 underline-offset-4">Ver todos</button>}>
          Últimos avisos
        </Titulo>
        <div className="space-y-2">
          {comunicados.slice(0, 3).map((c) => (
            <Cartao key={c.id} onClick={() => ir('rh/avisos')}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold">{c.titulo}</div>
                {!c.lidoPor.includes(eu.id) && <Selo cor="ambar">Novo</Selo>}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-stone-600">{c.corpo}</p>
              <div className="mt-2 text-xs text-stone-400">
                {nomeDe(c.autorId)} · {tempoDesde(c.criadoEm)}
              </div>
            </Cartao>
          ))}
        </div>
      </section>

      <section>
        <Titulo>Áreas do portal</Titulo>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {modulosVisiveis(eu.nivel)
            .filter((m) => m.id !== 'inicio')
            .map((m) => (
              <button
                key={m.id}
                onClick={() => ir(m.id === 'rh' ? 'rh/avisos' : m.id)}
                className="flex flex-col items-start gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-stone-200 transition hover:ring-carvao"
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${m.pronto ? 'bg-carvao text-ozzy-400' : 'bg-stone-100 text-stone-500'}`}>
                  <Icone nome={m.id} />
                </span>
                <span className="text-sm font-semibold">{m.nome}</span>
                {m.pronto ? <Selo cor="verde">Disponível</Selo> : <Selo>Em breve</Selo>}
              </button>
            ))}
        </div>
      </section>
    </div>
  )
}

function PainelGestao({ totalAtivos }: { totalAtivos: number }) {
  const { store, equipe, nomeDe } = useApp()
  const [atestados, setAtestados] = useState<Documento[]>([])
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])

  useEffect(() => {
    const desde = addDias(hoje(), -14)
    Promise.all(equipe.map((f) => store.documentos(f.id))).then((ls) =>
      setAtestados(ls.flat().filter((d) => d.tipo === 'atestado' && d.criadoEm.slice(0, 10) >= desde)),
    )
    Promise.all(equipe.map((f) => store.ocorrencias(f.id))).then((ls) =>
      setOcorrencias(ls.flat().filter((o) => o.data >= desde).sort((a, b) => b.data.localeCompare(a.data))),
    )
  }, [store, equipe])

  return (
    <section>
      <Titulo>Visão da gestão</Titulo>
      <div className="grid gap-3 sm:grid-cols-3">
        <Cartao onClick={() => ir('rh/equipe')}>
          <div className="text-sm text-stone-500">Funcionários ativos</div>
          <div className="mt-1 text-3xl font-bold">{totalAtivos}</div>
        </Cartao>
        <Cartao>
          <div className="text-sm text-stone-500">Atestados (14 dias)</div>
          <div className="mt-1 text-3xl font-bold">{atestados.length}</div>
          <div className="mt-1 space-y-0.5">
            {atestados.slice(0, 3).map((d) => (
              <button key={d.id} onClick={() => ir('rh/equipe/' + d.funcionarioId)} className="block text-left text-xs text-stone-600 hover:underline">
                {nomeDe(d.funcionarioId)} · {d.inicio ? dataCurta(d.inicio) : dataCurta(d.criadoEm)}
              </button>
            ))}
          </div>
        </Cartao>
        <Cartao>
          <div className="text-sm text-stone-500">Ocorrências (14 dias)</div>
          <div className="mt-1 text-3xl font-bold">{ocorrencias.length}</div>
          <div className="mt-1 space-y-0.5">
            {ocorrencias.slice(0, 3).map((o) => (
              <button key={o.id} onClick={() => ir('rh/equipe/' + o.funcionarioId)} className="block text-left text-xs text-stone-600 hover:underline">
                {nomeTipoOcorrencia(o.tipo)} · {nomeDe(o.funcionarioId)} · {dataCurta(o.data)}
              </button>
            ))}
          </div>
        </Cartao>
      </div>
    </section>
  )
}

// Avisos pessoais: exame vencendo ou faltando, e termo de uniforme para assinar.
function MeusAvisos({ docs, uniformes, regulamento }: { docs: Documento[] | null; uniformes: EntregaUniforme[]; regulamento: boolean }) {
  const { eu } = useApp()
  // docs = null: a pessoa não entra no controle de exames.
  const exames = docs === null ? [] : exigenciasDe(docs, eu).filter((i) => i.situacao !== 'em_dia')
  const termos = uniformes.filter((u) => !u.assinatura)
  if (!exames.length && !termos.length && !regulamento) return null
  return (
    <section className="space-y-2">
      {regulamento && (
        <button onClick={() => ir('regras')} className="flex w-full items-center gap-3 rounded-2xl bg-ozzy-400 p-4 text-left text-carvao">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-carvao text-lg font-bold text-ozzy-400">!</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Leia e assine o regulamento interno</span>
            <span className="block text-sm">As regras da casa, do ponto às refeições. Toque para ler.</span>
          </span>
          <span className="text-xl">›</span>
        </button>
      )}
      {termos.map((t) => (
        <button
          key={t.id}
          onClick={() => ir('rh/perfil')}
          className="flex w-full items-center gap-3 rounded-2xl bg-ozzy-400 p-4 text-left text-carvao"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-carvao text-lg font-bold text-ozzy-400">!</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Assine o termo do uniforme</span>
            <span className="block text-sm">Você recebeu {t.itens.map((i) => i.item.toLowerCase()).join(', ')}. Toque para assinar.</span>
          </span>
          <span className="text-xl">›</span>
        </button>
      ))}
      {exames.length > 0 && (
        <button onClick={() => ir('rh/perfil')} className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left ring-2 ring-red-200">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-lg font-bold text-white">!</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Seus exames precisam de atenção</span>
            {exames.map((i) => (
              <span key={i.id} className="block text-sm text-stone-600">
                {i.nome}: {textoSituacao(i).toLowerCase()}
              </span>
            ))}
          </span>
          <span className="text-xl text-stone-400">›</span>
        </button>
      )}
    </section>
  )
}

function AlertaFerias() {
  const { store, equipe } = useApp()
  const [alertas, setAlertas] = useState<AlertaFeriasT[]>([])
  useEffect(() => {
    store.ferias().then((fs) => setAlertas(alertasFerias(equipe, fs, hoje())))
  }, [store, equipe])
  if (!alertas.length) return null
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ozzy-400 text-sm font-bold">{alertas.length}</span>
        <span className="font-semibold">Férias vencendo nos próximos 3 meses</span>
      </div>
      <ul className="divide-y divide-stone-100">
        {alertas.map((a) => (
          <li key={a.pessoa.id + a.periodo.inicio}>
            <button onClick={() => ir('rh/equipe/' + a.pessoa.id)} className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{a.pessoa.nome}</span>
                <span className="block text-xs text-stone-500">
                  {a.periodo.saldo} dias a tirar · {a.periodo.situacao === 'vencida' ? `venceu em ${dataBr(a.periodo.concessivoFim)}` : `começar até ${dataBr(a.periodo.comecarAte)}`}
                </span>
              </span>
              <Selo cor={COR_SITUACAO[a.periodo.situacao]}>{TEXTO_SITUACAO[a.periodo.situacao]}</Selo>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function AlertaEquipe({ pend }: { pend: Pendencia[] }) {
  if (!pend.length) return null
  const n = (s: string) => pend.filter((p) => p.item.situacao === s).length
  const partes = [
    n('vencido') && `${n('vencido')} vencido${n('vencido') > 1 ? 's' : ''}`,
    n('faltando') && `${n('faltando')} não enviado${n('faltando') > 1 ? 's' : ''}`,
    n('vence_logo') && `${n('vence_logo')} vencendo em 30 dias`,
  ].filter(Boolean)
  return (
    <button onClick={() => ir('rh/exames')} className="flex w-full items-center gap-3 rounded-2xl bg-carvao p-4 text-left text-white">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-lg font-bold">!</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Exames da equipe</span>
        <span className="block text-sm text-stone-300">{partes.join(' · ')}</span>
      </span>
      <span className="text-sm font-semibold text-ozzy-400">Ver ›</span>
    </button>
  )
}

function ResumoChamados() {
  const { store } = useApp()
  const [chamados, setChamados] = useState<Chamado[]>([])
  useEffect(() => {
    store.chamados().then(setChamados)
  }, [store])
  const abertos = chamados.filter((c) => chamadoEmAberto(c.status))
  if (!abertos.length) return null
  const urgentes = abertos.filter((c) => c.gravidade === 'urgente').length
  return (
    <button onClick={() => ir('manutencao')} className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-stone-200 hover:ring-carvao">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${urgentes ? 'bg-red-600 text-white' : 'bg-carvao text-ozzy-400'}`}>
        {abertos.length}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Chamados de manutenção em aberto</span>
        <span className="block text-sm text-stone-600">
          {urgentes ? `${urgentes} urgente${urgentes > 1 ? 's' : ''} · ` : ''}mais antigo aberto {haQuanto(abertos.reduce((a, c) => (c.abertoEm < a ? c.abertoEm : a), abertos[0].abertoEm))}
        </span>
      </span>
      <span className="text-sm font-semibold">Ver ›</span>
    </button>
  )
}
