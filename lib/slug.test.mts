import assert from 'node:assert'

// Copia de sugerirSlug en app/admin/page.tsx. Se prueba acá porque esa pantalla es
// un componente de cliente y la función no se puede importar sin arrastrar React.
const TIPOS_SOCIEDAD = new Set(['spa', 'sa', 's.a.', 'ltda', 'ltda.', 'limitada', 'eirl', 'e.i.r.l.'])

function sugerirSlug(nombre: string) {
  const sinTildes = nombre.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  return sinTildes
    .split(/\s+/)
    .filter(parte => parte && !TIPOS_SOCIEDAD.has(parte))
    .join('')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 24)
}

assert.equal(sugerirSlug('Alma Outdoor SpA'), 'almaoutdoor')
assert.equal(sugerirSlug('Olimpo Aventura SpA'), 'olimpoaventura')
assert.equal(sugerirSlug('Parapente RAOS'), 'parapenteraos')
assert.equal(sugerirSlug('Turismo Ñuble Ltda.'), 'turismonuble')
assert.equal(sugerirSlug('Buceo & Mar EIRL'), 'buceomar')

// El que rompía con una expresión suelta: "sa" dentro de una palabra NO se toca
assert.equal(sugerirSlug('Casa Grande'), 'casagrande')
assert.equal(sugerirSlug('Salto Alto'), 'saltoalto')
assert.equal(sugerirSlug('Spa del Valle'), 'delvalle')   // acá "Spa" sí es palabra suelta

// Nunca deja caracteres que no sirvan en un subdominio
assert.match(sugerirSlug('Río Azul 2000 ® S.A.'), /^[a-z0-9]+$/)
assert.equal(sugerirSlug('Río Azul 2000 ® S.A.'), 'rioazul2000')
assert.ok(sugerirSlug('Nombre larguisimo de una empresa de turismo aventura').length <= 24)

console.log('slug ok')
