import { useState, type KeyboardEvent } from 'react'
import { estiloEntrada } from './ui'
import { contasLancaveis } from '../lib/financeiro'
import type { ContaContabil } from '../lib/types'

const simples = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Conta contábil com busca (Heitor, 09/10): digita "tele" e aparece Telefone e Internet.
// Procura no nome, no código e no grupo (ex.: "salario" acha todas as contas de salário).
export default function EscolherConta({ plano, valor, aoMudar, vazio, desativado, autoFocus }: {
  plano: ContaContabil[]
  valor: string
  aoMudar: (id: string) => void
  vazio?: string // texto da opção "nenhuma" (quando a conta é opcional)
  desativado?: boolean
  autoFocus?: boolean
}) {
  const [texto, setTexto] = useState<string | null>(null) // null = fechado, mostrando a conta escolhida
  const [marcada, setMarcada] = useState(0)
  const lanc = contasLancaveis(plano)
  const maeDe = (c: ContaContabil) => plano.find((m) => m.codigo === c.paiCodigo)?.nome ?? ''
  const atual = plano.find((c) => c.id === valor)
  const mostrar = atual ? `${atual.nome} · ${atual.codigo}` : ''

  const palavras = simples(texto ?? '').split(/\s+/).filter(Boolean)
  const achadas = lanc
    .filter((c) => {
      const alvo = simples(`${c.nome} ${c.codigo} ${maeDe(c)}`)
      return palavras.every((p) => alvo.includes(p))
    })
    .sort((a, b) => {
      // Primeiro as que começam com o que foi digitado.
      const p = palavras[0] ?? ''
      const ia = simples(a.nome).startsWith(p) ? 0 : 1
      const ib = simples(b.nome).startsWith(p) ? 0 : 1
      return ia - ib || a.nome.localeCompare(b.nome, 'pt-BR')
    })
  const opcoes: { id: string; rotulo: string; grupo: string }[] = [
    ...(vazio && !palavras.length ? [{ id: '', rotulo: vazio, grupo: '' }] : []),
    ...achadas.map((c) => ({ id: c.id, rotulo: `${c.nome} · ${c.codigo}`, grupo: maeDe(c) })),
  ]

  function escolher(id: string) {
    aoMudar(id)
    setTexto(null)
  }

  function teclas(e: KeyboardEvent<HTMLInputElement>) {
    if (texto === null) {
      if (e.key === 'ArrowDown') { setTexto(''); setMarcada(0); e.preventDefault() }
      return
    }
    if (e.key === 'ArrowDown') { setMarcada((m) => Math.min(m + 1, opcoes.length - 1)); e.preventDefault() }
    else if (e.key === 'ArrowUp') { setMarcada((m) => Math.max(m - 1, 0)); e.preventDefault() }
    else if (e.key === 'Escape') { setTexto(null); e.preventDefault(); e.stopPropagation() }
    else if (e.key === 'Enter' || e.key === 'Tab') {
      const o = opcoes[marcada]
      if (o && (palavras.length || e.key === 'Enter')) {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation() }
        escolher(o.id)
      } else setTexto(null)
    }
  }

  return (
    <div>
      <input
        className={estiloEntrada}
        value={texto ?? mostrar}
        placeholder={atual ? undefined : 'Digite para buscar (ex.: telefone)'}
        disabled={desativado}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={texto !== null}
        onFocus={() => { setTexto(''); setMarcada(0) }}
        onBlur={() => setTexto(null)}
        onClick={() => { if (texto === null) { setTexto(''); setMarcada(0) } }}
        // Fechado mostrando a conta escolhida: o que for digitado começa uma busca nova.
        onChange={(e) => { const t = e.target.value; setTexto(texto === null && mostrar && t.startsWith(mostrar) ? t.slice(mostrar.length) : t); setMarcada(0) }}
        onKeyDown={teclas}
      />
      {texto !== null && (
        <ul role="listbox" className="mt-1 max-h-60 overflow-y-auto rounded-xl bg-white text-sm shadow-lg ring-1 ring-stone-200">
          {opcoes.length === 0 && <li className="px-3 py-2 text-stone-500">Nenhuma conta com "{texto}"</li>}
          {opcoes.map((o, i) => (
            <li
              key={o.id || 'vazio'}
              role="option"
              aria-selected={o.id === valor}
              className={`cursor-pointer px-3 py-1.5 ${i === marcada ? 'bg-ozzy-100' : ''} ${o.id === valor ? 'font-semibold' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); escolher(o.id) }}
              onMouseEnter={() => setMarcada(i)}
            >
              {o.rotulo}
              {o.grupo && <span className="ml-1 text-xs text-stone-400">{o.grupo}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
