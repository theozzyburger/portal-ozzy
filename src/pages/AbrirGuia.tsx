import { useEffect, useState } from 'react'
import logo from '../assets/logo.png'
import type { Store } from '../lib/store'

// Link curto da guia de exame mandado no WhatsApp: abre o PDF enquanto o link vale (7 dias).
export default function AbrirGuia({ store, codigo }: { store: Store; codigo: string }) {
  const [estado, setEstado] = useState<'abrindo' | 'vencido' | 'erro'>('abrindo')
  useEffect(() => {
    store
      .abrirGuia(codigo)
      .then((url) => (url ? location.replace(url) : setEstado('vencido')))
      .catch(() => setEstado('erro'))
  }, [store, codigo])
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-carvao p-6 text-center text-white">
      <img src={logo} alt="The Ozzy" className="h-20 w-20" />
      <p className="max-w-xs text-sm text-stone-300">
        {estado === 'abrindo'
          ? 'Abrindo sua guia de exame…'
          : estado === 'vencido'
            ? 'Este link venceu. Peça uma nova guia para a administração da The Ozzy.'
            : 'Não conseguimos abrir a guia agora. Tente de novo em instantes.'}
      </p>
    </div>
  )
}
