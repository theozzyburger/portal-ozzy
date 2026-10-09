import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Depois de uma atualização do portal, quem estava com a página aberta pede partes antigas (ex.: o gerador de PDF)
// que não existem mais e o botão parece não fazer nada. Recarrega uma vez para pegar a versão nova.
window.addEventListener('vite:preloadError', (e) => {
  try {
    if (sessionStorage.getItem('recarregou') === location.href) return
    sessionStorage.setItem('recarregou', location.href)
  } catch { /* sem sessionStorage: recarrega assim mesmo */ }
  e.preventDefault()
  location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
