// Comprobación de cómo se leen los títulos del calendario.
//   node --experimental-strip-types lib/calendar-plantillas.test.mts
import assert from 'node:assert/strict'
import { leerEvento, patronARegex } from './calendar-plantillas.ts'

// Formato de RAOS: "Nombre x 2 (12:00)" con las personas en la descripción
const raos = leerEvento(
  'Karina Jara x 2 (12:00)',
  '-Ana Pérez 31 años 62 kg 📸\n-Luis Soto 29 años 78 kg\nAbono 20.000',
  'raos',
)
assert.equal(raos.nombre, 'Karina Jara')
assert.equal(raos.cantidad, 2)
assert.equal(raos.horaStr, '12:00')
assert.equal(raos.abono, 20000)
assert.equal(raos.pasajeros.length, 2)
assert.equal(raos.pasajeros[0].camara_normal, true)
assert.equal(raos.pasajeros[1].sin_camara, true)
assert.equal(raos.dudoso, false)

// Cantidad primero
const inverso = leerEvento('3 x Pedro Ramírez', '', 'cantidad_primero')
assert.equal(inverso.nombre, 'Pedro Ramírez')
assert.equal(inverso.cantidad, 3)

// Con teléfono en el título
const conTel = leerEvento('Karina Jara 2p 56912345678', '', 'con_telefono')
assert.equal(conTel.nombre, 'Karina Jara')
assert.equal(conTel.telefono, '56912345678')

// Título que no calza: no se inventa nada y queda marcado para revisar
const raro = leerEvento('Reunión con proveedor', '', 'raos')
assert.equal(raro.dudoso, true)
assert.equal(raro.nombre, 'Reunión con proveedor')
assert.equal(raro.cantidad, 1)

// Sin cantidad en el título, mandan las personas de la descripción
const sinCantidad = leerEvento('Familia Muñoz', '-Ana 31 años 62 kg\n-Luis 29 años 78 kg', 'solo_nombre')
assert.equal(sinCantidad.cantidad, 2)

// Plantilla propia
const libre = leerEvento('Ana Díaz - 4 personas - 56998887777', '', 'libre',
  '{nombre} - {cantidad} personas - {telefono}')
assert.equal(libre.nombre, 'Ana Díaz')
assert.equal(libre.cantidad, 4)
assert.equal(libre.telefono, '56998887777')

// Un patrón sin ningún campo no sirve como patrón
assert.equal(patronARegex('solo texto'), null)

// El teléfono también se saca de la descripción
const desc = leerEvento('Ana Díaz', 'Teléfono: +56 9 8765 4321\nAbono $15.000', 'solo_nombre')
assert.equal(desc.telefono, '56987654321')
assert.equal(desc.abono, 15000)

console.log('plantillas de calendario: ok')
