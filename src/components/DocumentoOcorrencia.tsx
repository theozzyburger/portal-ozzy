import Impressao from './Impressao'
import { useApp } from '../lib/contexto'
import { addDias, hoje } from '../lib/datas'
import type { Funcionario, Ocorrencia } from '../lib/types'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const br = (d: string) => d.split('-').reverse().join('/')
const porExtenso = (d: string) => `${Number(d.slice(8, 10))} de ${MESES[Number(d.slice(5, 7)) - 1]} de ${d.slice(0, 4)}`

export const temDocumento = (o: Pick<Ocorrencia, 'tipo'>) => o.tipo === 'advertencia' || o.tipo === 'suspensao'

// Advertência ou suspensão pronta para imprimir e colher as assinaturas.
export default function DocumentoOcorrencia({ o, pessoa, aoFechar }: { o: Ocorrencia; pessoa: Funcionario; aoFechar: () => void }) {
  const { nomeUnidade } = useApp()
  const suspensao = o.tipo === 'suspensao'
  const natureza = o.natureza || 'conduta inadequada'
  const inicio = o.suspensaoInicio || addDias(o.data, 1)
  const dias = o.suspensaoDias || 1
  const retorno = addDias(inicio, dias)
  const titulo = suspensao ? 'Suspensão disciplinar' : 'Advertência disciplinar'

  return (
    <Impressao titulo={`${titulo} · ${pessoa.nome}`} aoFechar={aoFechar}>
      <header className="mb-8 border-b-2 border-black pb-3">
        <div className="text-lg font-bold">{nomeUnidade(pessoa.unidadeId)}</div>
        <div className="text-xs">CNPJ: ______________________________</div>
      </header>

      <h1 className="mb-8 text-center text-xl font-bold tracking-wide uppercase">{titulo}</h1>

      <p className="mb-1"><strong>Empregado(a):</strong> {pessoa.nome}</p>
      <p className="mb-6"><strong>Cargo:</strong> {pessoa.cargo}</p>

      {suspensao ? (
        <p className="mb-4 text-justify">
          Pela presente, comunicamos que V.Sa. está <strong>suspenso(a)</strong> de suas atividades por <strong>{dias} dia{dias > 1 ? 's' : ''}</strong>,
          de {br(inicio)} a {br(addDias(retorno, -1))}, devendo retornar ao trabalho em <strong>{br(retorno)}</strong>, em razão de
          {' '}<strong>{natureza.toLowerCase()}</strong>, ocorrido(a) em {br(o.data)}, conforme descrito abaixo.
        </p>
      ) : (
        <p className="mb-4 text-justify">
          Pela presente, fica V.Sa. <strong>advertido(a)</strong> em razão de <strong>{natureza.toLowerCase()}</strong>,
          ocorrido(a) em {br(o.data)}, conforme descrito abaixo.
        </p>
      )}

      <div className="mb-4 min-h-24 rounded border border-black p-3 whitespace-pre-wrap">{o.descricao}</div>

      <p className="mb-4 text-justify">
        {suspensao
          ? 'Os dias de suspensão não serão remunerados. '
          : ''}
        Esclarecemos que a repetição de faltas desta natureza poderá acarretar a aplicação de penalidades mais severas,
        inclusive a rescisão do contrato de trabalho por justa causa, nos termos do art. 482 da CLT.
      </p>

      <p className="mb-12">São Paulo, {porExtenso(hoje())}.</p>

      <div className="grid grid-cols-2 gap-x-10 gap-y-14">
        <Assinatura nome="Empregador" />
        <Assinatura nome={`${pessoa.nome}`} detalhe="Ciente em ____/____/________" />
        <Assinatura nome="Testemunha 1" detalhe="Nome:" />
        <Assinatura nome="Testemunha 2" detalhe="Nome:" />
      </div>
      <p className="mt-10 text-[11px] text-stone-600">
        Se o(a) empregado(a) se recusar a assinar, duas testemunhas assinam confirmando que ele(a) foi comunicado(a).
      </p>
    </Impressao>
  )
}

function Assinatura({ nome, detalhe }: { nome: string; detalhe?: string }) {
  return (
    <div className="text-center text-xs">
      <div className="mb-1 border-t border-black" />
      <div className="font-semibold">{nome}</div>
      {detalhe && <div className="mt-1 text-left">{detalhe}</div>}
    </div>
  )
}
