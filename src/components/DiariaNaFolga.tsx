import { useEffect, useState } from 'react'
import { Botao, Campo, Modal, Selo, estiloEntrada } from './ui'
import CamposDiaria, { NOME_TURNO, diasMarcados, type DiariaParaEnviar } from './CamposDiaria'
import { useApp } from '../lib/contexto'
import { AvisoPrazo, DicaLocal } from '../pages/EnviarDiaria'
import { pegarLocalizacao } from '../lib/store'
import { dataCurta, diaSemana } from '../lib/datas'
import { apelidoUnidade, type EnvioFreela } from '../lib/types'

// Funcionário que fez diária na folga manda pelo próprio login (pedido de 08/10). Vai para a gestão aprovar
// junto com as dos freelancers, e é paga na segunda seguinte.
export default function DiariaNaFolga({ aoFechar }: { aoFechar: () => void }) {
  const { store, eu, unidades, avisar } = useApp()
  const [meus, setMeus] = useState<EnvioFreela[]>([])
  const [pix, setPix] = useState(eu.pix ?? '')
  const [v, setV] = useState<DiariaParaEnviar>({ unidadeId: eu.unidadeId, funcao: '', observacao: '', marcados: [] })
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    store.enviosFreela('meus').then((es) => {
      setMeus(es)
      const ultima = es[0]
      if (ultima) setV((x) => ({ ...x, funcao: x.funcao || ultima.funcao, unidadeId: ultima.unidadeId }))
    })
  }, [store])

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pix.trim()) return setErro('Coloque a chave Pix para receber.')
    if (!v.marcados.length) return setErro('Marque pelo menos um dia.')
    setErro('')
    setEnviando(true)
    try {
      const local = await pegarLocalizacao()
      const n = await store.enviarMinhasDiarias({ pix, unidadeId: v.unidadeId, funcao: v.funcao, dias: diasMarcados(v), local })
      avisar(n ? `${n === 1 ? 'Diária enviada' : `${n} diárias enviadas`} para a gestão aprovar` : 'Esses dias já tinham sido enviados')
      aoFechar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const nomeLoja = (id: string) => apelidoUnidade(unidades.find((u) => u.id === id)?.nome ?? id)

  return (
    <Modal titulo="Fiz diária na folga" aberto aoFechar={aoFechar}>
      <form onSubmit={enviar} className="space-y-4">
        <p className="text-sm text-stone-600">Marque os dias em que você trabalhou como freela. A gestão aprova e o Pix cai até a terça-feira seguinte.</p>
        <AvisoPrazo />
        <CamposDiaria v={v} mudar={setV} unidades={unidades} jaEnviados={meus.filter((m) => m.status !== 'recusado').map((m) => `${m.data}|${m.turno}`)} />
        <Campo rotulo="Chave Pix para receber" dica="Vem do seu cadastro; dá para trocar aqui.">
          <input className={estiloEntrada} value={pix} onChange={(e) => setPix(e.target.value)} required />
        </Campo>
        <DicaLocal />
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full" disabled={enviando}>
          {enviando ? 'Enviando…' : v.marcados.length > 1 ? `Enviar ${v.marcados.length} diárias` : 'Enviar diária'}
        </Botao>
      </form>

      {meus.length > 0 && (
        <div className="mt-5 space-y-1 border-t border-stone-100 pt-4">
          <h3 className="text-sm font-semibold">Já enviadas</h3>
          {meus.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-stone-600">
                {diaSemana(m.data)} {dataCurta(m.data)} · {NOME_TURNO[m.turno]} · {nomeLoja(m.unidadeId)}
                {m.motivo && <span className="block text-xs text-red-700">{m.motivo}</span>}
              </span>
              {m.status === 'aprovado' ? <Selo cor="verde">Aprovada</Selo> : m.status === 'recusado' ? <Selo cor="vermelho">Recusada</Selo> : <Selo cor="ambar">Esperando</Selo>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
