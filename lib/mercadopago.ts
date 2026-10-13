import { createAdminClient } from './supabase-server'

const MP = 'https://api.mercadopago.com'

export type Pasarela = { empresa_id: string; public_key: string | null; access_token: string; activo: boolean }

// Credenciales de Mercado Pago de una empresa. Solo las lee el servidor.
export async function pasarelaDe(empresaId: string) {
  const { data } = await createAdminClient()
    .from('pasarelas_pago')
    .select('empresa_id, public_key, access_token, activo')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  return (data as Pasarela | null) ?? null
}

export async function mpFetch(token: string, ruta: string, init?: RequestInit) {
  const res = await fetch(`${MP}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const cuerpo = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, cuerpo }
}

// Comprueba que el token sirva y devuelve a quién pertenece la cuenta
export const cuentaMp = (token: string) => mpFetch(token, '/users/me')
