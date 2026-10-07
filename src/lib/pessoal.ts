import { addDias, inicioDaSemana } from './datas'
import type { Desligamento, Documento, Funcionario } from './types'

const diasEntre = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)

// ---------- Aniversário ----------

// Aniversário deste ano (29/02 cai em 28/02 nos anos que não são bissextos).
export function aniversarioNoAno(nascimento: string, ano: number) {
  const md = nascimento.slice(5)
  const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0
  return `${ano}-${md === '02-29' && !bissexto ? '02-28' : md}`
}

// 'hoje' no dia; 'semana' de segunda a domingo da semana do aniversário.
export function situacaoAniversario(nascimento: string | null | undefined, hoje: string): 'hoje' | 'semana' | null {
  if (!nascimento) return null
  const dia = aniversarioNoAno(nascimento, Number(hoje.slice(0, 4)))
  if (dia === hoje) return 'hoje'
  return inicioDaSemana(dia) === inicioDaSemana(hoje) ? 'semana' : null
}

export const idadeEm = (nascimento: string, data: string) =>
  Number(data.slice(0, 4)) - Number(nascimento.slice(0, 4)) - (data.slice(5) < nascimento.slice(5) ? 1 : 0)

// Ativos que fazem aniversário nesta semana (segunda a domingo), em ordem de data.
export function aniversariantesDaSemana(equipe: Funcionario[], hoje: string) {
  return equipe
    .filter((f) => f.status === 'ativo' && situacaoAniversario(f.dataNascimento, hoje))
    .map((f) => ({ pessoa: f, dia: aniversarioNoAno(f.dataNascimento!, Number(hoje.slice(0, 4))) }))
    .sort((a, b) => a.dia.localeCompare(b.dia))
}

// ---------- Contrato de experiência ----------

export const EXPERIENCIA_PADRAO: [number, number] = [10, 80]
// Aviso para a gestão quando faltam até tantos dias para um vencimento.
export const AVISO_EXPERIENCIA_DIAS = 7

export interface Experiencia {
  vence1: string
  vence2: string | null
  // Dia do contrato contando a admissão como dia 1.
  dia: number
  total: number
  fase: 'periodo1' | 'periodo2' | 'encerrado'
  // Próximo vencimento e quantos dias faltam (0 = vence hoje).
  proximo: string | null
  faltam: number | null
}

// A admissão conta como o 1º dia: 10 dias a partir de 01/10 vencem em 10/10.
export function experienciaDe(f: Pick<Funcionario, 'dataAdmissao' | 'experienciaDias1' | 'experienciaDias2'>, hoje: string): Experiencia | null {
  if (!f.experienciaDias1 || !f.dataAdmissao) return null
  const d2 = f.experienciaDias2 ?? 0
  const vence1 = addDias(f.dataAdmissao, f.experienciaDias1 - 1)
  const vence2 = d2 > 0 ? addDias(vence1, d2) : null
  const fim = vence2 ?? vence1
  const fase = hoje <= vence1 ? 'periodo1' : hoje <= fim ? 'periodo2' : 'encerrado'
  const proximo = fase === 'periodo1' ? vence1 : fase === 'periodo2' ? vence2 : null
  return {
    vence1, vence2, fase, proximo,
    dia: diasEntre(f.dataAdmissao, hoje) + 1,
    total: f.experienciaDias1 + d2,
    faltam: proximo ? diasEntre(hoje, proximo) : null,
  }
}

// Admitido há menos de 90 dias (ou com admissão futura): o cadastro pergunta pelo contrato de experiência.
export const recemAdmitido = (admissao: string | undefined, hoje: string) => !!admissao && diasEntre(admissao, hoje) < 90

export function alertasExperiencia(equipe: Funcionario[], hoje: string) {
  return equipe
    .filter((f) => f.status === 'ativo')
    .map((f) => ({ pessoa: f, exp: experienciaDe(f, hoje) }))
    .filter((x): x is { pessoa: Funcionario; exp: Experiencia } => !!x.exp && x.exp.faltam !== null && x.exp.faltam <= AVISO_EXPERIENCIA_DIAS)
    .sort((a, b) => a.exp.faltam! - b.exp.faltam!)
}

// ---------- Afastamento (INSS) ----------

// CLT/INSS: a empresa paga os primeiros 15 dias de afastamento. Atestados que somam mais de 15 dias
// dentro de 60 dias (pela mesma doença) vão para o INSS a partir do 16º dia.
export const JANELA_AFASTAMENTO = 60
export const LIMITE_AFASTAMENTO = 15

export function diasDeAtestado(atestados: Documento[], hoje: string) {
  const desde = addDias(hoje, -(JANELA_AFASTAMENTO - 1))
  let dias = 0
  for (const a of atestados) {
    if (a.tipo !== 'atestado' || !a.inicio) continue
    const ini = a.inicio < desde ? desde : a.inicio
    const fim = a.fim && a.fim >= a.inicio ? a.fim : a.inicio
    if (fim < desde) continue
    dias += diasEntre(ini, fim) + 1
  }
  return dias
}

export function alertasAfastamento(equipe: Funcionario[], docs: Documento[], hoje: string) {
  return equipe
    .filter((f) => f.status === 'ativo')
    .map((f) => ({ pessoa: f, dias: diasDeAtestado(docs.filter((d) => d.funcionarioId === f.id), hoje) }))
    .filter((x) => x.dias > LIMITE_AFASTAMENTO)
    .sort((a, b) => b.dias - a.dias)
}

// ---------- Desligamento ----------

// Prazo legal para pagar a rescisão: 10 dias corridos após o término do contrato (CLT art. 477, § 6º).
export const prazoRescisao = (d: Pick<Desligamento, 'data'>) => addDias(d.data, 10)

export interface EtapaDesligamento {
  chave: string
  nome: string
  detalhe?: string
}

// Lista padrão (a validar com o escritório). Algumas etapas só aparecem quando se aplicam.
export function etapasDesligamento(d: Pick<Desligamento, 'data' | 'tipo'>, pessoa: Pick<Funcionario, 'sexo'>): EtapaDesligamento[] {
  const prazo = prazoRescisao(d).split('-').reverse().join('/')
  const seguro = d.tipo === 'sem_justa_causa' || d.tipo === 'acordo'
  const lista: (EtapaDesligamento | false)[] = [
    { chave: 'aviso', nome: d.tipo === 'pedido' ? 'Carta de pedido de demissão assinada' : 'Aviso de desligamento assinado', detalhe: 'Com a data e se o aviso prévio é trabalhado ou indenizado.' },
    pessoa.sexo === 'feminino' && { chave: 'gravidez', nome: 'Termos de exame de gravidez (oferta ou recusa)', detalhe: 'Gerados pelo portal; anexar assinado no cadastro.' },
    { chave: 'aso', nome: 'Exame demissional (ASO)', detalhe: 'Dispensado se o último exame for de menos de 90 dias.' },
    { chave: 'uniforme', nome: 'Devolução de uniformes e EPIs' },
    { chave: 'chaves', nome: 'Devolução de chaves, armário e crachá' },
    { chave: 'acessos', nome: 'Tirar acessos', detalhe: 'Ponto (Control iD), grupos de WhatsApp, PDV e sistemas.' },
    { chave: 'pendencias', nome: 'Fechar caixinha, freelas, faltas e descontos do mês' },
    { chave: 'contabilidade', nome: 'Enviar para a contabilidade calcular a rescisão' },
    { chave: 'pagamento', nome: `Pagar a rescisão até ${prazo}`, detalhe: 'Prazo de 10 dias corridos depois do último dia (CLT art. 477).' },
    { chave: 'trct', nome: 'TRCT assinado e anexado no cadastro' },
    { chave: 'ctps', nome: 'Baixa na carteira digital / eSocial', detalhe: 'Feita pela contabilidade.' },
    seguro && { chave: 'guias', nome: 'Entregar guias de FGTS e seguro-desemprego' },
  ]
  return lista.filter((x): x is EtapaDesligamento => !!x)
}

export function progressoDesligamento(d: Desligamento, pessoa: Pick<Funcionario, 'sexo'>) {
  const etapas = etapasDesligamento(d, pessoa)
  const feitas = etapas.filter((e) => d.itens[e.chave]).length
  return { feitas, total: etapas.length, pagamentoFeito: !!d.itens.pagamento }
}
