// Arquivo de pagamento do Itaú (SISPAG, CNAB 240) com Pix em lote, para os salários e as diárias de freelancer.
// Layout: manual "SISPAG - Sistema de Contas a Pagar Itaú", CNAB versão 085 (outubro/2020),
// https://download.itau.com.br/bankline/sispag_cnab.pdf
//
// A lista de pagamentos (PagamentoBanco[]) é a mesma coisa que a API do Itaú vai receber quando estiver liberada:
// quem gera o arquivo e quem for chamar a API partem de `pagamentosDe…`, e só a entrega muda.
import type { ContaPagamento } from './types'

export interface PagamentoBanco {
  nome: string
  cpf: string // 11 dígitos, do cadastro
  chavePix: string
  valor: number // em reais
  seuNumero: string // identificação nossa, volta no retorno do banco
}

export type TipoRemessa = 'salario' | 'adiantamento' | 'freelancer'

// Nota 4 do manual: tipo de pagamento do lote. Diária de freelancer não é salário (não tem vínculo).
const TIPO_PAGAMENTO: Record<TipoRemessa, string> = { salario: '30', adiantamento: '30', freelancer: '98' }
const FORMA_PIX = '45' // Nota 5: 45 = PIX TRANSFERÊNCIA
const CAMARA_PIX = '009' // posições 18/20 do segmento A no Pix
const TRANSFERENCIA_POR_CHAVE = '04' // Nota 36: pagamento por chave Pix (pede o segmento B)

// Nota 37: tipo da chave no segmento B. CONFERIR com o gerente do Itaú antes do primeiro envio de verdade.
export const TIPO_CHAVE = { telefone: '01', email: '02', cpfCnpj: '03', aleatoria: '04' } as const

// Que tipo de chave é a que a pessoa cadastrou.
export function tipoDaChave(chave: string): keyof typeof TIPO_CHAVE | null {
  const t = chave.trim()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return 'aleatoria'
  if (t.includes('@')) return 'email'
  if (/[^\d\s()+.-]/.test(t)) return null
  const d = t.replace(/\D/g, '')
  // Celular: 11 dígitos (DDD + 9), com ou sem o 55 na frente.
  // Telefone: DDD + 8 ou 9 dígitos, com ou sem o 55 na frente.
  if (d.length === 10 || d.length === 11) return d.length === 11 && d[2] !== '9' ? 'cpfCnpj' : 'telefone'
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return 'telefone'
  if (d.length === 11 || d.length === 14) return 'cpfCnpj'
  return null
}

// Nota 40: a chave vai como o banco espera. Telefone com +55 e DDD; CPF/CNPJ só os dígitos; e-mail e
// aleatória do jeito que estão.
export function chaveFormatada(chave: string): string {
  const tipo = tipoDaChave(chave)
  const d = chave.replace(/\D/g, '')
  if (tipo === 'telefone') return '+55' + (d.length > 11 && d.startsWith('55') ? d.slice(2) : d)
  if (tipo === 'cpfCnpj') return d
  return chave.trim()
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
// O arquivo é texto puro, maiúsculas, sem acento e sem caractere estranho.
const texto = (v: string | null | undefined, n: number) =>
  semAcento(v ?? '').toUpperCase().replace(/[^A-Z0-9 .,\-/@+_]/g, ' ').slice(0, n).padEnd(n, ' ')
// A chave vai como foi cadastrada: e-mail e chave aleatória não podem virar maiúsculas.
const comoEsta = (v: string, n: number) => semAcento(v).replace(/[^\x20-\x7e]/g, ' ').slice(0, n).padEnd(n, ' ')
const numerico = (v: string | number, n: number) => String(v).replace(/\D/g, '').slice(-n).padStart(n, '0')
const centavos = (reais: number, n: number) => numerico(String(Math.round(reais * 100)), n)
const brancos = (n: number) => ' '.repeat(n)
const zeros = (n: number) => '0'.repeat(n)
const ddmmaaaa = (data: string) => data.slice(8, 10) + data.slice(5, 7) + data.slice(0, 4)

export interface ProblemaPagamento {
  nome: string
  motivo: string
}

// Quem não pode entrar no arquivo (e por quê), para a gestão resolver antes de subir no banco.
export function conferir(pagamentos: PagamentoBanco[]): ProblemaPagamento[] {
  const problemas: ProblemaPagamento[] = []
  for (const p of pagamentos) {
    const motivos: string[] = []
    if (!p.chavePix?.trim()) motivos.push('falta a chave Pix')
    else if (!tipoDaChave(p.chavePix)) motivos.push(`a chave "${p.chavePix}" não parece celular, e-mail, CPF nem chave aleatória`)
    // O banco pede o CPF do favorecido no Pix em lote.
    if (p.cpf?.replace(/\D/g, '').length !== 11) motivos.push('falta o CPF')
    if (!(p.valor > 0)) motivos.push('o valor está zerado')
    if (motivos.length) problemas.push({ nome: p.nome, motivo: motivos.join(' e ') })
  }
  return problemas
}

function headerArquivo(c: ContaPagamento, agora: Date, sequencial: number): string {
  void sequencial // o manual pede zeros nas posições 158/166; o nosso número fica no nome do arquivo
  const hora = [agora.getHours(), agora.getMinutes(), agora.getSeconds()].map((n) => String(n).padStart(2, '0')).join('')
  const data = [agora.getDate(), agora.getMonth() + 1].map((n) => String(n).padStart(2, '0')).join('') + agora.getFullYear()
  return (
    numerico(c.banco, 3) + '0000' + '0' + brancos(6) + '080' +
    '2' + numerico(c.empresaCnpj, 14) + brancos(20) +
    numerico(c.agencia, 5) + brancos(1) + numerico(c.conta, 12) + brancos(1) + numerico(c.dac, 1) +
    texto(c.empresaNome, 30) + texto('ITAU', 30) + brancos(10) +
    '1' + data + hora + zeros(9) + zeros(5) + brancos(69)
  )
}

function headerLote(c: ContaPagamento, tipo: TipoRemessa, lote: number, historico: string): string {
  return (
    numerico(c.banco, 3) + numerico(lote, 4) + '1' + 'C' + TIPO_PAGAMENTO[tipo] + FORMA_PIX + '040' + brancos(1) +
    '2' + numerico(c.empresaCnpj, 14) + brancos(4) + brancos(16) +
    numerico(c.agencia, 5) + brancos(1) + numerico(c.conta, 12) + brancos(1) + numerico(c.dac, 1) +
    texto(c.empresaNome, 30) + brancos(30) + texto(historico, 10) +
    texto(c.endereco, 30) + numerico(c.numero ?? '0', 5) + brancos(15) +
    texto(c.cidade, 20) + numerico(c.cep ?? '0', 8) + texto(c.estado, 2) + brancos(8) + brancos(10)
  )
}

function segmentoA(c: ContaPagamento, lote: number, registro: number, p: PagamentoBanco, dataPagto: string): string {
  return (
    numerico(c.banco, 3) + numerico(lote, 4) + '3' + numerico(registro, 5) + 'A' +
    '000' + CAMARA_PIX + zeros(3) + zeros(20) + // no Pix por chave o banco e a conta do favorecido vão zerados
    texto(p.nome, 30) + texto(p.seuNumero, 20) + ddmmaaaa(dataPagto) + texto('REA', 3) +
    zeros(8) + TRANSFERENCIA_POR_CHAVE + zeros(5) + centavos(p.valor, 15) +
    brancos(15) + brancos(5) + zeros(8) + zeros(15) +
    texto('', 20) + zeros(6) + numerico(p.cpf, 14) + brancos(2) + brancos(5) + brancos(5) + '0' + brancos(10)
  )
}

function segmentoB(c: ContaPagamento, lote: number, registro: number, p: PagamentoBanco): string {
  const tipo = tipoDaChave(p.chavePix)
  return (
    numerico(c.banco, 3) + numerico(lote, 4) + '3' + numerico(registro, 5) + 'B' +
    (tipo ? TIPO_CHAVE[tipo] : '  ') + brancos(1) +
    '1' + numerico(p.cpf, 14) + brancos(30) + brancos(65) +
    comoEsta(chaveFormatada(p.chavePix), 100) + brancos(3) + brancos(10)
  )
}

function trailerLote(c: ContaPagamento, lote: number, registros: number, total: number): string {
  return numerico(c.banco, 3) + numerico(lote, 4) + '5' + brancos(9) + numerico(registros, 6) + centavos(total, 18) + zeros(18) + brancos(171) + brancos(10)
}

function trailerArquivo(c: ContaPagamento, lotes: number, registros: number): string {
  return numerico(c.banco, 3) + '9999' + '9' + brancos(9) + numerico(lotes, 6) + numerico(registros, 6) + brancos(211)
}

export interface Remessa {
  conteudo: string
  nomeArquivo: string
  quantidade: number
  valorTotal: number
}

// O arquivo inteiro, com um lote só (o banco pede Pix em arquivo separado das outras formas de pagamento).
export function montarRemessa({ conta, tipo, pagamentos, dataPagamento, historico, sequencial, agora = new Date() }: {
  conta: ContaPagamento
  tipo: TipoRemessa
  pagamentos: PagamentoBanco[]
  dataPagamento: string
  historico: string
  sequencial: number // nosso número do arquivo, que não repete
  agora?: Date
}): Remessa {
  const validos = pagamentos.filter((p) => !conferir([p]).length)
  if (!validos.length) throw new Error('Nenhum pagamento pronto para o arquivo.')
  const linhas = [headerArquivo(conta, agora, sequencial), headerLote(conta, tipo, 1, historico)]
  validos.forEach((p, i) => {
    linhas.push(segmentoA(conta, 1, i * 2 + 1, p, dataPagamento))
    linhas.push(segmentoB(conta, 1, i * 2 + 2, p))
  })
  const total = validos.reduce((t, p) => t + p.valor, 0)
  // O trailer do lote conta o header, os detalhes e ele mesmo.
  linhas.push(trailerLote(conta, 1, validos.length * 2 + 2, total))
  linhas.push(trailerArquivo(conta, 1, linhas.length + 1))
  const erradas = linhas.filter((l) => l.length !== 240)
  if (erradas.length) throw new Error(`Linha do arquivo com tamanho errado (${erradas[0].length} em vez de 240).`)
  return {
    conteudo: linhas.join('\r\n') + '\r\n',
    nomeArquivo: `pix-${tipo}-${dataPagamento}-${String(sequencial).padStart(4, '0')}.txt`,
    quantidade: validos.length,
    valorTotal: Math.round(total * 100) / 100,
  }
}

export function baixarRemessa(r: Remessa) {
  const url = URL.createObjectURL(new Blob([r.conteudo], { type: 'text/plain;charset=us-ascii' }))
  const a = document.createElement('a')
  a.href = url
  a.download = r.nomeArquivo
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
