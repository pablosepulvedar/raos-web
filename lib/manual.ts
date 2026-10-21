// A qué parte del manual lleva cada pantalla de la app.
// El manual vive en la landing del producto, igual para todas las empresas.
export const MANUAL = 'https://reservaps.cl/manual/'

// Se busca el prefijo más largo que calce, así /varios/calendar gana sobre /varios.
const CAPITULOS: Array<[string, string]> = [
  ['/varios/calendar', 'cap-11'],
  ['/varios', 'cap-9'],
  ['/calendar', 'cap-11'],
  ['/reservas', 'cap-4'],
  ['/reserva/', 'cap-4'],
  ['/fichas/', 'cap-6'],
  ['/pilotos', 'cap-7'],
  ['/usuarios', 'cap-8'],
  ['/reporte', 'cap-10'],
  ['/admin', 'cap-13'],
  ['/', 'cap-3'],
]

export function capituloDe(path: string) {
  // El '/' solo calza con la portada, no con todo lo que empieza por '/'
  const par = CAPITULOS.find(([ruta]) => (ruta === '/' ? path === '/' : path.startsWith(ruta)))
  return par ? `${MANUAL}#${par[1]}` : MANUAL
}
