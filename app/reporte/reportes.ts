// El catálogo de la reportería. Cada uno es un permiso aparte en Varios > Roles:
// así se le puede dar a un guía el suyo sin mostrarle los ingresos de la empresa.
// 'reporte' se queda con el cuadre del día para no cambiarles el permiso a los roles que ya existen.
export const REPORTES = [
  { id: 'dia',       permiso: 'reporte',           titulo: 'Cuadre del día' },
  { id: 'periodo',   permiso: 'reporte_periodo',   titulo: 'Resumen por período' },
  { id: 'pilotos',   permiso: 'reporte_pilotos',   titulo: 'Por {operador}' },
  { id: 'servicios', permiso: 'reporte_servicios', titulo: 'Por servicio' },
  { id: 'metodos',   permiso: 'reporte_metodos',   titulo: 'Por método de pago' },
] as const

export type ReporteId = (typeof REPORTES)[number]['id']
export const PERMISOS_REPORTE = REPORTES.map(r => r.permiso)
