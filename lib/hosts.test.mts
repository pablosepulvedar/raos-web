// Comprobación del filtro de subdominios.
//   node --experimental-strip-types lib/hosts.test.mts
import assert from 'node:assert/strict'

// Sin credenciales la lista no se puede pedir: tiene que fallar abierto
const { hostConocido } = await import('./hosts.ts')

// Lo que no es el dominio del comodín ni se pregunta
assert.equal(await hostConocido('localhost:3000'), true)
assert.equal(await hostConocido('raos.localhost:3000'), true)
assert.equal(await hostConocido('raos-web.pablo.workers.dev'), true)

// Los que no son empresas pero tienen que vivir
assert.equal(await hostConocido('admin.reservaps.cl'), true)
assert.equal(await hostConocido('auth.reservaps.cl'), true)

// Dos niveles no existen: Universal SSL ni siquiera los cubre
assert.equal(await hostConocido('a.b.reservaps.cl'), false)

// Sin poder consultar la lista, deja pasar: el filtro no puede dejar sin
// sistema a una empresa por un fallo de red
assert.equal(await hostConocido('kgunytse.reservaps.cl'), true)

// Con la lista en mano, el inventado se cae y el real pasa
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://local.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave'
const fetchOriginal = globalThis.fetch
globalThis.fetch = (async () => new Response(JSON.stringify(['raos', 'demo']), {
  headers: { 'Content-Type': 'application/json' },
})) as typeof fetch

assert.equal(await hostConocido('raos.reservaps.cl'), true)
assert.equal(await hostConocido('demo.reservaps.cl'), true)
assert.equal(await hostConocido('kgunytse.reservaps.cl'), false)
assert.equal(await hostConocido('RAOS.reservaps.cl'), true)   // mayúsculas

globalThis.fetch = fetchOriginal
console.log('filtro de subdominios: ok')
