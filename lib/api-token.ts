import { createAdminClient } from './supabase-server'

// Web Crypto: sirve igual en el worker de Cloudflare y en node
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

export const nuevoToken = () => 'rsv_' + hex(crypto.getRandomValues(new Uint8Array(24)).buffer)

export const hashToken = async (token: string) =>
  hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))

// Lee el header Authorization: Bearer <token> y devuelve la empresa dueña
export async function empresaDelToken(request: Request) {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const admin = createAdminClient()
  const { data } = await admin.rpc('api_token', { p_hash: await hashToken(token) })
  const fila = data?.[0]
  return fila ? { admin, empresaId: fila.empresa_id as string, slug: (fila.slug as string) ?? '' } : null
}

export const urlEmpresa = (slug: string) => (process.env.NEXT_PUBLIC_TENANT_URL ?? '').replace('{slug}', slug)
