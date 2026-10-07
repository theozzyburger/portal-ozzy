import Impressao from './Impressao'
import logo from '../assets/logo.png'
import { hoje } from '../lib/datas'
import { EMPRESAS } from '../lib/empresas'
import type { Funcionario } from '../lib/types'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const br = (d: string) => d.split('-').reverse().join('/')
const porExtenso = (d: string) => `${Number(d.slice(8, 10))} de ${MESES[Number(d.slice(5, 7)) - 1]} de ${d.slice(0, 4)}`

// Declaração simples de que a pessoa trabalha na empresa (para banco, aluguel etc.).
export default function DeclaracaoVinculo({ pessoa, aoFechar }: { pessoa: Funcionario; aoFechar: () => void }) {
  const empresa = EMPRESAS[pessoa.unidadeId] ?? EMPRESAS['burger-psd']
  return (
    <Impressao titulo={`Declaração de vínculo · ${pessoa.nome}`} aoFechar={aoFechar}>
      <header className="mb-10 flex items-center gap-4 border-b-2 border-black pb-4">
        <img src={logo} alt="The Ozzy" className="h-20 w-20 shrink-0" />
        <div className="text-xs leading-snug">
          <div className="text-base font-bold uppercase">{empresa.razaoSocial}</div>
          <div>CNPJ {empresa.cnpj}{empresa.ie && <> · IE {empresa.ie}</>}</div>
          {empresa.endereco && <div>{empresa.endereco} · CEP {empresa.cep} · São Paulo/SP</div>}
        </div>
      </header>

      <h1 className="mb-10 text-center text-xl font-bold tracking-wide uppercase">Declaração</h1>

      <p className="mb-6 text-justify text-[15px] leading-loose">
        Declaramos, para os devidos fins, que <strong>{pessoa.nome}</strong>, CPF nº ______________________, é colaborador(a)
        desta empresa desde <strong>{br(pessoa.dataAdmissao)}</strong>, exercendo atualmente o cargo de <strong>{pessoa.cargo}</strong>,
        e mantém vínculo empregatício ativo até a presente data.
      </p>
      <p className="mb-16 text-[15px]">Por ser expressão da verdade, firmamos a presente declaração.</p>

      <p className="mb-20 text-[15px]">São Paulo, {porExtenso(hoje())}.</p>

      <div className="mx-auto w-80 text-center text-xs">
        <div className="mb-1 border-t border-black" />
        <div className="font-semibold">{empresa.razaoSocial}</div>
        <div>CNPJ {empresa.cnpj}</div>
        <div className="mt-1">Nome e cargo de quem assina: ________________________</div>
      </div>
    </Impressao>
  )
}
