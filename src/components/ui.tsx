import { useEffect, type ReactNode } from 'react'

export function Botao({
  children, variante = 'primario', className = '', ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario' | 'perigo' | 'fantasma' }) {
  const estilos = {
    primario: 'bg-carvao text-white hover:bg-black',
    secundario: 'bg-white text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50',
    perigo: 'bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50',
    fantasma: 'text-stone-600 hover:bg-stone-100',
  }[variante]
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${estilos} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-stone-500">{dica}</span>}
    </label>
  )
}

export const estiloEntrada =
  'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-ozzy-500 focus:ring-2 focus:ring-ozzy-100'

export function Cartao({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`block w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-stone-200 ${onClick ? 'transition hover:ring-ozzy-400 active:scale-[0.99]' : ''} ${className}`}
    >
      {children}
    </Tag>
  )
}

export function Selo({ children, cor = 'cinza' }: { children: ReactNode; cor?: 'cinza' | 'ambar' | 'verde' | 'vermelho' | 'azul' }) {
  const c = {
    cinza: 'bg-stone-100 text-stone-700',
    ambar: 'bg-ozzy-100 text-ozzy-700',
    verde: 'bg-emerald-50 text-emerald-700',
    vermelho: 'bg-red-50 text-red-700',
    azul: 'bg-sky-50 text-sky-700',
  }[cor]
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${c}`}>{children}</span>
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">{children}</p>
}

export function Titulo({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-xl font-bold tracking-tight">{children}</h1>
      {acao}
    </div>
  )
}

export function Modal({ titulo, aberto, aoFechar, children }: { titulo: string; aberto: boolean; aoFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!aberto) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aberto, aoFechar])
  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={aoFechar}>
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 sm:max-w-lg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={titulo}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button onClick={aoFechar} className="rounded-full p-2 text-stone-500 hover:bg-stone-100" aria-label="Fechar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Avatar({ nome, tamanho = 40 }: { nome: string; tamanho?: number }) {
  const iniciais = nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-ozzy-100 font-bold text-ozzy-700"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.38 }}
    >
      {iniciais}
    </span>
  )
}
