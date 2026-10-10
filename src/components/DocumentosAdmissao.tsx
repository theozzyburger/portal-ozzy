import { useState } from 'react'
import Impressao from './Impressao'
import { Botao, Campo, Modal, estiloEntrada } from './ui'
import logoSouza from '../assets/logo-souza.png'
import { useApp } from '../lib/contexto'
import { folhaParaPdf } from '../lib/pdf'
import { marcarEtapaAdmissao } from './ChecklistAdmissao'
import { formatarCpf } from '../lib/cpf'
import { addDias, dataCurta, hoje } from '../lib/datas'
import { lerNumero, reais } from '../lib/financeiro'
import { EMPRESAS } from '../lib/empresas'
import { EXPERIENCIA_PADRAO } from '../lib/pessoal'
import type { Funcionario } from '../lib/types'

// Documentos da entrada de alguém (reunião de RH de 08/10): o contrato de experiência e a guia do exame
// admissional na clínica. Os dois saem preenchidos com o cadastro; o que faltar sai em branco para escrever à mão.

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const br = (d: string) => d.split('-').reverse().join('/')
const dataExtenso = (d: string) => `${Number(d.slice(8, 10))} de ${MESES[Number(d.slice(5, 7)) - 1]} de ${d.slice(0, 4)}`
const linha = (n = 30) => '_'.repeat(n)

const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
// Por extenso até 99 (dias do contrato).
export const extenso = (n: number) => (n < 20 ? UNIDADES[n] : DEZENAS[Math.floor(n / 10)] + (n % 10 ? ` e ${UNIDADES[n % 10]}` : ''))
const dias = (n: number) => `${String(n).padStart(2, '0')} (${extenso(n)})`

const numero = (s: string) => lerNumero(s) ?? 0

// ---------- Contrato de experiência ----------

export function ContratoExperiencia({ pessoa, aoFechar }: { pessoa: Funcionario; aoFechar: () => void }) {
  const { store, eu } = useApp()
  const [funcao, setFuncao] = useState(pessoa.cargo.toUpperCase())
  const [data, setData] = useState(pessoa.dataAdmissao)
  const [salario, setSalario] = useState('')
  const [salarioDepois, setSalarioDepois] = useState('')
  const [gerar, setGerar] = useState(false)
  const [erro, setErro] = useState('')
  const faltando = [!pessoa.cpf && 'CPF', !pessoa.ctps && 'carteira de trabalho', !pessoa.endereco && 'endereço'].filter(Boolean)

  if (gerar)
    return (
      <TextoContrato
        pessoa={pessoa} funcao={funcao} data={data}
        salario={numero(salario)} salarioDepois={salarioDepois ? numero(salarioDepois) : null}
        aoFechar={aoFechar}
      />
    )

  const continuar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!(numero(salario) > 0)) return setErro('Coloque o salário.')
    if (salarioDepois && !(numero(salarioDepois) > 0)) return setErro('Salário depois da experiência inválido.')
    setGerar(true)
    marcarEtapaAdmissao(store, pessoa, 'contrato', eu.id).catch(() => {})
  }

  return (
    <Modal titulo="Contrato de experiência" aberto aoFechar={aoFechar}>
      <form onSubmit={continuar} className="space-y-4">
        {faltando.length > 0 && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-300">
            Falta no cadastro: {faltando.join(', ')}. Dá para completar em Editar cadastro; se gerar assim, sai uma linha para escrever à mão.
          </p>
        )}
        <Campo rotulo="Função">
          <input className={estiloEntrada} value={funcao} onChange={(e) => setFuncao(e.target.value.toUpperCase())} required />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Salário (R$)">
            <input className={estiloEntrada} inputMode="decimal" placeholder="0,00" value={salario} onChange={(e) => setSalario(e.target.value)} required />
          </Campo>
          <Campo rotulo="Após 3 meses (R$)" dica="Opcional.">
            <input className={estiloEntrada} inputMode="decimal" placeholder="0,00" value={salarioDepois} onChange={(e) => setSalarioDepois(e.target.value)} />
          </Campo>
        </div>
        <Campo rotulo="Data do contrato" dica="Normalmente o dia da admissão.">
          <input className={estiloEntrada} type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        </Campo>
        <p className="text-xs text-stone-500">O salário não fica guardado no portal; só sai neste documento.</p>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <Botao className="w-full">Gerar contrato</Botao>
      </form>
    </Modal>
  )
}

function TextoContrato({
  pessoa, funcao, data, salario, salarioDepois, aoFechar,
}: { pessoa: Funcionario; funcao: string; data: string; salario: number; salarioDepois: number | null; aoFechar: () => void }) {
  const empresa = EMPRESAS[pessoa.unidadeId] ?? EMPRESAS['burger-psd']
  const [d1, d2] = pessoa.experienciaDias1 ? [pessoa.experienciaDias1, pessoa.experienciaDias2 ?? 0] : EXPERIENCIA_PADRAO
  const nome = pessoa.nome.toUpperCase()
  const P = ({ n, children }: { n?: string; children: React.ReactNode }) => (
    <p className="mb-2.5 text-justify">
      {n && <b>{n}. </b>}
      {children}
    </p>
  )
  return (
    <Impressao titulo={`Contrato de experiência · ${pessoa.nome}`} aoFechar={aoFechar}>
      <div className="text-[12px] leading-snug">
        <h1 className="mb-5 text-center text-base font-bold tracking-wide uppercase">Instrumento de Contrato de Trabalho</h1>
        <P>
          Pelo presente instrumento, entre partes, de um lado, <b>{empresa.razaoSocial}</b>, estabelecida na {empresa.endereco ?? linha()}, inscrita no
          CNPJ {empresa.cnpj}, adiante denominada simplesmente empresa, e, de outro lado, a(o) Sr.(a) <b>{nome}</b>, residente e domiciliado(a) em{' '}
          {pessoa.endereco || linha(40)}, portador(a) da Carteira de Trabalho e Previdência Social nº {pessoa.ctps || linha(20)}, inscrito(a) no CPF{' '}
          {pessoa.cpf ? formatarCpf(pessoa.cpf) : linha(16)}, doravante denominado(a) simplesmente empregado, fica estabelecido um Contrato de Trabalho
          por prazo determinado e a título de experiência, que se regerá pelas seguintes cláusulas e condições:
        </P>
        <P n="1">
          O empregado, a título experimental, trabalhará para a empresa a partir desta data, pelo prazo determinado de {dias(d1)} dias, na função de{' '}
          <b>{funcao}</b>
          {d2 > 0 && <>, facultado à empresa prorrogar por mais {dias(d2)} dias, caso julgue conveniente</>}. A cada término do período de prova, o
          contrato de experiência será automaticamente prorrogado, se não houver denúncia, respeitado o limite de 90 dias.
        </P>
        <P n="2">
          O salário do empregado será de {reais(salario)} mensais{salarioDepois ? <>, passando a {reais(salarioDepois)} após 3 meses</> : null}.
        </P>
        <P n="3">
          O empregado exercerá a função de <b>{funcao}</b> em qualquer unidade da empresa ou de empresa do mesmo grupo econômico, devendo neste cargo
          executar todas as atividades que lhe sejam designadas pela empresa, no horário de trabalho fixado de acordo com a cláusula abaixo. O
          empregado desde já concorda com transferência de turno de trabalho, por conveniência do empregador.
        </P>
        <P n="4">
          Se ao fim do período de experiência acima referido resolverem as partes dar continuidade à relação de emprego, passará tal contrato a ser
          considerado como prazo indeterminado, continuando em vigor todas as cláusulas ora estabelecidas.
        </P>
        <P n="5">
          A jornada normal diária de trabalho do empregado poderá ser variável, mas não terá duração inferior a 04 (quatro) horas e nem excederá o
          limite legal máximo de 10 (dez) horas. Em nenhuma hipótese as horas trabalhadas até o limite normal de 10 (dez) horas serão consideradas
          horas extras, pois lançadas em banco de horas, com prazo de 180 dias, período em que o empregador poderá conceder folgas compensatórias, ou
          ao seu final pagar as horas excedentes como extras apenas em caso de não ocorrer a compensação.
        </P>
        <P>
          <b>Parágrafo 1º.</b> Somente aquelas horas que excederem o limite normal de 10 (dez) horas diárias serão computadas e pagas com o acréscimo
          da lei, ressalvada a aplicação do banco de horas, mediante o qual são extras apenas as horas que ultrapassarem os 180 dias, bem como pactuado
          individualmente nesse momento, na forma do artigo 59, §§ 2º e 5º da CLT.
        </P>
        <P>
          <b>Parágrafo 2º.</b> O empregado está ciente de que o banco de horas está vigente no âmbito da empresa, aqui acordado individualmente pelo
          prazo de 180 dias.
        </P>
        <P n="6">
          Os horários fixados na cláusula anterior são considerados compensados ou prorrogados, valendo desde já este instrumento, pelos acordos
          previstos nos artigos 59, parágrafos 1º e 2º, 374 e 413 da Consolidação das Leis do Trabalho. As partes acordam que poderá haver jornada de
          trabalho em dias feriados, mediante a concessão de folga compensatória ou pagamento na forma da lei. O trabalho em feriado fica a critério e
          designação do empregador, devendo o empregado comparecer sob pena de se considerar prática de falta sujeita às penalidades cabíveis.
        </P>
        <P n="7">
          O empregado tem direito a intervalo diário de refeição e descanso de 60 (sessenta) minutos, de acordo com a sua jornada de trabalho (art. 71
          e parágrafos da CLT). As partes pactuam, ainda, que o intervalo intrajornada pode ser ampliado para até 4 horas, no caso dos empregados
          trabalharem em almoço e jantar, conforme artigo 71 "in fine" da CLT. Para jornadas de até 6 horas, fica acordada uma pausa de 15 minutos
          dentro do horário de trabalho.
        </P>
        <P n="8">
          O empregado se responsabiliza por danos e prejuízos que causar à empresa, por dolo ou culpa (negligência, imperícia, imprudência), ficando,
          desde já, a empresa autorizada a se ressarcir desses prejuízos mediante descontos nos salários do empregado, ou por ocasião da rescisão
          contratual, por compensação, se preciso.
        </P>
        <P n="9">
          O empregado concorda em trabalhar em qualquer estabelecimento da empresa ou das empresas coligadas, inclusive aquelas que venham a ser
          criadas após a data deste contrato, obrigando-se a se transferir a qualquer um deles, a critério da empresa, independentemente do pagamento
          de qualquer adicional.
        </P>
        <P n="10">
          Assume ainda o empregado o compromisso irrevogável de manter segredo absoluto e não transmitir, direta ou indiretamente, a quem quer que
          seja, na vigência da relação empregatícia ou posteriormente a ela, quaisquer informações ou conhecimentos técnicos, administrativos ou
          comerciais relativos ao negócio da empresa, inclusive aqueles ligados à organização interna, clientela, serviços, pesquisas,
          aperfeiçoamentos, invenções, contabilidade, vendas, sistema de trabalho e tudo mais relacionado com elementos de caráter confidencial da
          empresa, ressalvada a utilização de tais informações na vigência do presente contrato para desempenho normal das funções.
        </P>
        <P n="11">
          O empregado se obriga a usar, zelar e manter limpos os uniformes que lhe sejam fornecidos gratuitamente pela empresa. Ao término do
          contrato de trabalho, e antes do recebimento de seu último pagamento, o empregado deverá devolver à empresa os referidos uniformes em
          perfeito estado de uso. Em caso de danos ou extravio, o empregado se obriga a ressarcir a empresa do valor do custo dos uniformes.
        </P>
        <P n="12">
          O empregado se obriga a respeitar e acatar as ordens de serviço, instruções e regulamentos da empresa, sob pena de se caracterizar
          insubordinação passível de dispensa por justa causa.
        </P>
        <P n="13">
          O empregado se obriga a em hipótese nenhuma servir alimentos com data de validade vencida ou de qualquer forma impróprios para o consumo de
          clientes e funcionários. Obriga-se, ainda, a verificar, dentro de suas atribuições, se alimentos estão vencidos ou com data próxima do
          vencimento, hipótese em que deverá comunicar ao gerente, para que este proceda ao descarte na forma preconizada pela vigilância e demais
          autoridades sanitárias.
        </P>
        <P n="14">
          Qualquer infração ou falta ao exato e pontual cumprimento de qualquer das cláusulas e condições do presente contrato, por qualquer das
          partes, constitui justa causa ensejadora de sua imediata rescisão, sem direito a qualquer aviso prévio ou indenização, aplicando-se na
          espécie o disposto na legislação trabalhista em vigor.
        </P>
        <P n="15">
          Nesta data, por sua livre e espontânea vontade, o empregado opta pelo regime do Fundo de Garantia por Tempo de Serviço, sendo seus
          depósitos mensais efetuados pela empresa na Caixa Econômica Federal.
        </P>
        <P>
          E por assim estarem justos e contratados, firmam as partes o presente instrumento em duas vias de igual teor, para um só efeito, na
          presença das testemunhas abaixo assinadas, que a tudo assistiram.
        </P>
        <p className="mt-5 mb-10">São Paulo, {dataExtenso(data)}.</p>

        <div className="grid grid-cols-2 gap-x-10 gap-y-12 text-center text-[11px]">
          <div>
            <div className="mb-1 border-t border-black" />
            {empresa.razaoSocial}
          </div>
          <div>
            <div className="mb-1 border-t border-black" />
            {nome}
          </div>
          <div>
            <div className="mb-1 border-t border-black" />
            Testemunha 1
          </div>
          <div>
            <div className="mb-1 border-t border-black" />
            Testemunha 2
          </div>
        </div>
      </div>
    </Impressao>
  )
}

// ---------- Guia de encaminhamento para exame (clínica Souza Segurança do Trabalho) ----------

const TIPOS_EXAME = [
  { valor: 'periodico', nome: 'Periódico' },
  { valor: 'admissional', nome: 'Admissional' },
  { valor: 'demissional', nome: 'Demissional' },
  { valor: 'mudanca', nome: 'Mudança de função' },
  { valor: 'retorno', nome: 'Retorno ao trabalho' },
] as const
type TipoExame = (typeof TIPOS_EXAME)[number]['valor']

// Manipulador de alimentos faz coprocultura e parasitológico; o escritório não.
const COMPLEMENTARES_PADRAO = (p: Funcionario) => (p.setor === 'escritorio' ? [] : ['Coprocultura', 'Parasitológico'])

export function GuiaExame({ pessoa, aoFechar }: { pessoa: Funcionario; aoFechar: () => void }) {
  const { eu, store } = useApp()
  const [tipo, setTipo] = useState<TipoExame>(pessoa.status === 'inativo' ? 'demissional' : 'admissional')
  const [extras, setExtras] = useState<string[]>(COMPLEMENTARES_PADRAO(pessoa))
  const [outro, setOutro] = useState('')
  const [pcmso, setPcmso] = useState(true)
  const [responsavel, setResponsavel] = useState(eu.nome)
  const [telefone, setTelefone] = useState(eu.celular)
  const [gerar, setGerar] = useState(false)
  const alternar = (x: string) => setExtras(extras.includes(x) ? extras.filter((y) => y !== x) : [...extras, x])

  if (gerar)
    return (
      <FolhaGuia
        pessoa={pessoa} tipo={tipo} extras={[...extras, ...outro.split(',').map((x) => x.trim()).filter(Boolean)]}
        pcmso={pcmso} responsavel={responsavel} telefone={telefone} aoFechar={aoFechar}
      />
    )

  return (
    <Modal titulo="Encaminhamento para exame" aberto aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setGerar(true)
          marcarEtapaAdmissao(store, pessoa, 'guia', eu.id).catch(() => {})
        }}
        className="space-y-4"
      >
        <Campo rotulo="Tipo de exame">
          <select className={estiloEntrada} value={tipo} onChange={(e) => setTipo(e.target.value as TipoExame)}>
            {TIPOS_EXAME.map((t) => <option key={t.valor} value={t.valor}>{t.nome}</option>)}
          </select>
        </Campo>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-stone-700">Exames complementares</legend>
          <div className="space-y-1.5 text-sm">
            {['Coprocultura', 'Parasitológico'].map((x) => (
              <label key={x} className="flex items-center gap-2">
                <input type="checkbox" checked={extras.includes(x)} onChange={() => alternar(x)} /> {x}
              </label>
            ))}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={pcmso} onChange={(e) => setPcmso(e.target.checked)} /> Exames conforme PCMSO
            </label>
            <input className={estiloEntrada} placeholder="Outros (separe por vírgula)" value={outro} onChange={(e) => setOutro(e.target.value)} />
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Quem autorizou">
            <input className={estiloEntrada} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
          </Campo>
          <Campo rotulo="Telefone">
            <input className={estiloEntrada} value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </Campo>
        </div>
        <p className="text-xs text-stone-500">Não precisa agendar: a pessoa vai no dia útil seguinte, das 8h às 11h, com a guia, o RG e a amostra de fezes. Depois de gerar, o botão WhatsApp abre a mensagem pronta.</p>
        <Botao className="w-full">Gerar guia</Botao>
      </form>
    </Modal>
  )
}

// Mensagem pronta para a pessoa (pedido de 08/10): abre o WhatsApp dela e é só apertar Enviar.
const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
// O exame é no dia seguinte ao encaminhamento; a clínica não abre no fim de semana, então pula para segunda.
export function diaDoExame(de: string) {
  let d = addDias(de, 1)
  while ([0, 6].includes(new Date(d + 'T12:00:00').getDay())) d = addDias(d, 1)
  const nome = SEMANA[new Date(d + 'T12:00:00').getDay()]
  return { data: d, texto: d === addDias(de, 1) ? `amanhã, ${nome}, ${dataCurta(d)}` : `na ${nome}, ${dataCurta(d)}` }
}

function linkWhatsApp(p: Funcionario, tipo: TipoExame, responsavel: string, linkGuia?: string | null, sexoResp?: Funcionario['sexo']) {
  const d = p.celular.replace(/\D/g, '')
  if (d.length < 10) return null
  const nomeExame = TIPOS_EXAME.find((t) => t.valor === tipo)!.nome.toLowerCase()
  // Texto que a Ana já manda hoje (enviado pelo Heitor em 08/10); o nome é de quem gera a guia.
  const msg = [
    'Olá, tudo bem?',
    '',
    // Heitor (09/10): sem "me chamo", porque pode ser alguém da casa só renovando o exame.
    `Aqui é ${sexoResp === 'feminino' ? 'a ' : sexoResp === 'masculino' ? 'o ' : ''}${responsavel.split(' ')[0]}, da administração da The Ozzy Burger.`,
    '',
    `Segue a carta de encaminhamento para o exame ${nomeExame}. A clínica funciona das 08h às 11h. É necessário levar uma amostra de fezes e o RG.`,
    '',
    `*Você deve ir fazer o exame ${diaDoExame(hoje()).texto}.*`,
    '',
    'Endereço da clínica:',
    'R. John Harrison, 299 – 1º andar – Lapa, São Paulo – SP, 05074-080.',
    '',
    'Qualquer dúvida, fico à disposição!',
    ...(linkGuia ? ['', `📄 Carta de encaminhamento (abra e mostre na clínica): ${linkGuia}`] : []),
  ].join('\n')
  return `https://wa.me/${d.startsWith('55') && d.length > 11 ? d : '55' + d}?text=${encodeURIComponent(msg)}`
}

const celularBonito = (c: string) => {
  const d = c.replace(/\D/g, '')
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : c
}

function FolhaGuia({
  pessoa, tipo, extras, pcmso, responsavel, telefone, aoFechar,
}: { pessoa: Funcionario; tipo: TipoExame; extras: string[]; pcmso: boolean; responsavel: string; telefone: string; aoFechar: () => void }) {
  const empresa = EMPRESAS[pessoa.unidadeId] ?? EMPRESAS['burger-psd']
  const R = ({ rotulo, children, className = '' }: { rotulo: string; children?: React.ReactNode; className?: string }) => (
    <div className={`border border-black px-1.5 pt-0.5 pb-1 ${className}`}>
      <div className="text-[9px] uppercase">{rotulo}</div>
      <div className="min-h-5 font-serif text-[14px] uppercase">{children}</div>
    </div>
  )
  const Caixa = ({ marcada }: { marcada: boolean }) => (
    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center border border-black text-[12px] leading-none">{marcada ? '✕' : ''}</span>
  )
  const linhas = [...extras]
  while (linhas.length < 4) linhas.push('')
  const { store, avisar, equipe } = useApp()
  const sexoResp = equipe.find((f) => f.nome.trim().toLowerCase() === responsavel.trim().toLowerCase())?.sexo
  const [enviando, setEnviando] = useState(false)
  const [linkPronto, setLinkPronto] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const mensagemErro = (e: unknown) => {
    const m = (e as Error)?.message ?? String(e)
    return /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(m)
      ? 'O portal foi atualizado. Aperte F5 (ou feche e abra de novo) e tente outra vez.'
      : `Não consegui gerar a guia: ${m}`
  }
  const temCelular = pessoa.celular.replace(/\D/g, '').length >= 10
  const nomePdf = `Encaminhamento exame - ${pessoa.nome}.pdf`
  const gerarPdf = () => folhaParaPdf(document.querySelector<HTMLElement>('.folha-impressao .folha')!, nomePdf)
  // Celular (e alguns computadores) deixam anexar o arquivo de verdade pelo menu de compartilhar.
  const podeCompartilhar = typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [new File([''], 'a.pdf', { type: 'application/pdf' })] })

  // Gera o PDF, guarda no cadastro da pessoa e manda o link dele junto da mensagem.
  const mandarLink = async () => {
    const janela = window.open('', '_blank')
    setEnviando(true)
    setErro('')
    setLinkPronto(null)
    try {
      const arquivo = await gerarPdf()
      await store.enviarDocumento({
        funcionarioId: pessoa.id, tipo: 'outro', arquivo,
        observacao: `Guia de encaminhamento para exame ${TIPOS_EXAME.find((t) => t.valor === tipo)!.nome.toLowerCase()}`,
      })
      const url = await store.publicarGuia(pessoa.id, arquivo)
      const link = linkWhatsApp(pessoa, tipo, responsavel, url, sexoResp)!
      if (janela) janela.location.href = link
      // Sempre deixa o link na tela também: celular e app instalado às vezes não abrem a aba nova.
      setLinkPronto(link)
      avisar('Guia salva no cadastro e mensagem aberta no WhatsApp')
    } catch (e) {
      janela?.close()
      setErro(mensagemErro(e))
    } finally {
      setEnviando(false)
    }
  }
  const compartilharPdf = async () => {
    setEnviando(true)
    try {
      const arquivo = await gerarPdf()
      const texto = decodeURIComponent(linkWhatsApp(pessoa, tipo, responsavel, null, sexoResp)!.split('text=')[1])
      await navigator.share({ files: [arquivo], text: texto })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setErro(mensagemErro(e))
    } finally {
      setEnviando(false)
    }
  }
  return (
    <Impressao
      titulo={`Encaminhamento para exame · ${pessoa.nome}`}
      aoFechar={aoFechar}
      acoes={
        <>
          {podeCompartilhar && (
            <Botao variante="secundario" disabled={enviando} onClick={compartilharPdf} className="bg-white/10! text-white! ring-white/30!">
              Compartilhar PDF
            </Botao>
          )}
          {temCelular && (
            <button
              disabled={enviando}
              onClick={mandarLink}
              className="inline-flex items-center rounded-xl bg-[#25D366] px-3 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
            >
              {enviando ? 'Gerando…' : 'WhatsApp'}
            </button>
          )}
        </>
      }
    >
      {erro && <p className="nao-imprimir mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-300">{erro}</p>}
      {linkPronto && (
        <p className="nao-imprimir mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-900 ring-1 ring-green-300">
          Guia pronta. Se o WhatsApp não abriu sozinho,{' '}
          <a href={linkPronto} target="_blank" rel="noreferrer" className="font-semibold underline">toque aqui para abrir a conversa</a>.
        </p>
      )}
      <div className="text-[11px] leading-tight">
        <div className="grid grid-cols-[5fr_7fr] border border-black">
          <div className="flex items-center border-r border-black p-2">
            <img src={logoSouza} alt="Souza Segurança do Trabalho" className="h-12" />
          </div>
          <div className="flex items-center justify-center p-2 text-center text-[16px] font-bold text-[#1f3f8f]">GUIA DE ENCAMINHAMENTO PARA EXAMES</div>
        </div>
        <div className="grid grid-cols-[5fr_7fr] border-x border-black">
          <div className="flex flex-col justify-center gap-2 border-r border-black p-2 text-[13px]">
            <div><b>CNPJ:</b> {empresa.cnpj.replace(/\D/g, '')}</div>
            <div className="font-bold uppercase">Nome da empresa: {empresa.razaoSocial}</div>
          </div>
          <div>
            <div className="p-1.5 text-center text-[10px] font-bold text-[#1f3f8f]">
              HORÁRIO DE ATENDIMENTO: 8:00H às 16h40 (2ª a 6ª Feira)<br />
              RUA JOHN HARRISON, Nº 299 – 1º ANDAR – SALA 109<br />
              Telefone: (11) 3151-2054; (11) 3237-0857; (11) 9.6129-9084<br />
              (Metrôs próximos: Lapa, Linha 7 Rubi)
            </div>
            <div className="grid grid-cols-[2fr_1fr]">
              <R rotulo="Nome do colaborador">{pessoa.nome}</R>
              <R rotulo="Data de nascimento">{pessoa.dataNascimento ? br(pessoa.dataNascimento) : ''}</R>
            </div>
            <div className="grid grid-cols-[3fr_2fr_2fr]">
              <R rotulo="Função">{pessoa.cargo}</R>
              <R rotulo="Número RG">{pessoa.rg ?? ''}</R>
              <R rotulo="Número do CPF">{pessoa.cpf ?? ''}</R>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_4fr] border border-black bg-stone-100 text-center text-[9px] uppercase">
          <div className="border-r border-black py-0.5">Data de admissão</div>
          <div className="py-0.5">Tipo de exame clínico a realizar</div>
        </div>
        <div className="grid grid-cols-[1fr_4fr] border-x border-b border-black">
          <div className="flex items-center justify-center border-r border-black font-serif text-[14px]">{br(pessoa.dataAdmissao)}</div>
          <div className="grid grid-cols-5">
            {TIPOS_EXAME.map((t) => (
              <div key={t.valor} className="flex flex-col items-center gap-1 border-r border-black py-2 text-[9px] uppercase last:border-r-0">
                <Caixa marcada={tipo === t.valor} />
                {t.nome}
              </div>
            ))}
          </div>
        </div>
        <div className="border-x border-b border-black bg-stone-100 px-1.5 py-0.5 text-[9px] uppercase">Tipo de exame(s) complementar(es) a realizar</div>
        <div className="grid grid-cols-2 border-x border-b border-black">
          {linhas.map((x, i) => (
            <div key={i} className="flex items-center gap-2 border-b border-black px-2 py-1.5 font-serif text-[13px] odd:border-r">
              <Caixa marcada={!!x} /> {x}
            </div>
          ))}
          <div className="col-span-2 flex items-center gap-2 px-2 py-1.5 font-bold text-red-600">
            <Caixa marcada={pcmso} /> EXAMES CONFORME PCMSO
          </div>
        </div>
        <div className="grid grid-cols-2">
          <R rotulo="Nome da pessoa que autorizou os exames">{responsavel}</R>
          <R rotulo="Telefone da pessoa que autorizou os exames">{celularBonito(telefone)}</R>
        </div>
        <div className="grid grid-cols-[1fr_2fr_1fr] border-x border-b border-black">
          <div className="flex flex-col items-center justify-center border-r border-black p-2 text-center text-[10px]">
            Status da guia
            <b className="mt-1 text-red-600">SISTEMA PROCLINIC</b>
          </div>
          <div className="flex flex-col justify-between border-r border-black p-1.5 text-center text-[10px]">
            Assinatura do responsável pelo encaminhamento
            <div className="mt-10 border-t border-black pt-0.5 font-bold uppercase">{responsavel}</div>
          </div>
          <div className="flex flex-col items-center justify-center p-1.5 text-center text-[10px]">
            Data de encaminhamento
            <b className="mt-1 font-serif text-[14px]">{br(hoje())}</b>
          </div>
        </div>
        <ul className="mt-4 list-['➢_'] space-y-2 pl-5 text-[10.5px] text-red-600">
          <li>
            Observações: para evitar problemas trabalhistas, aconselhamos que ao preencher esta guia seja consultado o PCMSO para verificar a
            necessidade de exames complementares, como audiometria, raio X, laboratório etc. Tais exames, sempre que necessários, deverão ser
            mencionados nos quadros acima. Além disso, é obrigatória a apresentação de documento de identidade (CPF).
          </li>
          <li>Selecionando "Exames conforme PCMSO", a clínica faz os exames que o PCMSO da empresa exige.</li>
          <li>Exames complementares são feitos somente de manhã, das 8h às 12h. Se tiver exame de sangue, é preciso jejum de no mínimo 8h.</li>
        </ul>
      </div>
    </Impressao>
  )
}
