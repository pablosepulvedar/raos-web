import assert from 'node:assert/strict'
import { alMes, cubreHasta } from './planes.ts'

assert.equal(cubreHasta('2026-10-29', 1), '2026-11-28')
assert.equal(cubreHasta('2026-01-31', 1), '2026-02-27')  // febrero corto: hasta el 27, el 28 ya es el próximo
assert.equal(cubreHasta('2026-11-01', 12), '2027-10-31')
assert.equal(cubreHasta('2026-09-15', 6), '2027-03-14')
assert.equal(alMes('semestral', 127500), 21250)
assert.equal(alMes('anual', 240000), 20000)
console.log('planes OK')
