// Google Calendar: una sola aplicación de Google (la de Reservaps) y una conexión
// por empresa. El operador no crea nada en Google Cloud: aprieta "Conectar",
// autoriza la lectura de su calendario y acá queda su refresh_token.
//
// ponytail: todo con fetch, sin la librería googleapis (pesa de más para el worker
// y acá se usan tres endpoints).
import { createAdminClient } from './supabase-server'

const OAUTH = 'https://oauth2.googleapis.com/token'
const CONSENTIMIENTO = 'https://accounts.google.com/o/oauth2/v2/auth'
const API = 'https://www.googleapis.com/calendar/v3'
const ALCANCES = ['https://www.googleapis.com/auth/calendar.readonly', 'email']

// ponytail: la zona es fija porque todas las empresas operan en Chile. Si algún día
// hay una afuera, guardarla en la tabla empresas y leerla acá.
export const ZONA = 'America/Santiago'

export type Conexion = {
  empresa_id: string
  refresh_token: string
  cuenta_email: string | null
  calendario_id: string
  calendario_nombre: string | null
  plantilla: string
  patron_titulo: string | null
}

export const googleConfigurado = () =>
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET && !!process.env.GOOGLE_REDIRECT_URI

export function urlDeConsentimiento(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: ALCANCES.join(' '),
    access_type: 'offline',
    prompt: 'consent',          // sin esto Google no manda refresh_token la segunda vez
    include_granted_scopes: 'true',
    state,
  })
  return `${CONSENTIMIENTO}?${p}`
}

async function pedirToken(cuerpo: Record<string, string>) {
  const res = await fetch(OAUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...cuerpo,
    }),
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(d.error_description || d.error || 'Google rechazó la autorización')
  return d as { access_token: string; refresh_token?: string; expires_in: number }
}

export const canjearCodigo = (code: string) =>
  pedirToken({ code, grant_type: 'authorization_code', redirect_uri: process.env.GOOGLE_REDIRECT_URI! })

export const accessToken = async (refresh: string) =>
  (await pedirToken({ refresh_token: refresh, grant_type: 'refresh_token' })).access_token

export async function correoDeLaCuenta(token: string) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const d = await res.json()
  return (d.email as string) ?? null
}

// ── La conexión de la empresa ─────────────────────────────────────────────────
export async function conexionDe(empresaId: string) {
  const { data } = await createAdminClient()
    .from('calendar_conexiones')
    .select('empresa_id, refresh_token, cuenta_email, calendario_id, calendario_nombre, plantilla, patron_titulo')
    .eq('empresa_id', empresaId)
    .maybeSingle()
  return (data as Conexion | null) ?? null
}

// ── Calendario ────────────────────────────────────────────────────────────────
export async function listarCalendarios(token: string) {
  const res = await fetch(`${API}/users/me/calendarList?minAccessRole=reader`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  const d = await res.json()
  return ((d.items ?? []) as Array<{ id: string; summary: string; primary?: boolean }>)
    .map(c => ({ id: c.id, nombre: c.summary, principal: !!c.primary }))
}

const partesEnZona = (iso: string) => {
  const f = new Intl.DateTimeFormat('es-CL', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso))
  const v = (t: string) => f.find(p => p.type === t)?.value ?? ''
  return { fecha: `${v('year')}-${v('month')}-${v('day')}`, hora: `${v('hour')}:${v('minute')}` }
}

export type EventoCrudo = { id: string; titulo: string; descripcion: string; horaStr: string | null; fecha: string }

type ItemGoogle = {
  id: string; summary?: string; description?: string
  start?: { dateTime?: string; date?: string }
}

function aEvento(ev: ItemGoogle): EventoCrudo & { fechaLocal: string } {
  const inicio = ev.start?.dateTime
  const local = inicio ? partesEnZona(inicio) : { fecha: ev.start?.date ?? '', hora: '' }
  return {
    id: ev.id,
    titulo: ev.summary ?? '',
    descripcion: ev.description ?? '',
    horaStr: inicio ? local.hora : null,
    fecha: local.fecha,
    fechaLocal: local.fecha,
  }
}

async function pedirEventos(token: string, calendarioId: string, p: URLSearchParams) {
  const res = await fetch(`${API}/calendars/${encodeURIComponent(calendarioId)}/events?${p}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.error?.message || 'Google no entregó los eventos')
  }
  const d = await res.json()
  return ((d.items ?? []) as ItemGoogle[]).map(aEvento)
}

// Los que vienen, para la vista previa de la plantilla: eventos reales de la empresa.
export async function eventosProximos(token: string, calendarioId: string, cuantos = 3) {
  const p = new URLSearchParams({
    timeMin: new Date(Date.now() - 86400000 * 7).toISOString(),
    singleEvents: 'true', orderBy: 'startTime', maxResults: String(cuantos * 3),
  })
  const eventos = await pedirEventos(token, calendarioId, p)
  return eventos.filter(e => e.titulo).slice(0, cuantos)
}

// Los eventos de un día. Se pide una ventana ancha en UTC y se filtra por la fecha
// local: así no se cuela el evento de las 22:00 ni se pierde el de las 09:00.
export async function eventosDelDia(token: string, calendarioId: string, fecha: string): Promise<EventoCrudo[]> {
  const desde = new Date(`${fecha}T00:00:00Z`)
  desde.setUTCDate(desde.getUTCDate() - 1)
  const hasta = new Date(`${fecha}T00:00:00Z`)
  hasta.setUTCDate(hasta.getUTCDate() + 2)

  const p = new URLSearchParams({
    timeMin: desde.toISOString(), timeMax: hasta.toISOString(),
    singleEvents: 'true', orderBy: 'startTime', maxResults: '100',
  })
  const eventos = await pedirEventos(token, calendarioId, p)
  return eventos
    .filter(ev => ev.fechaLocal === fecha)
    .map(({ id, titulo, descripcion, horaStr, fecha: f }) => ({ id, titulo, descripcion, horaStr, fecha: f }))
}
