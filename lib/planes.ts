// Planes de Reservaps (lo que paga cada empresa por usar la plataforma).
// Precio de lista por período; en cada empresa se guarda el pactado, que puede
// ser otro (fundador, descuento). Si cambian los precios, se cambian acá.
export const PLANES = {
  prueba:    { nombre: 'Prueba gratis 30 días', meses: 1,  precio: 0 },
  mensual:   { nombre: 'Mensual',               meses: 1,  precio: 25000 },
  semestral: { nombre: 'Semestral (15% dcto.)', meses: 6,  precio: 127500 },
  anual:     { nombre: 'Anual (20% dcto.)',     meses: 12, precio: 240000 },
  fundador:  { nombre: 'Fundador (anual)',      meses: 12, precio: 200000 },
  cortesia:  { nombre: 'Cortesía (no se cobra)', meses: 12, precio: 0 },
} as const
export type Plan = keyof typeof PLANES

// Lo que entra al mes por ese plan, para sumar el ingreso mensual
export const alMes = (plan: Plan, precio: number) => Math.round(precio / PLANES[plan].meses)

// 'YYYY-MM-DD' + n meses, menos un día: el último día que cubre el período.
// Un pago mensual desde el 31-01 cubre hasta el 27/28-02, no se salta a marzo.
export function cubreHasta(desde: string, meses: number) {
  const [y, m, d] = desde.split('-').map(Number)
  const fin = new Date(Date.UTC(y, m - 1 + meses, 1))
  const ultimo = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() + 1, 0)).getUTCDate()
  fin.setUTCDate(Math.min(d, ultimo))
  fin.setUTCDate(fin.getUTCDate() - 1)
  return fin.toISOString().slice(0, 10)
}

export const ESTADOS = {
  al_dia:     { texto: 'Al día',          color: 'bg-green-100 text-green-800' },
  prueba:     { texto: 'En prueba',       color: 'bg-blue-100 text-blue-800' },
  vencida:    { texto: 'Vencida (aviso)', color: 'bg-yellow-100 text-yellow-800' },
  suspendida: { texto: 'Suspendida',      color: 'bg-red-100 text-red-700' },
  cortesia:   { texto: 'Cortesía',        color: 'bg-purple-100 text-purple-800' },
  sin_plan:   { texto: 'Sin cobrar',      color: 'bg-gray-100 text-gray-600' },
} as const
export type Estado = keyof typeof ESTADOS
