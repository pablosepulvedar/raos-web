// Campos obligatorios de la ficha (D.S. 19 art. 34: datos personales, contacto de
// emergencia, declaración de salud y aceptación; menores con padre, madre o tutor,
// NCh3014 6.1.1). Lo usan el formulario, para marcar en rojo, y la API, que no
// confía en el navegador. Devuelve las claves en el orden en que aparecen.
import { SALUD_ITEMS, type Salud } from './ficha-texto.ts'

export type DatosFicha = {
  nombre: string; documento: string; edad: string | number; peso: string | number; nacionalidad: string
  emergencia_nombre: string; emergencia_telefono: string; emergencia_parentesco: string
  tutor_nombre: string; tutor_documento: string
  salud?: Salud | null; acepta: boolean; esMenor: boolean
}

const vacio = (v: unknown) => !String(v ?? '').trim()

export function faltantesFicha(d: DatosFicha): string[] {
  const edad = Number(d.edad)
  const faltan: string[] = []
  if (vacio(d.nombre)) faltan.push('nombre')
  if (vacio(d.documento)) faltan.push('documento')
  if (!Number.isInteger(edad) || edad < 1 || edad > 120) faltan.push('edad')
  // NCh3014: peso del cliente + piloto dentro del rango de la vela
  const peso = Number(d.peso)
  if (!Number.isInteger(peso) || peso < 10 || peso > 250) faltan.push('peso')
  if (vacio(d.nacionalidad)) faltan.push('nacionalidad')
  if (d.esMenor) {
    if (vacio(d.tutor_nombre)) faltan.push('tutor_nombre')
    if (vacio(d.tutor_documento)) faltan.push('tutor_documento')
  }
  if (vacio(d.emergencia_nombre)) faltan.push('emergencia_nombre')
  if (String(d.emergencia_telefono ?? '').replace(/\D/g, '').length < 8) faltan.push('emergencia_telefono')
  if (vacio(d.emergencia_parentesco)) faltan.push('emergencia_parentesco')
  // Si declara algo de salud, tiene que decir qué
  for (const item of SALUD_ITEMS) {
    const v = d.salud?.[item.key]
    if (v?.si && vacio(v.detalle)) faltan.push(`salud_${item.key}`)
  }
  if (!d.acepta) faltan.push('acepta')
  return faltan
}
