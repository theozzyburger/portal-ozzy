// Leitura dos holerites (PDF) que a contabilidade manda: separa por pessoa e tira os valores principais.
// Os nomes das rubricas mudam de escritório para escritório; aqui vão as mais comuns, e a gestão
// confere tudo antes de aplicar. Carregado só quando alguém importa um holerite (as bibliotecas são grandes).
import type { Funcionario, RubricaHolerite, Salario } from './types'

export interface ValoresHolerite {
  salario?: number
  descFaltas?: number
  descAtrasos?: number
  inss?: number
  descVt?: number
  descAdiantamento?: number
  outrosCreditos?: number
  outrosDescontos?: number
  liquido?: number
}

export interface PaginaHolerite {
  pagina: number // começa em 1
  texto: string
  nome: string | null // como está no holerite
  mes: string | null // AAAA-MM da referência
  funcionarioId: string | null
  valores: ValoresHolerite
  rubricas: RubricaHolerite[] // as que entram em "outros"
}

interface Parte { x: number; s: string }
interface Linha { texto: string; partes: Parte[] }

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
const MOEDA = /\d{1,3}(?:\.\d{3})*,\d{2}/g
const EH_MOEDA = /^\d{1,3}(?:\.\d{3})*,\d{2}$/
const numero = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'))
const centavos = (n: number) => Math.round(n * 100) / 100

// Rubrica de desconto → campo. A primeira regra que bate leva a linha; o que não bate vira "outros descontos".
const DESCONTOS: [RegExp, keyof ValoresHolerite][] = [
  [/ADIANT/, 'descAdiantamento'],
  [/ATRASO/, 'descAtrasos'],
  [/FALTA/, 'descFaltas'],
  [/\bI\.?N\.?S\.?S\b/, 'inss'],
  [/VALE[\s-]*TRANSP|\bV\.?\s?T\.?\b/, 'descVt'],
]
// Crédito que é o salário; os demais (adicional noturno, auxílio uniforme…) viram "outros créditos".
const SALARIO = /^(SALARIO|SALARIO (BASE|MENSAL|HORA)|HORAS NORMAIS|DIAS NORMAIS|DIAS TRABALHADOS)$/

// Formato sem cabeçalho de colunas: só pelo nome da rubrica.
const REGRAS_TEXTO: [RegExp, keyof ValoresHolerite][] = [[/LIQUIDO/, 'liquido'], ...DESCONTOS, [/SALARIO|HORAS NORMAIS|DIAS NORMAIS/, 'salario']]
const IGNORAR = /BASE\s*(DE\s*)?CALC|\bBC\b|TOTAL|SAL\.? CONTR|FGTS|FAIXA|IRRF|MES DE|COMPETENCIA/

const somar = (v: ValoresHolerite, campo: keyof ValoresHolerite, valor: number) => {
  // Rubricas repetidas somam (ex.: "Faltas" e "DSR s/ faltas"); o salário vale o primeiro (o rodapé repete "Salário base").
  if (campo === 'salario') v.salario ??= valor
  else if (campo === 'liquido') v.liquido = valor
  else v[campo] = centavos((v[campo] ?? 0) + valor)
}

export function lerValores(texto: string): ValoresHolerite {
  const v: ValoresHolerite = {}
  for (const linhaOriginal of texto.split('\n')) {
    const linha = semAcento(linhaOriginal)
    const valores = linha.match(MOEDA)
    if (!valores) continue
    const regra = REGRAS_TEXTO.find(([re]) => re.test(linha))
    if (!regra || (regra[1] !== 'liquido' && IGNORAR.test(linha))) continue
    // Colunas: código · descrição · referência · vencimentos · descontos. O valor é o último número da linha.
    somar(v, regra[1], numero(valores[valores.length - 1]))
  }
  return v
}

// Lê a tabela de rubricas usando a posição das colunas "Vencimentos" e "Descontos": assim "Vale transporte"
// pago (crédito) não se confunde com o desconto do VT. Sem cabeçalho, cai na leitura só pelo texto.
function lerTabela(linhas: Linha[]): { valores: ValoresHolerite; rubricas: RubricaHolerite[] } {
  const v: ValoresHolerite = {}
  const rubricas: RubricaHolerite[] = []
  const iCab = linhas.findIndex((l) => {
    const t = semAcento(l.texto)
    return /DESCONTOS/.test(t) && /VENCIMENTOS|PROVENTOS/.test(t) && !/TOTAL/.test(t)
  })
  const liquido = linhas.find((l) => /LIQUIDO/.test(semAcento(l.texto)) && l.texto.match(MOEDA))
  if (liquido) v.liquido = numero(liquido.texto.match(MOEDA)!.pop()!)
  if (iCab < 0) return { valores: { ...lerValores(linhas.map((l) => l.texto).join('\n')), ...v }, rubricas }

  const xDe = (re: RegExp) => linhas[iCab].partes.find((p) => re.test(semAcento(p.s)))!.x
  const xVenc = xDe(/VENCIMENTOS|PROVENTOS/)
  const xDesc = xDe(/DESCONTOS/)
  for (const l of linhas.slice(iCab + 1)) {
    const t = semAcento(l.texto)
    if (/TOTAL|LIQUIDO/.test(t)) break
    const ultimo = [...l.partes].reverse().find((p) => EH_MOEDA.test(p.s.trim()))
    if (!ultimo) continue
    const valor = numero(ultimo.s.trim())
    const desconto = Math.abs(ultimo.x - xDesc) < Math.abs(ultimo.x - xVenc)
    // Descrição: sem o código do começo e sem os números do fim (referência e valor).
    const descricao = l.texto.replace(/^\s*\d+\s+/, '').replace(/(\s+(\d[\d.]*,\d+|\d+:\d+))+\s*$/, '').trim()
    const d = semAcento(descricao)
    if (desconto) {
      const regra = DESCONTOS.find(([re]) => re.test(d))
      if (regra) somar(v, regra[1], valor)
      else {
        somar(v, 'outrosDescontos', valor)
        rubricas.push({ descricao, valor, tipo: 'desconto' })
      }
    } else if (SALARIO.test(d) && v.salario === undefined) {
      v.salario = valor
    } else {
      somar(v, 'outrosCreditos', valor)
      rubricas.push({ descricao, valor, tipo: 'credito' })
    }
  }
  return { valores: v, rubricas }
}

// Uma página pode ter mais de um recibo (cada um começa com o mesmo cabeçalho): 2 vias iguais, que contam uma
// vez só, ou folhas de continuação quando as rubricas não cabem numa folha, que somam.
function recibos(linhas: Linha[]): Linha[][] {
  const blocos: Linha[][] = []
  for (const l of linhas) {
    if (!blocos.length || l.texto === linhas[0].texto) blocos.push([])
    blocos[blocos.length - 1].push(l)
  }
  const vistos = new Set<string>()
  return blocos.filter((b) => {
    const chave = b.map((l) => l.texto).join('\n')
    return !vistos.has(chave) && vistos.add(chave)
  })
}

// Junta os valores de mais de uma folha: soma descontos e outros, salário da primeira, líquido da última que tem.
export function juntarValores(a: ValoresHolerite, b: ValoresHolerite): ValoresHolerite {
  const r = { ...a }
  for (const [k, v] of Object.entries(b) as [keyof ValoresHolerite, number][]) {
    if (k === 'liquido') r.liquido = v
    else if (k === 'salario') r.salario ??= v
    else r[k] = centavos((r[k] ?? 0) + v)
  }
  return r
}

// Nome na linha logo abaixo do cabeçalho "Código Nome …": tira o código da frente e o que vem depois (CBO, números).
function nomeNoHolerite(linhas: Linha[]): string | null {
  const i = linhas.findIndex((l) => /\bNOME\b/.test(semAcento(l.texto)))
  const prox = i >= 0 ? linhas[i + 1]?.texto : null
  const m = prox?.replace(/^\s*\d+\s+/, '').match(/^[A-Za-zÀ-ÿ'. ]+?(?=\s+\d|$)/)
  return m && m[0].trim().split(/\s+/).length >= 2 ? m[0].trim() : null
}

const MESES = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO']
function mesDaReferencia(texto: string): string | null {
  const m = semAcento(texto).match(new RegExp(`(${MESES.join('|')})\\s*(?:/|DE)\\s*(\\d{4})`))
  return m ? `${m[2]}-${String(MESES.indexOf(m[1]) + 1).padStart(2, '0')}` : null
}

const PARTICULAS = new Set(['DA', 'DE', 'DO', 'DAS', 'DOS', 'E'])
const palavras = (s: string) => semAcento(s).replace(/[^A-Z ]/g, ' ').split(/\s+/).filter((p) => p && !PARTICULAS.has(p))

// Quem é a pessoa da página: pelo CPF, se houver; senão pelo nome (completo, ou todas as palavras do
// nome do cadastro dentro do nome do holerite, para quem foi cadastrado com nome mais curto).
export function acharPessoa(texto: string, equipe: Funcionario[], nome: string | null = null): string | null {
  const digitos = texto.replace(/\D/g, '')
  const porCpf = equipe.find((f) => f.cpf && f.cpf.length === 11 && digitos.includes(f.cpf))
  if (porCpf) return porCpf.id
  if (nome) {
    const doHolerite = palavras(nome)
    const chave = doHolerite.join(' ')
    const exato = equipe.find((f) => palavras(f.nome).join(' ') === chave)
    if (exato) return exato.id
    const contidos = equipe.filter((f) => {
      const p = palavras(f.nome)
      // Palavras longas valem pelo começo, para pequenas diferenças de grafia (Correa / Correia).
      const igual = (x: string, y: string) => x === y || (x.length >= 5 && y.length >= 5 && x.slice(0, 5) === y.slice(0, 5))
      return p.length >= 2 && p[0] === doHolerite[0] && p.every((x) => doHolerite.some((y) => igual(x, y)))
    })
    if (contidos.length === 1) return contidos[0].id
  }
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

// Linhas de cada página, montadas pela altura de cada pedaço de texto (guardando a posição de cada um).
async function linhasDasPaginas(arquivo: File | Blob): Promise<Linha[][]> {
  const lib = await pdfjs()
  const doc = await lib.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise
  const paginas: Linha[][] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const conteudo = await (await doc.getPage(n)).getTextContent()
    const porAltura = new Map<number, Parte[]>()
    for (const item of conteudo.items as { str: string; transform: number[] }[]) {
      if (!item.str?.trim()) continue
      const y = Math.round(item.transform[5] / 3) * 3
      const linha = porAltura.get(y) ?? []
      linha.push({ x: item.transform[4], s: item.str })
      porAltura.set(y, linha)
    }
    paginas.push(
      [...porAltura.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, partes]) => {
          partes.sort((a, b) => a.x - b.x)
          return { texto: partes.map((p) => p.s).join(' '), partes }
        }),
    )
  }
  return paginas
}

export async function lerHolerites(arquivo: File, equipe: Funcionario[]): Promise<PaginaHolerite[]> {
  const paginas = await linhasDasPaginas(arquivo)
  return paginas.map((todas, i) => {
    const blocos = recibos(todas)
    const linhas = blocos.flat()
    const texto = linhas.map((l) => l.texto).join('\n')
    const nome = nomeNoHolerite(linhas)
    let valores: ValoresHolerite = {}
    const rubricas: RubricaHolerite[] = []
    for (const b of blocos) {
      const lido = lerTabela(b)
      valores = juntarValores(valores, lido.valores)
      rubricas.push(...lido.rubricas)
    }
    return { pagina: i + 1, texto, nome, mes: mesDaReferencia(texto), funcionarioId: acharPessoa(texto, equipe, nome), valores, rubricas }
  })
}

// Líquido que o portal calcula com os valores lidos, para conferir com o do holerite.
export const liquidoLido = (v: ValoresHolerite) =>
  centavos((v.salario ?? 0) + (v.outrosCreditos ?? 0) - (v.descAdiantamento ?? 0) - (v.descFaltas ?? 0) - (v.descAtrasos ?? 0) - (v.inss ?? 0) - (v.descVt ?? 0) - (v.outrosDescontos ?? 0))

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
export function aplicarValores(s: Salario, v: ValoresHolerite, rubricas: RubricaHolerite[] = []): Salario {
  const r = { ...s }
  for (const campo of ['salario', 'descFaltas', 'descAtrasos', 'inss', 'descVt', 'descAdiantamento'] as const) {
    if (v[campo] !== undefined) r[campo] = v[campo]!
  }
  // "Outros" vêm sempre do holerite (zerados quando não há), para o total bater com o líquido dele.
  if (s.tipo === 'salario') {
    r.outrosCreditos = v.outrosCreditos ?? 0
    r.outrosDescontos = v.outrosDescontos ?? 0
    r.rubricas = rubricas.length ? rubricas : null
  }
  return r
}

export const NOMES_VALORES: Record<keyof ValoresHolerite, string> = {
  salario: 'Salário', descFaltas: 'Faltas', descAtrasos: 'Atrasos', inss: 'INSS', descVt: 'VT', descAdiantamento: 'Adiantamento', outrosCreditos: 'Outros créditos', outrosDescontos: 'Outros descontos', liquido: 'Líquido',
}
