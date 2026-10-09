import { useState } from 'react'
import { Botao, Modal, estiloEntrada } from '../components/ui'
import { useApp } from '../lib/contexto'
import { contasLancaveis } from '../lib/financeiro'
import { soDigitos } from '../lib/store'
import type { ContaContabil, Fornecedor } from '../lib/types'
import { lerTabela } from './LancarContas'

export const COLUNAS_FORNECEDOR = ['Nome', 'CNPJ/CPF', 'Conta contábil', 'Telefone', 'Observação'] as const

const simples = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

interface Linha { n: number; nome: string; cnpj: string; contaId: string | null; telefone: string; observacao: string; existe: Fornecedor | null; erros: string[] }

// Fornecedores em lote (09/10): a lista limpa da Eclética. Quem já existe (mesmo CNPJ ou nome) só ganha o que faltava.
export default function ImportarFornecedores({ fornecedores, plano, aoFechar, aoSalvar }: {
  fornecedores: Fornecedor[]; plano: ContaContabil[]; aoFechar: () => void; aoSalvar: () => void
}) {
  const { store } = useApp()
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState('')
  const lanc = contasLancaveis(plano)

  const tabela = texto.trim() ? lerTabela(texto) : []
  const temCabecalho = tabela.length > 0 && /^nome/i.test(tabela[0][0] ?? '')
  const vistos = new Set<string>()
  const linhas: Linha[] = tabela.slice(temCabecalho ? 1 : 0).map(([nome = '', doc = '', conta = '', tel = '', obs = ''], i) => {
    const erros: string[] = []
    const dig = soDigitos(doc)
    if (!nome.trim()) erros.push('falta o nome')
    if (dig && dig.length !== 14 && dig.length !== 11) erros.push('CNPJ/CPF incompleto')
    const cs = simples(conta)
    const cc = conta.trim() ? lanc.find((x) => x.codigo === conta.trim()) ?? lanc.find((x) => simples(x.nome) === cs) : undefined
    if (conta.trim() && !cc) erros.push(`conta "${conta}" não existe`)
    const chave = simples(nome)
    if (chave && vistos.has(chave)) erros.push('nome repetido no arquivo')
    vistos.add(chave)
    const existe = (dig && fornecedores.find((f) => f.cnpj && soDigitos(f.cnpj) === dig)) || fornecedores.find((f) => simples(f.nome) === chave) || null
    return { n: i + 1, nome: nome.trim(), cnpj: dig, contaId: cc?.id ?? null, telefone: tel.trim(), observacao: obs.trim(), existe, erros }
  })
  const boas = linhas.filter((l) => !l.erros.length)
  const novos = boas.filter((l) => !l.existe)

  async function abrirArquivo(f: File | undefined) {
    if (!f) return
    const bytes = new Uint8Array(await f.arrayBuffer())
    let t = new TextDecoder('utf-8').decode(bytes)
    if (t.includes('�')) t = new TextDecoder('windows-1252').decode(bytes)
    setTexto(t)
  }

  async function importar() {
    setErro('')
    const falhas: string[] = []
    let feitos = 0
    for (const l of boas) {
      setSalvando(`${++feitos} de ${boas.length}…`)
      const e = l.existe
      try {
        if (!e) {
          await store.salvarFornecedor({ nome: l.nome, contato: null, telefone: l.telefone || null, observacao: l.observacao || null, ativo: true, cnpj: l.cnpj || null, contaPadraoId: l.contaId })
        } else if ((!e.cnpj && l.cnpj) || (!e.contaPadraoId && l.contaId) || (!e.telefone && l.telefone)) {
          await store.salvarFornecedor({
            id: e.id, nome: e.nome, contato: e.contato, telefone: e.telefone || l.telefone || null, observacao: e.observacao, ativo: e.ativo,
            cnpj: e.cnpj || l.cnpj || null, contaPadraoId: e.contaPadraoId || l.contaId,
          })
        }
      } catch (x) {
        falhas.push(`${l.nome}: ${/duplicate|unique/i.test((x as Error).message) ? 'CNPJ já usado por outro fornecedor' : (x as Error).message}`)
      }
    }
    setSalvando('')
    if (falhas.length) setErro(`Não entraram: ${falhas.join('; ')}`)
    else aoSalvar()
  }

  return (
    <Modal titulo="Importar fornecedores" aberto aoFechar={aoFechar}>
      <div className="space-y-3">
        <p className="text-sm text-stone-600">Cole as linhas da planilha ou abra o CSV. Colunas, nesta ordem:</p>
        <p className="rounded-xl bg-stone-100 p-2 text-xs">
          <b>{COLUNAS_FORNECEDOR.join(' · ')}</b>
          <br />
          Conta: o código (ex.: 1.2) ou o nome. Quem já está cadastrado (mesmo CNPJ ou nome) não duplica: só ganha CNPJ, conta e telefone se faltavam.
        </p>
        <label className="inline-block cursor-pointer rounded-xl bg-white px-4 py-2 text-sm font-semibold ring-1 ring-stone-300 hover:bg-stone-50">
          Abrir CSV
          <input type="file" accept=".csv,.txt,text/csv" className="hidden" onChange={(e) => abrirArquivo(e.target.files?.[0])} />
        </label>
        <textarea className={`${estiloEntrada} h-32 font-mono text-xs`} placeholder="Cole aqui (Ctrl+V)" value={texto} onChange={(e) => setTexto(e.target.value)} />
        {linhas.length > 0 && (
          <>
            <ul className="max-h-56 divide-y divide-stone-100 overflow-auto rounded-xl text-xs ring-1 ring-stone-200">
              {linhas.map((l) => (
                <li key={l.n} className={`px-2 py-1 ${l.erros.length ? 'bg-red-50' : ''}`}>
                  <b>{l.nome || '—'}</b>
                  <span className="text-stone-500"> · {[l.cnpj || 'sem CNPJ', plano.find((x) => x.id === l.contaId)?.nome, l.existe ? 'já cadastrado' : 'novo'].filter(Boolean).join(' · ')}</span>
                  {l.erros.length > 0 && <span className="block font-semibold text-red-700">{l.erros.join('; ')}</span>}
                </li>
              ))}
            </ul>
            <p className="text-sm">{novos.length} novos · {boas.length - novos.length} já cadastrados{boas.length < linhas.length && <span className="text-red-700"> · {linhas.length - boas.length} com erro ficam de fora</span>}</p>
          </>
        )}
        {erro && <p className="text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>{erro ? 'Fechar' : 'Cancelar'}</Botao>
          <Botao onClick={importar} disabled={!!salvando || !boas.length}>{salvando || `Importar ${boas.length || ''}`}</Botao>
        </div>
      </div>
    </Modal>
  )
}
