// PDF de la ficha firmada, armado en el navegador a partir de lo que se ve en
// pantalla (sin servidor: la ficha no sale a terceros).
// ponytail: es una imagen por página, el texto no se puede seleccionar. Si algún
// día lo piden buscable, pasar a dibujar el texto con jsPDF.
import { toCanvas } from 'html-to-image'
import { jsPDF } from 'jspdf'
import { cortes } from './cortes-pagina'

const MARGEN = 10 // mm
const ANCHO = 210 - MARGEN * 2
const ALTO = 297 - MARGEN * 2

export async function fichaPdf(el: HTMLElement) {
  const escala = 2
  const canvas = await toCanvas(el, { pixelRatio: escala, backgroundColor: '#ffffff' })
  const arriba = el.getBoundingClientRect().top
  const bordes = [...el.querySelectorAll('p, tr, h1, .grid > div')]
    .map(n => Math.round((n.getBoundingClientRect().bottom - arriba + 2) * escala))
  const pxPorMm = canvas.width / ANCHO
  const paginas = [0, ...cortes(bordes, canvas.height, Math.floor(ALTO * pxPorMm)), canvas.height]

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  for (let i = 0; i < paginas.length - 1; i++) {
    const alto = paginas[i + 1] - paginas[i]
    const hoja = document.createElement('canvas')
    hoja.width = canvas.width
    hoja.height = alto
    hoja.getContext('2d')!.drawImage(canvas, 0, paginas[i], canvas.width, alto, 0, 0, canvas.width, alto)
    if (i) pdf.addPage()
    pdf.addImage(hoja.toDataURL('image/jpeg', 0.92), 'JPEG', MARGEN, MARGEN, ANCHO, alto / pxPorMm)
  }
  return pdf.output('blob')
}
