// Cómo leer los eventos del calendario de cada empresa.
//
// Nadie escribe sus eventos igual: "Karina Jara x 2 (12:00)" en una, "2 x Karina -
// 56912345678" en otra. La empresa elige su formato en Varios > Google Calendar y
// ve el resultado sobre sus propios eventos antes de guardar.

export type Pasajero = {
  nombre: string; edad: number | null; peso: number | null
  sin_camara: boolean; camara_normal: boolean; camara_360: boolean; cumpleanero: boolean
}

export type Leido = {
  nombre: string
  cantidad: number
  telefono: string | null
  abono: number | null
  horaStr: string | null
  pasajeros: Pasajero[]
  // Lo que no se pudo leer del título: la pantalla de importación lo marca para revisar
  dudoso: boolean
}

export const PLANTILLAS = [
  {
    id: 'raos',
    nombre: 'Nombre x cantidad (hora)',
    ejemplo: 'Karina Jara x 2 (12:00)',
    patron: '{nombre} x {cantidad} ({hora})',
  },
  {
    id: 'cantidad_primero',
    nombre: 'Cantidad x nombre',
    ejemplo: '2 x Karina Jara',
    patron: '{cantidad} x {nombre}',
  },
  {
    id: 'con_telefono',
    nombre: 'Nombre, cantidad y teléfono',
    ejemplo: 'Karina Jara 2p 56912345678',
    patron: '{nombre} {cantidad}p {telefono}',
  },
  {
    id: 'solo_nombre',
    nombre: 'Solo el nombre',
    ejemplo: 'Karina Jara',
    patron: '{nombre}',
  },
  {
    id: 'libre',
    nombre: 'El mío (lo escribo yo)',
    ejemplo: '{nombre} - {cantidad} personas - {telefono}',
    patron: '',
  },
] as const

export type PlantillaId = (typeof PLANTILLAS)[number]['id']

const CAMPOS: Record<string, string> = {
  nombre: '(?<nombre>.+?)',
  cantidad: '(?<cantidad>\\d+)',
  telefono: '(?<telefono>[\\d+ ]{8,})',
  hora: '(?<hora>\\d{1,2}:\\d{2})',
}

// "{nombre} x {cantidad} ({hora})" -> expresión regular con grupos con nombre.
// Lo que no es campo se toma literal, y los espacios aceptan de más o de menos.
export function patronARegex(patron: string): RegExp | null {
  const partes = patron.split(/(\{[a-z]+\})/i).filter(Boolean)
  if (!partes.some(p => /^\{[a-z]+\}$/i.test(p))) return null
  let fuente = ''
  for (const [i, parte] of partes.entries()) {
    const campo = parte.match(/^\{([a-z]+)\}$/i)?.[1]?.toLowerCase()
    if (campo) {
      if (!CAMPOS[campo]) return null
      // El nombre es perezoso para no comerse lo que viene después ("x 2"), salvo
      // cuando cierra la plantilla: ahí se lleva el resto del título.
      fuente += campo === 'nombre' && i === partes.length - 1 ? '(?<nombre>.+)' : CAMPOS[campo]
    } else {
      fuente += parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')
    }
  }
  return new RegExp('^\\s*' + fuente + '\\s*', 'i')
}

// ── Cámara y pasajeros: emojis en la línea de cada persona ────────────────────
function camaraDe(texto: string) {
  const tiene360 = /📽️|📹|🎥|🎬/.test(texto)
  const tieneNormal = /📷|📸/.test(texto)
  const cumple = /🥳|🎂|🎁|🎈/.test(texto)
  if (cumple || tiene360) return { sin_camara: false, camara_normal: false, camara_360: true }
  if (tieneNormal) return { sin_camara: false, camara_normal: true, camara_360: false }
  return { sin_camara: true, camara_normal: false, camara_360: false }
}

// La descripción del evento, línea por línea. Las líneas que empiezan con "-" son
// personas ("-Ana Pérez 31 años 62 kg 📸"); también se busca el abono y el teléfono.
export function leerDescripcion(desc: string) {
  const pasajeros: Pasajero[] = []
  let abono: number | null = null
  let telefono: string | null = null

  for (const linea of desc.split('\n').map(l => l.trim()).filter(Boolean)) {
    if (linea.startsWith('-')) {
      const texto = linea.slice(1).trim()
      const m = texto.match(/^(.+?)\s+(\d+)\s*años?\s+(\d+)\s*kg/i)
      if (m) {
        pasajeros.push({
          nombre: m[1].trim(),
          edad: parseInt(m[2], 10),
          peso: parseInt(m[3], 10),
          ...camaraDe(texto),
          cumpleanero: /🥳|🎂|🎁|🎈/.test(texto),
        })
        continue
      }
      // Sin edad ni peso igual es una persona: el nombre basta
      const soloNombre = texto.replace(/[^\p{L}\s.'-]/gu, '').trim()
      if (soloNombre) {
        pasajeros.push({
          nombre: soloNombre, edad: null, peso: null,
          ...camaraDe(texto), cumpleanero: /🥳|🎂|🎁|🎈/.test(texto),
        })
      }
    }

    const mAbono = linea.match(/abono\s*:?\s*\$?\s*([\d.,]+)/i)
    if (mAbono) abono = parseInt(mAbono[1].replace(/[.,]/g, ''), 10) || null

    const mTel = linea.match(/(?:tel[eé]fono|fono|cel|whatsapp)\s*:?\s*([\d+ ]{8,})/i)
    if (mTel) telefono = mTel[1].replace(/\D/g, '')
  }

  return { pasajeros, abono, telefono }
}

// Lee un evento con la plantilla de la empresa. Si el título no calza, no se
// inventa nada: el nombre queda como venía y el evento se marca dudoso.
export function leerEvento(
  titulo: string,
  descripcion: string,
  plantilla: string,
  patronLibre?: string | null,
): Leido {
  const preset = PLANTILLAS.find(p => p.id === plantilla)
  const patron = plantilla === 'libre' ? (patronLibre || '') : (preset?.patron ?? '')
  const regex = patron ? patronARegex(patron) : null
  const m = regex ? titulo.match(regex) : null
  const g = m?.groups ?? {}

  const { pasajeros, abono, telefono } = leerDescripcion(descripcion)
  const cantidadLeida = g.cantidad ? parseInt(g.cantidad, 10) : null

  return {
    nombre: (g.nombre ?? titulo).trim(),
    // Si el título no dice cuántos, mandan las personas de la descripción
    cantidad: cantidadLeida ?? (pasajeros.length || 1),
    telefono: g.telefono ? g.telefono.replace(/\D/g, '') : telefono,
    abono,
    horaStr: g.hora ?? null,
    pasajeros,
    dudoso: !m,
  }
}
