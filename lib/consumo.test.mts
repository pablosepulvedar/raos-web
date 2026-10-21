// Comprobación del resumen de consumo.
//   node --experimental-strip-types lib/consumo.test.mts
import assert from 'node:assert/strict'
import { resumir, ventana } from './consumo.ts'

const workers = [
  { sum: { requests: 10, errors: 1 }, dimensions: { scriptName: 'raos-web', date: '2026-10-19' } },
  { sum: { requests: 5, errors: 0 }, dimensions: { scriptName: 'raos-cron', date: '2026-10-19' } },
  { sum: { requests: 40, errors: 2 }, dimensions: { scriptName: 'raos-web', date: '2026-10-20' } },
]
const hosts = [
  { count: 30, dimensions: { clientRequestHTTPHost: 'raos.reservaps.cl' } },
  { count: 60, dimensions: { clientRequestHTTPHost: 'reservaps.cl' } },
  { count: 5, dimensions: { clientRequestHTTPHost: 'raos.reservaps.cl' } },
  // El mismo sitio, pero el escáner le pegó a otro puerto
  { count: 10, dimensions: { clientRequestHTTPHost: 'reservaps.cl:8443' } },
]

const r = resumir(workers, hosts)

// Un día suma todos sus workers, y los días salen ordenados
assert.deepEqual(r.dias, [
  { fecha: '2026-10-19', requests: 15 },
  { fecha: '2026-10-20', requests: 40 },
])
assert.equal(r.pico, 40)
assert.equal(r.errores, 3)

// Los workers se ordenan de mayor a menor, sumando sus días
assert.deepEqual(r.workers, [
  { nombre: 'raos-web', requests: 50 },
  { nombre: 'raos-cron', requests: 5 },
])

// Un host repetido se suma una sola vez, y el puerto no abre una fila aparte
assert.deepEqual(r.hosts, [
  { nombre: 'reservaps.cl', requests: 70 },
  { nombre: 'raos.reservaps.cl', requests: 35 },
])

// Sin datos no se cae ni inventa un pico
const vacio = resumir([], [])
assert.deepEqual(vacio.dias, [])
assert.equal(vacio.pico, 0)

// La ventana nunca supera lo que acepta la zona (4w2d)
const { desde, hasta } = ventana(new Date('2026-10-20T00:00:00Z'))
assert.equal(hasta, '2026-10-20')
assert.equal(desde, '2026-09-23')
assert.ok((Date.parse(hasta) - Date.parse(desde)) / 86_400_000 <= 30)

console.log('consumo: ok')
