import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Ambiente de testes (08/10): quando a Vercel monta o branch "teste", o portal usa o banco de teste.
// Endereço e chave pública (anon) do projeto de teste: a mesma chave que vai para o navegador, não é segredo.
if (process.env.VERCEL_GIT_COMMIT_REF === 'teste') {
  process.env.VITE_AMBIENTE = 'teste'
  process.env.VITE_SUPABASE_URL = 'https://ctpxygjchnqisbzfsoew.supabase.co'
  process.env.VITE_SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0cHh5Z2pjaG5xaXNiemZzb2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMzI0ODIsImV4cCI6MjEwNjkwODQ4Mn0.zsC_-0Lkp5xpgTD12rz_3hFELddMwI7sQYiA3OcYd1U'
}

// `npm run build:preview` gera um único HTML (modo demonstração) para publicar como prévia.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'preview' ? [viteSingleFile()] : [])],
  build: { outDir: mode === 'preview' ? 'dist-preview' : 'dist' },
  // Na prévia, as bibliotecas de PDF viram um substituto (o arquivo único ficava grande demais para publicar).
  resolve: mode === 'preview' ? { alias: { 'html2canvas-pro': '/src/preview/pdf-stub.ts', jspdf: '/src/preview/pdf-stub.ts' } } : {},
}))
