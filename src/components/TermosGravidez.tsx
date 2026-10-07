import Impressao from './Impressao'
import logo from '../assets/logo.png'
import { formatarCpf } from '../lib/cpf'
import { EMPRESAS } from '../lib/empresas'
import type { Funcionario } from '../lib/types'

// No desligamento de uma colaboradora: oferta do exame de gravidez (Beta HCG) pago pela empresa
// e, se ela não quiser fazer, o termo de recusa. Texto dos modelos enviados em 07/10. Saem em duas folhas.
export default function TermosGravidez({ pessoa, aoFechar }: { pessoa: Funcionario; aoFechar: () => void }) {
  const empresa = EMPRESAS[pessoa.unidadeId] ?? EMPRESAS['burger-psd']
  const cpf = pessoa.cpf ? formatarCpf(pessoa.cpf) : '____________________________'

  const cabecalho = (
    <header className="mb-10 flex items-center gap-4 border-b-2 border-black pb-3 text-xs leading-snug">
      <img src={logo} alt="The Ozzy" className="h-16 w-16 shrink-0" />
      <div>
        <div className="text-base font-bold uppercase">{empresa.razaoSocial}</div>
        <div>CNPJ {empresa.cnpj}{empresa.ie && <> · IE {empresa.ie}</>}</div>
        {empresa.endereco && <div>{empresa.endereco} · CEP {empresa.cep} · São Paulo/SP</div>}
      </div>
    </header>
  )
  const assinaturas = (
    <div className="mt-14 space-y-12 text-sm">
      <p>Local e data: São Paulo, ____ de ________________ de ________.</p>
      <Linha nome={pessoa.nome} detalhe="Assinatura da colaboradora" />
      <Linha nome={empresa.razaoSocial} detalhe="Assinatura da empresa" />
    </div>
  )

  return (
    <Impressao titulo={`Termos de exame de gravidez · ${pessoa.nome}`} aoFechar={aoFechar}>
      <section className="text-[15px] leading-loose">
        {cabecalho}
        <h1 className="mb-8 text-center text-lg font-bold uppercase">Termo de oferta de exame de gravidez (Beta HCG)</h1>
        <p className="mb-4 text-justify">
          Colaboradora: <strong>{pessoa.nome}</strong>, CPF {cpf}.
        </p>
        <p className="mb-4 text-justify">
          A empresa {empresa.razaoSocial} informa à colaboradora acima que, antes da formalização do desligamento, oferece a possibilidade de
          realização de exame de gravidez (Beta HCG), com custo pago pela empresa.
        </p>
        <p className="mb-6">A realização do exame é opcional e não constitui obrigação.</p>
        <p className="mb-2">(&nbsp;&nbsp;&nbsp;&nbsp;) <strong>ACEITA</strong> realizar o exame</p>
        <p>(&nbsp;&nbsp;&nbsp;&nbsp;) <strong>NÃO</strong> deseja realizar o exame</p>
        {assinaturas}
      </section>

      <section className="mt-16 border-t-2 border-dashed border-stone-300 pt-10 text-[15px] leading-loose print:mt-0 print:break-before-page print:border-0 print:pt-0">
        {cabecalho}
        <h1 className="mb-8 text-center text-lg font-bold uppercase">Termo de recusa de exame de gravidez</h1>
        <p className="mb-4 text-justify">
          Eu, <strong>{pessoa.nome}</strong>, CPF {cpf}, declaro que fui informada sobre a possibilidade de realizar exame de gravidez
          (Beta HCG), com custo pago pela empresa {empresa.razaoSocial}.
        </p>
        <p>Declaro que optei por não realizar o exame neste momento.</p>
        {assinaturas}
      </section>
    </Impressao>
  )
}

function Linha({ nome, detalhe }: { nome: string; detalhe: string }) {
  return (
    <div className="w-80 text-xs">
      <div className="mb-1 border-t border-black" />
      <div className="font-semibold">{nome}</div>
      <div>{detalhe}</div>
    </div>
  )
}
