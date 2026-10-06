import { useEffect, useState } from 'react'
import { Cartao, Selo, Titulo } from '../components/ui'
import { useApp } from '../lib/contexto'
import { addDias, dataCurta, diaSemana, hoje, inicioDaSemana, tempoDesde } from '../lib/datas'
import { podeGerenciar } from '../lib/permissoes'
import { ir } from '../lib/rota'
import type { Comunicado, Documento, Folga, Ocorrencia } from '../lib/types'
import { nomeTipoOcorrencia } from '../lib/types'

export default function Inicio() {
  const { eu, store, equipe, nomeDe } = useApp()
  const [comunicados, setComunicados] = useState<Comunicado[]>([])
  const [minhasFolgas, setMinhasFolgas] = useState<Folga[]>([])
  const gestao = podeGerenciar(eu.nivel)

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
      <div>
        <p className="text-sm text-stone-500">{saudacao},</p>
        <h1 className="text-2xl font-bold tracking-tight">{eu.nome.split(' ')[0]}</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Cartao onClick={() => ir('comunicados')}>
          <div className="text-sm text-stone-500">Avisos não lidos</div>
          <div className="mt-1 text-3xl font-bold">{naoLidos.length}</div>
        </Cartao>
        <Cartao onClick={() => ir('escala')}>
          <div className="text-sm text-stone-500">Minhas próximas folgas</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {minhasFolgas.filter((f) => f.data >= hoje()).length === 0 ? (
              <span className="text-sm text-stone-400">Nenhuma marcada</span>
            ) : (
              minhasFolgas
                .filter((f) => f.data >= hoje())
                .sort((a, b) => a.data.localeCompare(b.data))
                .map((f) => (
                  <Selo key={f.id} cor="ambar">
                    {diaSemana(f.data)} {dataCurta(f.data)}
                  </Selo>
                ))
            )}
          </div>
        </Cartao>
        <Cartao onClick={() => ir('eu')} className="bg-carvao! text-white ring-0!">
          <div className="text-sm text-stone-300">Mandou atestado?</div>
          <div className="mt-1 font-semibold text-ozzy-400">Enviar documento ›</div>
        </Cartao>
      </div>

      {gestao && <PainelGestao totalAtivos={equipe.filter((f) => f.status === 'ativo').length} />}

      <section>
        <Titulo acao={<button onClick={() => ir('comunicados')} className="text-sm font-semibold text-ozzy-700">Ver todos</button>}>
          Últimos avisos
        </Titulo>
        <div className="space-y-2">
          {comunicados.slice(0, 3).map((c) => (
            <Cartao key={c.id} onClick={() => ir('comunicados')}>
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
        <Cartao onClick={() => ir('equipe')}>
          <div className="text-sm text-stone-500">Funcionários ativos</div>
          <div className="mt-1 text-3xl font-bold">{totalAtivos}</div>
        </Cartao>
        <Cartao>
          <div className="text-sm text-stone-500">Atestados (14 dias)</div>
          <div className="mt-1 text-3xl font-bold">{atestados.length}</div>
          <div className="mt-1 space-y-0.5">
            {atestados.slice(0, 3).map((d) => (
              <button key={d.id} onClick={() => ir('equipe/' + d.funcionarioId)} className="block text-left text-xs text-stone-600 hover:underline">
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
              <button key={o.id} onClick={() => ir('equipe/' + o.funcionarioId)} className="block text-left text-xs text-stone-600 hover:underline">
                {nomeTipoOcorrencia(o.tipo)} · {nomeDe(o.funcionarioId)} · {dataCurta(o.data)}
              </button>
            ))}
          </div>
        </Cartao>
      </div>
    </section>
  )
}
