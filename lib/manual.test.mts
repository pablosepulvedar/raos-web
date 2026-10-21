// Comprobación del mapa pantalla -> capítulo.
//   node --experimental-strip-types lib/manual.test.mts
import assert from 'node:assert/strict'
import { capituloDe } from './manual.ts'

const cap = (p: string) => capituloDe(p).split('#')[1] ?? '(indice)'

// El prefijo más largo gana: /varios/calendar no cae en /varios
assert.equal(cap('/varios/calendar'), 'cap-11')
assert.equal(cap('/varios'), 'cap-9')
assert.equal(cap('/varios/pagos'), 'cap-9')

// La portada no se lleva todo lo que empieza con '/'
assert.equal(cap('/'), 'cap-3')
assert.equal(cap('/reservas'), 'cap-4')
assert.equal(cap('/reserva/abc-123'), 'cap-4')
assert.equal(cap('/fichas/7'), 'cap-6')
assert.equal(cap('/pilotos'), 'cap-7')
assert.equal(cap('/usuarios'), 'cap-8')
assert.equal(cap('/reporte'), 'cap-10')
assert.equal(cap('/calendar'), 'cap-11')
assert.equal(cap('/admin'), 'cap-13')
assert.equal(cap('/admin/consumo'), 'cap-13')

assert.equal(cap('/empresas'), 'cap-2')

// Una ruta desconocida va al índice, no a un capítulo equivocado
assert.equal(cap('/algo-nuevo'), '(indice)')

console.log('capitulos del manual: ok')
