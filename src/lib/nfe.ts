import type { FormaPagamento, NotaImportada } from './types'

// Lê o XML da NF-e (modelo 55, versão 4.00; também aceita a 3.10) no navegador.
// Aceita o arquivo com protocolo (<nfeProc>) ou só a <NFe>. Cada item já sai com o custo de entrada:
// valor do produto − desconto + frete, seguro, outras despesas, IPI e ICMS-ST do próprio item,
// para a soma dos itens bater com o total da nota e o custo no estoque ser o que a loja pagou.

const num = (s: string | null | undefined) => {
  const n = Number((s ?? '').trim())
  return Number.isFinite(n) ? n : 0
}
const r2 = (n: number) => Math.round(n * 100) / 100

function primeiro(el: Element | Document, ...caminho: string[]): Element | null {
  let atual: Element | Document | null = el
  for (const nome of caminho) {
    if (!atual) return null
    atual = Array.from(atual.getElementsByTagName(nome))[0] ?? null
  }
  return atual as Element | null
}
const texto = (el: Element | Document | null, ...caminho: string[]) => (el ? primeiro(el, ...caminho)?.textContent?.trim() ?? null : null)
// Filhos diretos (evita pegar <vFrete> do total quando se quer o do item, por exemplo).
const filho = (el: Element | null, nome: string) => (el ? Array.from(el.children).find((c) => c.localName === nome) ?? null : null)
const textoFilho = (el: Element | null, nome: string) => filho(el, nome)?.textContent?.trim() ?? null

export function lerXmlNfe(xml: string): NotaImportada {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('O arquivo não é um XML válido.')
  if (doc.getElementsByTagName('procEventoNFe').length || doc.getElementsByTagName('evento').length) {
    throw new Error('Este XML é de um evento (cancelamento, carta de correção…), não da nota.')
  }
  if (doc.getElementsByTagName('resNFe').length) throw new Error('Este XML é só o resumo da nota. Baixe o XML completo.')
  const inf = primeiro(doc, 'infNFe')
  if (!inf) throw new Error('Não achei a nota fiscal neste XML.')
  const ide = filho(inf, 'ide')
  const modelo = textoFilho(ide, 'mod')
  if (modelo && modelo !== '55') throw new Error(modelo === '65' ? 'Este XML é de cupom (NFC-e), não de nota de compra.' : `Modelo de nota ${modelo} não suportado.`)

  const chave = (inf.getAttribute('Id') ?? '').replace(/^NFe/, '')
  if (!/^\d{44}$/.test(chave)) throw new Error('A chave de acesso da nota não está no XML.')
  const emissao = (textoFilho(ide, 'dhEmi') ?? textoFilho(ide, 'dEmi') ?? '').slice(0, 10)
  const emit = filho(inf, 'emit')
  const dest = filho(inf, 'dest')
  const tot = primeiro(inf, 'total', 'ICMSTot')

  const itens = Array.from(inf.getElementsByTagName('det')).map((det) => {
    const prod = filho(det, 'prod')
    const imposto = filho(det, 'imposto')
    const quantidade = num(textoFilho(prod, 'qCom'))
    const ipi = num(texto(imposto ? filho(imposto, 'IPI') : null, 'vIPI'))
    // ICMS-ST fica dentro do grupo do ICMS (ICMS10, ICMS70, ICMSSN201…).
    const st = num(texto(imposto ? filho(imposto, 'ICMS') : null, 'vICMSST'))
    const valorTotal = r2(
      num(textoFilho(prod, 'vProd')) - num(textoFilho(prod, 'vDesc')) + num(textoFilho(prod, 'vFrete')) + num(textoFilho(prod, 'vSeg')) +
        num(textoFilho(prod, 'vOutro')) + ipi + st,
    )
    const ean = textoFilho(prod, 'cEAN')
    return {
      codigo: textoFilho(prod, 'cProd') ?? '',
      ean: ean && /^\d{8,14}$/.test(ean) ? ean : null,
      descricao: textoFilho(prod, 'xProd') ?? '',
      ncm: textoFilho(prod, 'NCM'),
      cfop: textoFilho(prod, 'CFOP'),
      unidade: (textoFilho(prod, 'uCom') ?? '').toUpperCase(),
      quantidade,
      valorUnit: quantidade > 0 ? Math.round((valorTotal / quantidade) * 1e6) / 1e6 : 0,
      valorTotal,
    }
  })

  const duplicatas = Array.from(inf.getElementsByTagName('dup')).map((d) => ({
    numero: textoFilho(d, 'nDup'),
    vencimento: (textoFilho(d, 'dVenc') ?? emissao).slice(0, 10),
    valor: num(textoFilho(d, 'vDup')),
  }))
  const pagamento = Array.from(inf.getElementsByTagName('detPag')).map((p) => ({ tPag: textoFilho(p, 'tPag') ?? '', valor: num(textoFilho(p, 'vPag')) }))

  return {
    chave,
    numero: textoFilho(ide, 'nNF') ?? '',
    serie: textoFilho(ide, 'serie') ?? '',
    emissao,
    emitente: {
      cnpj: textoFilho(emit, 'CNPJ') ?? textoFilho(emit, 'CPF') ?? '',
      nome: textoFilho(emit, 'xNome') ?? '',
      fantasia: textoFilho(emit, 'xFant'),
    },
    destinatarioCnpj: textoFilho(dest, 'CNPJ') ?? textoFilho(dest, 'CPF'),
    totais: {
      produtos: num(textoFilho(tot, 'vProd')),
      frete: num(textoFilho(tot, 'vFrete')),
      desconto: num(textoFilho(tot, 'vDesc')),
      outras: num(textoFilho(tot, 'vOutro')),
      total: num(textoFilho(tot, 'vNF')),
    },
    pagamento,
    duplicatas,
    xml,
    itens,
  }
}

// Forma de pagamento a partir do tPag da NF-e.
export const formaDoTPag = (t: string | undefined): FormaPagamento =>
  ({ '01': 'dinheiro', '03': 'cartao_credito', '04': 'cartao_debito', '15': 'boleto', '16': 'transferencia', '17': 'pix', '18': 'transferencia' } as Record<string, FormaPagamento>)[t ?? ''] ?? 'boleto'

export const formatarCnpj = (s: string | null | undefined) => {
  const d = (s ?? '').replace(/\D/g, '')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return s ?? ''
}
