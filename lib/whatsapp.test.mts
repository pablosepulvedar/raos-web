// Comprobación del link de WhatsApp.
//   node --experimental-strip-types lib/whatsapp.test.mts
import assert from 'node:assert/strict'
import { linkWhatsApp } from './whatsapp.ts'

assert.equal(linkWhatsApp('hola tú', '56912345678'), 'https://wa.me/56912345678?text=hola%20t%C3%BA')
// La preferencia solo cambia algo en Android
assert.equal(linkWhatsApp('hola', '569', true, false), 'https://wa.me/569?text=hola')
assert.equal(linkWhatsApp('hola', '569', true, true),
  'intent://send/?phone=569&text=hola#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end')
// Sin teléfono (link de pago): WhatsApp pregunta a quién
assert.equal(linkWhatsApp('hola', '', true, true),
  'intent://send/?text=hola#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end')
console.log('whatsapp: ok')
