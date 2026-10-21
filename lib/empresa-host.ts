// De qué empresa habla esta petición.
//
// El subdominio es la empresa: raos.reservaps.cl -> raos. Viaja en la cabecera
// `x-empresa` de cada llamada a Supabase y mi_empresa_id() la respeta solo si
// quien pregunta pertenece a esa empresa.
//
// Así dos pestañas abiertas en dos empresas no se pisan: cada petición lleva la
// suya, en vez de compartir un único "dónde estoy" por usuario.
export function slugDelHost(host: string | null | undefined): string {
  const limpio = (host ?? '').split(':')[0].toLowerCase()
  const sub = limpio.split('.')[0]
  // `admin` y `auth` no son empresas, y sin subdominio no hay nada que decir
  if (!sub || sub === 'admin' || sub === 'auth' || sub === 'localhost' || !limpio.includes('.')) return ''
  return sub
}
