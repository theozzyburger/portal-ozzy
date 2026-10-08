import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build:preview` gera um único HTML (modo demonstração) para publicar como prévia.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'preview' ? [viteSingleFile()] : [])],
  build: { outDir: mode === 'preview' ? 'dist-preview' : 'dist' },
  // Na prévia, as bibliotecas de PDF viram um substituto (o arquivo único ficava grande demais para publicar).
  resolve: mode === 'preview' ? { alias: { 'html2canvas-pro': '/src/preview/pdf-stub.ts', jspdf: '/src/preview/pdf-stub.ts' } } : {},
}))
