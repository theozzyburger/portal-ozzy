import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Botao } from './ui'

// Tela cheia com uma folha A4 e o botão Imprimir. Na impressão (ou "Salvar como PDF"), só a folha sai.
// acoes: botões extras na barra (ex.: mandar no WhatsApp). Não saem na impressão.
export default function Impressao({ titulo, aoFechar, children, acoes }: { titulo: string; aoFechar: () => void; children: ReactNode; acoes?: ReactNode }) {
  useEffect(() => {
    document.body.classList.add('imprimindo')
    return () => document.body.classList.remove('imprimindo')
  }, [])
  return createPortal(
    <div className="folha-impressao fixed inset-0 z-[60] overflow-y-auto bg-stone-200" role="dialog" aria-label={titulo}>
      <div className="nao-imprimir sticky top-0 z-10 flex items-center justify-between gap-2 bg-carvao px-4 py-3 text-white">
        <span className="truncate font-semibold">{titulo}</span>
        <div className="flex shrink-0 gap-2">
          {acoes}
          <Botao className="bg-ozzy-400! text-carvao!" onClick={() => window.print()}>Imprimir</Botao>
          <Botao variante="fantasma" className="text-white! hover:bg-white/10!" onClick={aoFechar} aria-label="Fechar">✕</Botao>
        </div>
      </div>
      <div className="folha mx-auto my-4 w-full max-w-[210mm] bg-white px-[14mm] py-[16mm] text-[13px] leading-relaxed text-black shadow-lg print:my-0 print:max-w-none print:shadow-none sm:text-[14px]">
        {children}
      </div>
    </div>,
    document.body,
  )
}
