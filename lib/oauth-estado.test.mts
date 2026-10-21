// Comprobación del state firmado del OAuth.
//   node --experimental-strip-types lib/oauth-estado.test.mts
import assert from 'node:assert/strict'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba'
process.env.GOOGLE_REDIRECT_URI = 'https://auth.reservaps.cl/api/auth/google/callback'
const { firmarEstado, leerEstado } = await import('./oauth-estado.ts')

const EMPRESA = '827f3614-d075-4a0d-ba92-5b6a8bfcf4bc'

// Ida y vuelta
const bueno = await firmarEstado(EMPRESA, 'https://raos.reservaps.cl')
const leido = await leerEstado(bueno)
assert.equal(leido?.e, EMPRESA)
assert.equal(leido?.o, 'https://raos.reservaps.cl')

// Firma cambiada: no sirve
assert.equal(await leerEstado(bueno.slice(0, -2) + 'xx'), null)

// Cuerpo cambiado por el de otra empresa, con la firma original
const otro = await firmarEstado('00000000-0000-0000-0000-000000000000', 'https://raos.reservaps.cl')
assert.equal(await leerEstado(otro.split('.')[0] + '.' + bueno.split('.')[1]), null)

// Basura
assert.equal(await leerEstado(null), null)
assert.equal(await leerEstado('sinpunto'), null)

// Vencido
const antes = Date.now
Date.now = () => antes() - 11 * 60_000
const viejo = await firmarEstado(EMPRESA, 'https://raos.reservaps.cl')
Date.now = antes
assert.equal(await leerEstado(viejo), null)

// Redirección abierta: un origen de otro dominio no pasa, aunque venga firmado
const fuera = await firmarEstado(EMPRESA, 'https://reservaps.cl.malo.com')
assert.equal(await leerEstado(fuera), null)

console.log('estado del oauth: ok')
