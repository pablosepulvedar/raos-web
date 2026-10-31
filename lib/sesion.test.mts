import assert from 'node:assert/strict'
import { inicioSesion, leerSesion, sesionVencida } from './sesion.ts'

const b64url = (s: string) => Buffer.from(s).toString('base64url')
const jwt = (payload: object) => `x.${b64url(JSON.stringify(payload))}.y`
const ahora = 1_800_000_000
const token = (horasAtras: number) => jwt({ amr: [{ method: 'password', timestamp: ahora - horasAtras * 3600 }] })

assert.equal(inicioSesion(token(1)), ahora - 3600)
assert.equal(sesionVencida(token(23), ahora), false)
assert.equal(sesionVencida(token(25), ahora), true)
assert.equal(sesionVencida(jwt({}), ahora), false)          // sin amr no se corta
assert.equal(sesionVencida('basura', ahora), false)

// Cookie en dos trozos y con prefijo base64-
const valor = 'base64-' + b64url(JSON.stringify({ access_token: token(30), refresh_token: 'r' }))
const mitad = Math.floor(valor.length / 2)
const s = leerSesion([
  { name: 'otra', value: 'x' },
  { name: 'sb-abc-auth-token.1', value: valor.slice(mitad) },
  { name: 'sb-abc-auth-token.0', value: valor.slice(0, mitad) },
])
assert.equal(s?.refresh_token, 'r')
assert.equal(sesionVencida(s!.access_token, ahora), true)
assert.equal(leerSesion([{ name: 'sb-abc-auth-token', value: 'base64-xxx' }]), null)
console.log('sesion OK')
