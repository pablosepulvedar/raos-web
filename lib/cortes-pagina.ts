// Dónde se puede cortar la página sin partir una línea: el borde inferior de
// cada fila, párrafo o casilla. Elige el corte más bajo que entra en la hoja.
export function cortes(bordes: number[], total: number, altoPagina: number) {
  const orden = [...new Set(bordes)].filter(b => b > 0 && b < total).sort((a, b) => a - b)
  const res: number[] = []
  let desde = 0
  while (total - desde > altoPagina) {
    const limite = desde + altoPagina
    const corte = orden.filter(b => b > desde && b <= limite).pop() ?? limite
    res.push(corte)
    desde = corte
  }
  return res
}
