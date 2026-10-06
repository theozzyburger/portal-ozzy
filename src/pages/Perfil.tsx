import { useCallback, useEffect, useState } from 'react'
import { Avatar, Botao, Campo, Cartao, Modal, Selo, Vazio, estiloEntrada } from '../components/ui'
import FormFuncionario from '../components/FormFuncionario'
import { useApp } from '../lib/contexto'
import { dataLonga, hoje } from '../lib/datas'
import { podeGerenciar, podeVerDocumentosDe, podeVerEquipe } from '../lib/permissoes'
import { ir } from '../lib/rota'
import {
  TIPOS_DOCUMENTO, TIPOS_OCORRENCIA, nomeNivel, nomeTipoDocumento, nomeTipoOcorrencia,
  type Documento, type Ocorrencia, type TipoDocumento, type TipoOcorrencia,
} from '../lib/types'

const corOcorrencia: Record<TipoOcorrencia, 'vermelho' | 'ambar' | 'verde' | 'cinza'> = {
  falta: 'vermelho', advertencia: 'vermelho', atraso: 'ambar', orientacao: 'cinza', elogio: 'verde', outro: 'cinza',
}

export default function Perfil({ funcionarioId }: { funcionarioId: string }) {
  const { eu, store, equipe, nomeDe, nomeUnidade, recarregarEquipe, avisar } = useApp()
  const pessoa = equipe.find((f) => f.id === funcionarioId) ?? (funcionarioId === eu.id ? eu : null)
  const [aba, setAba] = useState<'documentos' | 'ocorrencias'>('documentos')
  const [docs, setDocs] = useState<Documento[]>([])
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [modal, setModal] = useState<'editar' | 'documento' | 'ocorrencia' | 'desligar' | null>(null)
  const gestao = podeGerenciar(eu.nivel)
  const souEu = funcionarioId === eu.id

  const carregar = useCallback(async () => {
    setDocs(await store.documentos(funcionarioId))
    setOcorrencias(await store.ocorrencias(funcionarioId))
  }, [store, funcionarioId])
  useEffect(() => {
    carregar()
  }, [carregar])

  if (!pessoa) return <Vazio>Funcionário não encontrado ou fora do seu acesso.</Vazio>
  const verDocs = podeVerDocumentosDe(eu, pessoa)

  const abrir = async (d: Documento) => {
    const url = await store.abrirDocumento(d)
    if (url) window.open(url, '_blank')
    else avisar('Arquivo de exemplo: na versão real ele abre aqui.')
  }

  const reativar = async () => {
    await store.salvarFuncionario({ ...pessoa, status: 'ativo', dataDesligamento: null })
    await recarregarEquipe()
    avisar('Funcionário reativado')
  }

  return (
    <div className="space-y-5">
      {!souEu && podeVerEquipe(eu.nivel) && (
        <button onClick={() => ir('rh/equipe')} className="text-sm font-semibold text-stone-500">
          ‹ Equipe
        </button>
      )}

      <Cartao>
        <div className="flex items-start gap-4">
          <Avatar nome={pessoa.nome} tamanho={56} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">{pessoa.nome}</h1>
            <div className="text-stone-600">{pessoa.cargo}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Selo cor="azul">{nomeUnidade(pessoa.unidadeId)}</Selo>
              <Selo>{nomeNivel(pessoa.nivel)}</Selo>
              {pessoa.status === 'inativo' ? <Selo cor="vermelho">Inativo</Selo> : <Selo cor="verde">Ativo</Selo>}
            </div>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-stone-100 pt-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-stone-500">Celular</dt>
            <dd className="font-medium">{pessoa.celular.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Admissão</dt>
            <dd className="font-medium">{dataLonga(pessoa.dataAdmissao)}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Responde para</dt>
            <dd className="font-medium">{pessoa.respondePara ? nomeDe(pessoa.respondePara) : '—'}</dd>
          </div>
          {pessoa.dataDesligamento && (
            <div>
              <dt className="text-stone-500">Desligamento</dt>
              <dd className="font-medium">{dataLonga(pessoa.dataDesligamento)}</dd>
            </div>
          )}
        </dl>
        {gestao && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Botao variante="secundario" onClick={() => setModal('editar')}>
              Editar
            </Botao>
            <Botao variante="secundario" onClick={() => setModal('ocorrencia')}>
              Registrar ocorrência
            </Botao>
            {pessoa.status === 'ativo' && !souEu ? (
              <Botao variante="perigo" onClick={() => setModal('desligar')}>
                Desligar
              </Botao>
            ) : pessoa.status === 'inativo' ? (
              <Botao variante="secundario" onClick={reativar}>
                Reativar
              </Botao>
            ) : null}
          </div>
        )}
      </Cartao>

      <div className="flex gap-1 rounded-xl bg-stone-200 p-1 text-sm font-semibold">
        {(['documentos', 'ocorrencias'] as const).map((a) => (
          <button key={a} onClick={() => setAba(a)} className={`flex-1 rounded-lg py-2 ${aba === a ? 'bg-white shadow-sm' : 'text-stone-600'}`}>
            {a === 'documentos' ? `Documentos (${docs.length})` : `Ocorrências (${ocorrencias.length})`}
          </button>
        ))}
      </div>

      {aba === 'documentos' ? (
        <section className="space-y-2">
          {(souEu || gestao) && (
            <Botao className="w-full" onClick={() => setModal('documento')}>
              {souEu ? '+ Enviar atestado ou documento' : '+ Anexar documento'}
            </Botao>
          )}
          {!verDocs ? (
            <Vazio>Documentos e atestados são visíveis só para a própria pessoa e para a gestão.</Vazio>
          ) : docs.length === 0 ? (
            <Vazio>Nenhum documento enviado.</Vazio>
          ) : (
            docs.map((d) => (
              <Cartao key={d.id} onClick={() => abrir(d)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Selo cor={d.tipo === 'atestado' ? 'ambar' : 'cinza'}>{nomeTipoDocumento(d.tipo)}</Selo>
                      <span className="truncate text-sm font-medium">{d.nomeArquivo}</span>
                    </div>
                    <div className="mt-1 text-xs text-stone-500">
                      {d.inicio && `Afastamento ${dataLonga(d.inicio)}${d.fim && d.fim !== d.inicio ? ` a ${dataLonga(d.fim)}` : ''} · `}
                      Enviado por {d.enviadoPor === eu.id ? 'você' : nomeDe(d.enviadoPor)} em {dataLonga(d.criadoEm)}
                      {d.observacao && ` · ${d.observacao}`}
                    </div>
                  </div>
                  <span className="text-stone-400">›</span>
                </div>
              </Cartao>
            ))
          )}
        </section>
      ) : (
        <section className="space-y-2">
          {ocorrencias.length === 0 ? (
            <Vazio>Nenhuma ocorrência registrada.</Vazio>
          ) : (
            ocorrencias.map((o) => (
              <Cartao key={o.id}>
                <div className="flex items-center gap-2">
                  <Selo cor={corOcorrencia[o.tipo]}>{nomeTipoOcorrencia(o.tipo)}</Selo>
                  <span className="text-sm font-medium">{dataLonga(o.data)}</span>
                </div>
                <p className="mt-1.5 text-sm text-stone-700">{o.descricao}</p>
                <div className="mt-1 text-xs text-stone-400">Registrado por {nomeDe(o.registradoPor)}</div>
              </Cartao>
            ))
          )}
        </section>
      )}

      {modal === 'editar' && <FormFuncionario aberto existente={pessoa} aoFechar={() => setModal(null)} />}
      <EnviarDocumento
        aberto={modal === 'documento'}
        funcionarioId={pessoa.id}
        aoFechar={() => setModal(null)}
        aoEnviar={async () => {
          setModal(null)
          await carregar()
          avisar(souEu ? 'Enviado! O RH já consegue ver.' : 'Documento anexado')
        }}
      />
      <NovaOcorrencia
        aberto={modal === 'ocorrencia'}
        funcionarioId={pessoa.id}
        aoFechar={() => setModal(null)}
        aoSalvar={async () => {
          setModal(null)
          setAba('ocorrencias')
          await carregar()
          avisar('Ocorrência registrada')
        }}
      />
      <Modal titulo="Desligar funcionário" aberto={modal === 'desligar'} aoFechar={() => setModal(null)}>
        <Desligar
          aoConfirmar={async (data) => {
            await store.salvarFuncionario({ ...pessoa, status: 'inativo', dataDesligamento: data })
            await recarregarEquipe()
            setModal(null)
            avisar('Funcionário movido para inativos')
          }}
          nome={pessoa.nome}
        />
      </Modal>
    </div>
  )
}

function Desligar({ nome, aoConfirmar }: { nome: string; aoConfirmar: (data: string) => void }) {
  const [data, setData] = useState(hoje())
  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">
        {nome} vai para a lista de inativos e perde o acesso ao portal. O histórico (documentos e ocorrências) continua guardado.
      </p>
      <Campo rotulo="Data do desligamento">
        <input className={estiloEntrada} type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </Campo>
      <Botao variante="perigo" className="w-full" onClick={() => aoConfirmar(data)}>
        Confirmar desligamento
      </Botao>
    </div>
  )
}

function EnviarDocumento({ aberto, funcionarioId, aoFechar, aoEnviar }: { aberto: boolean; funcionarioId: string; aoFechar: () => void; aoEnviar: () => void }) {
  const { store } = useApp()
  const [tipo, setTipo] = useState<TipoDocumento>('atestado')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [inicio, setInicio] = useState(hoje())
  const [fim, setFim] = useState(hoje())
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!arquivo) return setErro('Escolha a foto ou o arquivo.')
    setEnviando(true)
    try {
      await store.enviarDocumento({
        funcionarioId, tipo, arquivo, observacao,
        inicio: tipo === 'atestado' ? inicio : undefined,
        fim: tipo === 'atestado' ? fim : undefined,
      })
      setArquivo(null)
      setObservacao('')
      aoEnviar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Enviar documento" aberto={aberto} aoFechar={aoFechar}>
      <form onSubmit={enviar} className="space-y-4">
        <Campo rotulo="Tipo">
          <select className={estiloEntrada} value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)}>
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Foto ou arquivo" dica="Pode tirar foto na hora. Confira se está legível.">
          <input
            className={`${estiloEntrada} file:mr-3 file:rounded-lg file:border-0 file:bg-ozzy-400 file:px-3 file:py-1.5 file:font-semibold file:text-carvao`}
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
        </Campo>
        {tipo === 'atestado' && (
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Afastado de">
              <input className={estiloEntrada} type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </Campo>
            <Campo rotulo="Até">
              <input className={estiloEntrada} type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} />
            </Campo>
          </div>
        )}
        <Campo rotulo="Observação (opcional)">
          <input className={estiloEntrada} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </Campo>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar'}
        </Botao>
      </form>
    </Modal>
  )
}

function NovaOcorrencia({ aberto, funcionarioId, aoFechar, aoSalvar }: { aberto: boolean; funcionarioId: string; aoFechar: () => void; aoSalvar: () => void }) {
  const { store } = useApp()
  const [tipo, setTipo] = useState<TipoOcorrencia>('falta')
  const [data, setData] = useState(hoje())
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState('')

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await store.registrarOcorrencia({ funcionarioId, tipo, data, descricao })
      setDescricao('')
      aoSalvar()
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  return (
    <Modal titulo="Registrar ocorrência" aberto={aberto} aoFechar={aoFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Tipo">
            <select className={estiloEntrada} value={tipo} onChange={(e) => setTipo(e.target.value as TipoOcorrencia)}>
              {TIPOS_OCORRENCIA.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Data">
            <input className={estiloEntrada} type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
        </div>
        <Campo rotulo="O que aconteceu">
          <textarea className={estiloEntrada} rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} required />
        </Campo>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full">Salvar</Botao>
      </form>
    </Modal>
  )
}
