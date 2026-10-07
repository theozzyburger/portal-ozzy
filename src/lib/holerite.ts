// Leitura dos holerites (PDF) que a contabilidade manda: separa por pessoa e tira os valores principais.
// Os nomes das rubricas mudam de escritório para escritório; aqui vão as mais comuns, e a gestão
// confere tudo antes de aplicar. Carregado só quando alguém importa um holerite (as bibliotecas são grandes).
import type { Funcionario, Salario } from './types'

export interface ValoresHolerite {
  salario?: number
  descFaltas?: number
  descAtrasos?: number
  inss?: number
  descVt?: number
  descAdiantamento?: number
  liquido?: number
}

export interface PaginaHolerite {
  pagina: number // começa em 1
  texto: string
  funcionarioId: string | null
  valores: ValoresHolerite
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
const MOEDA = /\d{1,3}(?:\.\d{3})*,\d{2}/g
const numero = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'))

// Rubrica → campo. A ordem importa: a primeira regra que bate leva a linha.
const REGRAS: [RegExp, keyof ValoresHolerite][] = [
  [/LIQUIDO/, 'liquido'],
  [/ADIANT/, 'descAdiantamento'],
  [/ATRASO/, 'descAtrasos'],
  [/FALTA/, 'descFaltas'],
  [/^\s*\d*\s*-?\s*I\.?N\.?S\.?S\b|\bINSS\b/, 'inss'],
  [/VALE[\s-]*TRANSP|\bV\.?\s?T\.?\b/, 'descVt'],
  [/SALARIO|HORAS NORMAIS|DIAS NORMAIS|SALARIO BASE/, 'salario'],
]
// Linhas de resumo que não são rubrica (bases de cálculo, totais).
const IGNORAR = /BASE\s*(DE\s*)?CALC|\bBC\b|TOTAL|SAL\.? CONTR|FGTS|FAIXA|IRRF|MES DE|COMPETENCIA/

export function lerValores(texto: string): ValoresHolerite {
  const v: ValoresHolerite = {}
  for (const linhaOriginal of texto.split('\n')) {
    const linha = semAcento(linhaOriginal)
    const valores = linha.match(MOEDA)
    if (!valores) continue
    const regra = REGRAS.find(([re]) => re.test(linha))
    if (!regra) continue
    const campo = regra[1]
    if (campo !== 'liquido' && IGNORAR.test(linha)) continue
    // Colunas: código · descrição · referência · vencimentos · descontos. O valor é o último número da linha.
    const valor = numero(valores[valores.length - 1])
    // Rubricas repetidas somam (ex.: "Faltas" e "DSR s/ faltas"); o líquido vale o último encontrado e o
    // salário, o primeiro (o rodapé costuma repetir "Salário base").
    if (campo === 'salario') v.salario ??= valor
    else v[campo] = campo === 'liquido' ? valor : Math.round(((v[campo] ?? 0) + valor) * 100) / 100
  }
  return v
}

// Quem é a pessoa da página: pelo CPF, se houver; senão pelo nome completo.
export function acharPessoa(texto: string, equipe: Funcionario[]): string | null {
  const digitos = texto.replace(/\D/g, '')
  const porCpf = equipe.find((f) => f.cpf && digitos.includes(f.cpf))
  if (porCpf) return porCpf.id
  const t = semAcento(texto).replace(/\s+/g, ' ')
  const porNome = equipe
    .filter((f) => t.includes(semAcento(f.nome).replace(/\s+/g, ' ')))
    .sort((a, b) => b.nome.length - a.nome.length)[0]
  return porNome?.id ?? null
}

let pdfjsPronto: Promise<typeof import('pdfjs-dist')> | null = null
async function pdfjs() {
  pdfjsPronto ??= (async () => {
    const lib = await import('pdfjs-dist')
    const Trabalhador = (await import('pdfjs-dist/build/pdf.worker.min.mjs?worker&inline')).default
    lib.GlobalWorkerOptions.workerPort = new Trabalhador()
    return lib
  })()
  return pdfjsPronto
}

// Texto de cada página, montando as linhas pela altura de cada pedaço de texto.
export async function textoDasPaginas(arquivo: File | Blob): Promise<string[]> {
  const lib = await pdfjs()
  const doc = await lib.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise
  const paginas: string[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const conteudo = await (await doc.getPage(n)).getTextContent()
    const linhas = new Map<number, { x: number; s: string }[]>()
    for (const item of conteudo.items as { str: string; transform: number[] }[]) {
      if (!item.str?.trim()) continue
      const y = Math.round(item.transform[5] / 3) * 3
      const linha = linhas.get(y) ?? []
      linha.push({ x: item.transform[4], s: item.str })
      linhas.set(y, linha)
    }
    paginas.push(
      [...linhas.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, partes]) => partes.sort((a, b) => a.x - b.x).map((p) => p.s).join(' '))
        .join('\n'),
    )
  }
  return paginas
}

export async function lerHolerites(arquivo: File, equipe: Funcionario[]): Promise<PaginaHolerite[]> {
  const textos = await textoDasPaginas(arquivo)
  return textos.map((texto, i) => ({ pagina: i + 1, texto, funcionarioId: acharPessoa(texto, equipe), valores: lerValores(texto) }))
}

// PDF só com as páginas de uma pessoa, para ela não ver o holerite dos outros.
export async function separarPaginas(arquivo: File, paginas: number[]): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib')
  const origem = await PDFDocument.load(await arquivo.arrayBuffer())
  const novo = await PDFDocument.create()
  const copiadas = await novo.copyPages(origem, paginas.map((p) => p - 1))
  copiadas.forEach((p) => novo.addPage(p))
  return new Blob([(await novo.save()) as BlobPart], { type: 'application/pdf' })
}

// Aplica no lançamento só o que foi encontrado no PDF; o resto (caixinha, bônus) continua como estava.
export function aplicarValores(s: Salario, v: ValoresHolerite): Salario {
  const r = { ...s }
  for (const campo of ['salario', 'descFaltas', 'descAtrasos', 'inss', 'descVt', 'descAdiantamento'] as const) {
    if (v[campo] !== undefined) r[campo] = v[campo]!
  }
  return r
}

export const NOMES_VALORES: Record<keyof ValoresHolerite, string> = {
  salario: 'Salário', descFaltas: 'Faltas', descAtrasos: 'Atrasos', inss: 'INSS', descVt: 'VT', descAdiantamento: 'Adiantamento', liquido: 'Líquido',
}
