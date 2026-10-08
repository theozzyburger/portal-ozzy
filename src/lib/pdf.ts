// Transforma a folha A4 da tela de impressão num PDF (para mandar pelo WhatsApp sem passar pelo "Salvar como PDF").
// As bibliotecas só carregam quando alguém usa.
export async function folhaParaPdf(folha: HTMLElement, nomeArquivo: string): Promise<File> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')])
  const canvas = await html2canvas(folha, {
    scale: 2,
    backgroundColor: '#ffffff',
    windowWidth: 1100,
    // No celular a folha fica estreita; no PDF ela sai sempre na largura de um A4.
    onclone: (doc) => {
      const f = doc.querySelector<HTMLElement>('.folha')
      if (f) Object.assign(f.style, { width: '210mm', maxWidth: 'none', margin: '0', boxShadow: 'none' })
      doc.querySelectorAll<HTMLElement>('.nao-imprimir').forEach((x) => (x.style.display = 'none'))
    },
  })
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const largura = 210
  const altura = (canvas.height * largura) / canvas.width
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, largura, Math.min(altura, 297))
  return new File([pdf.output('blob')], nomeArquivo, { type: 'application/pdf' })
}
