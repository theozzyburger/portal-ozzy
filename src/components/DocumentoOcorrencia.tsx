import Impressao from './Impressao'
import logo from '../assets/logo.png'
import { addDias, hoje } from '../lib/datas'
import { EMPRESAS } from '../lib/empresas'
import type { Funcionario, Ocorrencia } from '../lib/types'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const extenso = (n: number) => (n < 20 ? UNIDADES[n] : n === 20 ? 'vinte' : n < 30 ? `vinte e ${UNIDADES[n - 20]}` : 'trinta')
const br = (d: string) => d.split('-').reverse().join('/')
const porExtenso = (d: string) => `${Number(d.slice(8, 10))} de ${MESES[Number(d.slice(5, 7)) - 1]} de ${d.slice(0, 4)}`

export const temDocumento = (o: Pick<Ocorrencia, 'tipo'>) => o.tipo === 'advertencia' || o.tipo === 'suspensao'

// Advertência ou suspensão pronta para imprimir e colher as assinaturas.
// Texto baseado nos modelos que a empresa já usava (enviados em 07/10), num formato só para os dois.
export default function DocumentoOcorrencia({ o, pessoa, aoFechar }: { o: Ocorrencia; pessoa: Funcionario; aoFechar: () => void }) {
  const empresa = EMPRESAS[pessoa.unidadeId] ?? EMPRESAS['burger-psd']
  const suspensao = o.tipo === 'suspensao'
  const natureza = o.natureza || 'Conduta inadequada'
  const inicio = o.suspensaoInicio || addDias(o.data, 1)
  const dias = o.suspensaoDias || 1
  const retorno = addDias(inicio, dias)
  const titulo = suspensao ? 'Aviso de suspensão disciplinar' : 'Carta de advertência disciplinar'

  return (
    <Impressao titulo={`${suspensao ? 'Suspensão' : 'Advertência'} · ${pessoa.nome}`} aoFechar={aoFechar}>
      <header className="mb-6 flex items-center gap-4 border-b-2 border-black pb-3 text-xs leading-snug">
        <img src={logo} alt="The Ozzy" className="h-16 w-16 shrink-0" />
        <div>
          <div className="text-base font-bold uppercase">{empresa.razaoSocial}</div>
          <div>
            CNPJ {empresa.cnpj}
            {empresa.ie && <> · IE {empresa.ie}</>}
          </div>
          {empresa.endereco && <div>{empresa.endereco} · CEP {empresa.cep} · São Paulo/SP</div>}
        </div>
      </header>

      <h1 className="mb-6 text-center text-lg font-bold tracking-wide uppercase">{titulo}</h1>

      <p className="mb-6">São Paulo, {porExtenso(hoje())}.</p>

      <p>Ilmo(a). Sr(a). <strong>{pessoa.nome}</strong></p>
      <p>Cargo: {pessoa.cargo}</p>
      <p className="mb-5">CPF: ______________________</p>
      <p className="mb-5"><strong>Ref.:</strong> {natureza}{o.data ? `, ocorrido(a) em ${br(o.data)}` : ''}</p>

      {suspensao ? (
        <>
          <p className="mb-3 text-justify">
            Pelo presente instrumento, a empresa {empresa.razaoSocial} comunica ao(à) colaborador(a) acima identificado(a) a aplicação de
            suspensão disciplinar, em razão de <strong>{natureza.toLowerCase()}</strong>, conforme descrito abaixo:
          </p>
          <Descricao texto={o.descricao} />
          <p className="mb-3 text-justify">
            Fica aplicada a presente suspensão disciplinar pelo período de <strong>{String(dias).padStart(2, '0')} ({extenso(dias)}) dia{dias > 1 ? 's' : ''}</strong>,
            a ser cumprida {dias > 1 ? `de ${br(inicio)} a ${br(addDias(retorno, -1))}` : `no dia ${br(inicio)}`}, devendo o(a) colaborador(a) retornar ao trabalho
            em <strong>{br(retorno)}</strong>. Os dias de suspensão não são remunerados.
          </p>
          <p className="mb-3 text-justify">
            O(a) colaborador(a) {pessoa.nome} fica ciente de que a repetição da conduta poderá ensejar a adoção de novas medidas disciplinares,
            conforme a legislação trabalhista e as normas internas da empresa.
          </p>
          <p className="mb-8 text-justify">
            O presente documento é emitido para fins de registro e ciência da medida disciplinar aplicada. Solicitamos seu ciente na cópia desta.
          </p>
        </>
      ) : (
        <>
          <p className="mb-3 text-justify">
            Tendo em vista V.Sa. ter cometido o(s) ato(s) de indisciplina descrito(s) abaixo, infringindo o artigo 482 da CLT (Consolidação das
            Leis do Trabalho, Decreto-Lei nº 5.452/1943), resolvemos aplicar-lhe como medida disciplinar a presente <strong>CARTA DE ADVERTÊNCIA</strong>,
            com o intuito de evitar a reincidência ou o cometimento de outra(s) falta(s) de qualquer natureza prevista em lei, o que nos obrigará a
            tomar outras medidas cabíveis de acordo com a legislação em vigor.
          </p>
          <Descricao texto={o.descricao} />
          <p className="mb-8 text-justify">Solicitamos seu ciente na cópia desta.</p>
        </>
      )}

      <p className="mb-10">Atenciosamente,</p>

      <div className="grid grid-cols-2 gap-x-10 gap-y-12 print:break-inside-avoid">
        <Assinatura nome={empresa.razaoSocial} detalhe="Empregador(a)" />
        <Assinatura nome={pessoa.nome} detalhe="Ciente em ____/____/________" />
        <Assinatura nome="Testemunha 1" detalhe="Nome:" />
        <Assinatura nome="Testemunha 2" detalhe="Nome:" />
      </div>
      <p className="mt-6 text-[11px] text-stone-600">
        Se o(a) colaborador(a) se recusar a assinar, as duas testemunhas assinam confirmando que ele(a) foi comunicado(a).
      </p>

      {!suspensao && (
        <section className="mt-8 border-t border-black pt-3 text-[10.5px] leading-snug print:break-before-page print:border-0 print:pt-0">
          <p className="mb-1 font-bold">Para seu conhecimento, transcrevemos abaixo o artigo 482 da CLT:</p>
          <p className="mb-1">Art. 482. Constituem justa causa para rescisão do contrato de trabalho pelo empregador:</p>
          <ol className="list-[lower-alpha] space-y-0.5 pl-5">
            <li>ato de improbidade;</li>
            <li>incontinência de conduta ou mau procedimento;</li>
            <li>negociação habitual por conta própria ou alheia sem permissão do empregador, e quando constituir ato de concorrência à empresa para a qual trabalha o empregado, ou for prejudicial ao serviço;</li>
            <li>condenação criminal do empregado, passada em julgado, caso não tenha havido suspensão da execução da pena;</li>
            <li>desídia no desempenho das respectivas funções;</li>
            <li>embriaguez habitual ou em serviço;</li>
            <li>violação de segredo da empresa;</li>
            <li>ato de indisciplina ou de insubordinação;</li>
            <li>abandono de emprego;</li>
            <li>ato lesivo da honra ou da boa fama praticado no serviço contra qualquer pessoa, ou ofensas físicas, nas mesmas condições, salvo em caso de legítima defesa, própria ou de outrem;</li>
            <li>ato lesivo da honra ou da boa fama ou ofensas físicas praticadas contra o empregador e superiores hierárquicos, salvo em caso de legítima defesa, própria ou de outrem;</li>
            <li>prática constante de jogos de azar;</li>
            <li>perda da habilitação ou dos requisitos estabelecidos em lei para o exercício da profissão, em decorrência de conduta dolosa do empregado.</li>
          </ol>
        </section>
      )}
    </Impressao>
  )
}

function Descricao({ texto }: { texto: string }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs font-semibold uppercase">Descrição</div>
      <div className="min-h-20 rounded border border-black p-3 whitespace-pre-wrap">{texto}</div>
    </div>
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
