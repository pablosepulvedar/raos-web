import assert from 'node:assert/strict'
import { cortes } from './cortes-pagina.ts'

// Entra en una hoja: sin cortes
assert.deepEqual(cortes([100, 200], 250, 300), [])
// Corta en el último borde que entra, no a mitad de línea
assert.deepEqual(cortes([100, 280, 320, 590], 700, 300), [280, 320, 590])
// Sin bordes útiles corta justo en el límite
assert.deepEqual(cortes([], 700, 300), [300, 600])
console.log('cortes-pagina OK')
