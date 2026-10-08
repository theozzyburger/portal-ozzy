// Só na prévia publicada (modo demonstração): as bibliotecas de PDF não cabem no arquivo único.
// O botão continua funcionando, com um PDF de mentira.
export default async function html2canvas() {
  const c = document.createElement('canvas')
  c.width = c.height = 1
  return c
}
export class jsPDF {
  addImage() {}
  output() {
    return new Blob(['%PDF-1.4\n% prévia\n'], { type: 'application/pdf' })
  }
}
