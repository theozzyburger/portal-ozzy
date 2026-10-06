import { useEffect, useRef, useState } from 'react'

// Campo para assinar com o dedo (ou mouse). Devolve a assinatura como imagem PNG em base64.
export default function Assinatura({ aoMudar }: { aoMudar: (png: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const desenhando = useRef(false)
  const [vazio, setVazio] = useState(true)

  useEffect(() => {
    const c = ref.current!
    const escala = window.devicePixelRatio || 1
    c.width = c.clientWidth * escala
    c.height = c.clientHeight * escala
    const ctx = c.getContext('2d')!
    ctx.scale(escala, escala)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0b0b0c'
  }, [])

  const ponto = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top] as const
  }

  const iniciar = (e: React.PointerEvent) => {
    e.preventDefault()
    ref.current!.setPointerCapture(e.pointerId)
    desenhando.current = true
    const ctx = ref.current!.getContext('2d')!
    const [x, y] = ponto(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 0.1, y + 0.1)
    ctx.stroke()
  }
  const mover = (e: React.PointerEvent) => {
    if (!desenhando.current) return
    const ctx = ref.current!.getContext('2d')!
    const [x, y] = ponto(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }
  const terminar = () => {
    if (!desenhando.current) return
    desenhando.current = false
    setVazio(false)
    aoMudar(ref.current!.toDataURL('image/png'))
  }
  const limpar = () => {
    const c = ref.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setVazio(true)
    aoMudar(null)
  }

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-stone-300 bg-white">
        <canvas
          ref={ref}
          className="block h-40 w-full touch-none"
          onPointerDown={iniciar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerCancel={terminar}
          aria-label="Área de assinatura"
        />
        {vazio && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-stone-400">Assine aqui com o dedo</span>}
        <div className="pointer-events-none absolute right-4 bottom-8 left-4 border-b border-stone-300" />
      </div>
      <button type="button" onClick={limpar} className="mt-1 text-xs font-semibold text-stone-500 underline">
        Limpar e assinar de novo
      </button>
    </div>
  )
}
