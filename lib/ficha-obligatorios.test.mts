import assert from 'node:assert/strict'
import { faltantesFicha } from './ficha-obligatorios.ts'

const ok = {
  nombre: 'Ana', documento: '1-9', edad: '30', peso: '62', nacionalidad: 'Chilena',
  emergencia_nombre: 'Luis', emergencia_telefono: '+56 9 1234 5678', emergencia_parentesco: 'Hermano',
  tutor_nombre: '', tutor_documento: '', salud: null, acepta: true, esMenor: false,
}
assert.deepEqual(faltantesFicha(ok), [])
assert.deepEqual(faltantesFicha({ ...ok, emergencia_parentesco: ' ', emergencia_telefono: '123' }),
  ['emergencia_telefono', 'emergencia_parentesco'])
assert.deepEqual(faltantesFicha({ ...ok, esMenor: true, edad: '12' }), ['tutor_nombre', 'tutor_documento'])
assert.deepEqual(faltantesFicha({ ...ok, edad: 'x', acepta: false }), ['edad', 'acepta'])
assert.deepEqual(faltantesFicha({ ...ok, peso: '' }), ['peso'])
assert.deepEqual(faltantesFicha({ ...ok, peso: '600' }), ['peso'])
const salud = { alergias: { si: true, detalle: '' } } as never
assert.deepEqual(faltantesFicha({ ...ok, salud }), ['salud_alergias'])
console.log('ficha-obligatorios OK')
