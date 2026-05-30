import { google } from 'googleapis'
import { NextRequest, NextResponse } from 'next/server'

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
)

// Detecta cámara por emoji en la línea del pasajero
function parseCamara(text: string): { sin_camara: boolean; camara_normal: boolean; camara_360: boolean } {
  const tiene360 = /🎥|📹|📽️|🎬/.test(text)
  const tieneNormal = /📸|📷/.test(text)
  const esCumpleanero = /🥳|🎂|🎁|🎈/.test(text)
  if (esCumpleanero || tiene360) return { sin_camara: false, camara_normal: false, camara_360: true }
  if (tieneNormal)               return { sin_camara: false, camara_normal: true,  camara_360: false }
  return                                { sin_camara: true,  camara_normal: false, camara_360: false }
}

function parseDescripcion(desc: string) {
  const pasajeros: Array<{
    nombre: string; edad: number|null; peso: number|null
    sin_camara: boolean; camara_normal: boolean; camara_360: boolean; cumpleanero: boolean
  }> = []
  let abono: number|null = null

  const lineas = desc.split('\n').map(l => l.trim()).filter(Boolean)

  for (const linea of lineas) {
    // Línea de pasajero: empieza con -
    // Formato: -Nombre Apellido 23 años 75 kg(📸) o -Nombre Apellido 48 años 76 kg 🥳
    if (linea.startsWith('-')) {
      const texto = linea.slice(1).trim()
      const match = texto.match(/^(.+?)\s+(\d+)\s+años\s+(\d+)\s*kg/i)
      if (match) {
        const camara = parseCamara(texto)
        const cumpleanero = /🥳|🎂|🎁|🎈/.test(texto)
        pasajeros.push({
          nombre: match[1].trim(),
          edad: parseInt(match[2], 10),
          peso: parseInt(match[3], 10),
          ...camara,
          cumpleanero,
        })
      }
    }

    // Línea de abono: "Abono 20.000" o "Abono 20000"
    const abonoMatch = linea.match(/abono\s+([\d.,]+)/i)
    if (abonoMatch) {
      abono = parseInt(abonoMatch[1].replace(/[.,]/g, ''), 10) || null
    }
  }

  return { pasajeros, abono }
}

function parseTitulo(titulo: string) {
  // Formato: "Karina Jara x 2(12:00)" o "Karina Jara x 2 (12:00)"
  const match = titulo.match(/^(.+?)\s+x\s*(\d+)\s*[^\d(]*\((\d{1,2}:\d{2})\)/i)
  if (!match) return null
  return {
    nombre: match[1].trim(),
    cantidad: parseInt(match[2], 10),
    horaStr: match[3], // "12:00"
  }
}

export async function GET(req: NextRequest) {
  const accessToken  = req.cookies.get('g_access_token')?.value
  const refreshToken = req.cookies.get('g_refresh_token')?.value

  if (!accessToken && !refreshToken) {
    return NextResponse.json({ error: 'no_auth' }, { status: 401 })
  }

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  const fecha = req.nextUrl.searchParams.get('fecha') // YYYY-MM-DD
  if (!fecha) return NextResponse.json({ error: 'falta fecha' }, { status: 400 })

  const timeMin = new Date(`${fecha}T00:00:00`)
  const timeMax = new Date(`${fecha}T23:59:59`)

  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    })

    const eventos = (data.items || []).map(ev => {
      const titulo = ev.summary || ''
      const desc   = ev.description || ''
      const parsed = parseTitulo(titulo)
      const { pasajeros, abono } = parseDescripcion(desc)

      return {
        googleId:  ev.id,
        titulo,
        fecha,
        horaStr:   parsed?.horaStr ?? null,
        nombre:    parsed?.nombre  ?? titulo,
        cantidad:  parsed?.cantidad ?? 1,
        abono,
        pasajeros,
      }
    })

    return NextResponse.json({ eventos })
  } catch (e: any) {
    if (e?.status === 401) return NextResponse.json({ error: 'no_auth' }, { status: 401 })
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
