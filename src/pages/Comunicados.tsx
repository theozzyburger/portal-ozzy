import { useCallback, useEffect, useState } from 'react'
import { Botao, Campo, Cartao, Modal, Selo, Titulo, Vazio, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { tempoDesde } from '../lib/datas'
import { podeGerenciar } from '../lib/permissoes'
import type { Comunicado } from '../lib/types'

export default function Comunicados() {
  const { eu, store, equipe, nomeDe, nomeUnidade, avisar } = useApp()
  const [lista, setLista] = useState<Comunicado[]>([])
  const [novo, setNovo] = useState(false)
  const gestao = podeGerenciar(eu.nivel)

  const carregar = useCallback(() => store.comunicados().then(setLista), [store])
  useEffect(() => {
    carregar()
  }, [carregar])

  const marcar = async (c: Comunicado) => {
    await store.marcarLido(c.id)
    await carregar()
    avisar('Leitura confirmada')
  }

  // Quem deveria ler: ativos da unidade do aviso (ou de todas).
  const publico = (c: Comunicado) => equipe.filter((f) => f.status === 'ativo' && (c.unidadeId === null || f.unidadeId === c.unidadeId))

  return (
    <div>
      <Titulo acao={gestao && <Botao onClick={() => setNovo(true)}>+ Novo aviso</Botao>}>Avisos</Titulo>
      <div className="space-y-3">
        {lista.length === 0 && <Vazio>Nenhum aviso por enquanto.</Vazio>}
        {lista.map((c) => {
          const lido = c.lidoPor.includes(eu.id)
          const alvo = publico(c)
          const leram = alvo.filter((f) => c.lidoPor.includes(f.id)).length
          return (
            <Cartao key={c.id} className={lido ? '' : 'ring-2! ring-carvao!'}>
              <div className="flex flex-wrap items-center gap-2">
                <Selo cor={c.unidadeId ? 'azul' : 'cinza'}>{nomeUnidade(c.unidadeId)}</Selo>
                {!lido && <Selo cor="ambar">Novo</Selo>}
              </div>
              <h2 className="mt-2 text-lg font-semibold">{c.titulo}</h2>
              <p className="mt-1 whitespace-pre-line text-[15px] text-stone-700">{c.corpo}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-stone-400">
                  {nomeDe(c.autorId)} · {tempoDesde(c.criadoEm)}
                  {gestao && ` · lido por ${leram} de ${alvo.length}`}
                </span>
                {!lido && (
                  <Botao variante="secundario" onClick={() => marcar(c)}>
                    Li e entendi
                  </Botao>
                )}
              </div>
            </Cartao>
          )
        })}
      </div>
      <NovoComunicado
        aberto={novo}
        aoFechar={() => setNovo(false)}
        aoPublicar={async () => {
          setNovo(false)
          await carregar()
          avisar('Aviso publicado')
        }}
      />
    </div>
  )
}

function NovoComunicado({ aberto, aoFechar, aoPublicar }: { aberto: boolean; aoFechar: () => void; aoPublicar: () => void }) {
  const { store, unidades } = useApp()
  const [titulo, setTitulo] = useState('')
  const [corpo, setCorpo] = useState('')
  const [unidadeId, setUnidadeId] = useState('')
  const [erro, setErro] = useState('')

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await store.publicarComunicado({ titulo, corpo, unidadeId: unidadeId || null })
      setTitulo('')
      setCorpo('')
      aoPublicar()
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  return (
    <Modal titulo="Novo aviso" aberto={aberto} aoFechar={aoFechar}>
      <form onSubmit={enviar} className="space-y-4">
        <Campo rotulo="Para quem">
          <select className={estiloEntrada} value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
            <option value="">Todas as unidades</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Título">
          <input className={estiloEntrada} value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        </Campo>
        <Campo rotulo="Mensagem">
          <textarea className={estiloEntrada} rows={5} value={corpo} onChange={(e) => setCorpo(e.target.value)} required />
        </Campo>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full">Publicar</Botao>
      </form>
    </Modal>
  )
}
