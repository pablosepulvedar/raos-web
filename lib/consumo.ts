// Consumo de la infraestructura, para el panel del superadmin.
//
// Cloudflare no cobra por request de archivo estático ("Requests to static assets are
// free and unlimited"), así que las landings no aparecen acá: lo que se cuenta y se
// factura son las invocaciones de los workers.
//
// ponytail: todo sale de la GraphQL Analytics API de Cloudflare. No se guarda nada
// propio: contar requests en la base costaría una escritura por visita.

export const LIMITE_DIA = 100_000          // plan Workers Free: requests por día
export const LIMITE_SUPABASE = 500 * 1024 ** 2  // plan Supabase Free: 500 MB de base
const VENTANA_DIAS = 28                    // la zona no acepta rangos de más de 4w2d

const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql'

export type Dia = { fecha: string; requests: number }
export type Parte = { nombre: string; requests: number }
export type Consumo = {
  desde: string
  hasta: string
  dias: Dia[]
  workers: Parte[]
  hosts: Parte[]
  errores: number
  pico: number
  limiteDia: number
}

export const consumoConfigurado = () =>
  !!process.env.CLOUDFLARE_ANALYTICS_TOKEN &&
  !!process.env.CLOUDFLARE_ACCOUNT_ID &&
  !!process.env.CLOUDFLARE_ZONE_ID

export const fechaISO = (d: Date) => d.toISOString().slice(0, 10)

export function ventana(hoy = new Date()) {
  const desde = new Date(hoy)
  desde.setUTCDate(desde.getUTCDate() - (VENTANA_DIAS - 1))
  return { desde: fechaISO(desde), hasta: fechaISO(hoy) }
}

export const WORKER_BORRADO = 'Workers ya borrados'
export const OTROS_HOSTS = 'Otros (escáneres y subdominios inventados)'

// Deja una fila por cada host principal y suma el resto en una sola: los escáneres
// prueban cientos de nombres (imap, mysql, ns1...) y tapaban a las empresas.
export function agruparHosts(hosts: Parte[], principal: (host: string) => boolean): Parte[] {
  const quedan = hosts.filter(h => principal(h.nombre))
  const otros = hosts.filter(h => !principal(h.nombre)).reduce((t, h) => t + h.requests, 0)
  return otros ? [...quedan, { nombre: OTROS_HOSTS, requests: otros }] : quedan
}

type FilaWorker = { sum: { requests: number; errors: number }; dimensions: { scriptName: string; date: string } }
type FilaHost = { count: number; dimensions: { clientRequestHTTPHost: string } }

// Suma por día y por worker en una sola pasada. Separado del fetch para poder probarlo.
export function resumir(workers: FilaWorker[], hosts: FilaHost[]) {
  const porDia = new Map<string, number>()
  const porWorker = new Map<string, number>()
  let errores = 0

  for (const f of workers) {
    porDia.set(f.dimensions.date, (porDia.get(f.dimensions.date) ?? 0) + f.sum.requests)
    // Cloudflare llama __unknown__ al worker que ya no existe (los envs raos/demo/admin
    // se borraron el 2026-10-20 y siguen dentro de la ventana de 28 días)
    const w = f.dimensions.scriptName === '__unknown__' ? WORKER_BORRADO : f.dimensions.scriptName
    porWorker.set(w, (porWorker.get(w) ?? 0) + f.sum.requests)
    errores += f.sum.errors
  }

  // Cloudflare entrega el host con el puerto cuando no es el estándar. Los escáneres
  // prueban 8080, 8443 y compañía, y sin esto el mismo sitio sale partido en varias filas.
  const porHost = new Map<string, number>()
  for (const f of hosts) {
    const h = f.dimensions.clientRequestHTTPHost.replace(/:\d+$/, '')
    porHost.set(h, (porHost.get(h) ?? 0) + f.count)
  }

  const orden = (m: Map<string, number>): Parte[] =>
    [...m].map(([nombre, requests]) => ({ nombre, requests })).sort((a, b) => b.requests - a.requests)

  const dias = [...porDia].map(([fecha, requests]) => ({ fecha, requests }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  return {
    dias,
    workers: orden(porWorker),
    hosts: orden(porHost),
    errores,
    pico: dias.reduce((max, d) => Math.max(max, d.requests), 0),
  }
}

export async function consumoCloudflare(hoy = new Date()): Promise<Consumo> {
  const { desde, hasta } = ventana(hoy)
  const query = `
    query($cuenta: String!, $zona: String!, $desde: Date!, $hasta: Date!) {
      viewer {
        accounts(filter: { accountTag: $cuenta }) {
          workersInvocationsAdaptive(
            limit: 10000
            filter: { date_geq: $desde, date_leq: $hasta }
          ) { sum { requests errors } dimensions { scriptName date } }
        }
        zones(filter: { zoneTag: $zona }) {
          httpRequestsAdaptiveGroups(
            limit: 10000
            filter: { date_geq: $desde, date_leq: $hasta }
          ) { count dimensions { clientRequestHTTPHost } }
        }
      }
    }`

  const res = await fetch(GRAPHQL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_ANALYTICS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: {
        cuenta: process.env.CLOUDFLARE_ACCOUNT_ID,
        zona: process.env.CLOUDFLARE_ZONE_ID,
        desde, hasta,
      },
    }),
  })

  const d = await res.json() as {
    data?: { viewer?: { accounts?: Array<{ workersInvocationsAdaptive: FilaWorker[] }>, zones?: Array<{ httpRequestsAdaptiveGroups: FilaHost[] }> } }
    errors?: Array<{ message: string }>
  }
  if (d.errors?.length) throw new Error(d.errors[0].message)

  return {
    desde, hasta, limiteDia: LIMITE_DIA,
    ...resumir(
      d.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [],
      d.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [],
    ),
  }
}
