import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { CONTRATO_TEXTO, CONTRATO_VERSION } from '@/lib/contrato-texto'
import { createHash } from 'node:crypto'
import { PLANES_QUE_ELIGE_EL_CLIENTE } from '@/lib/planes'

// Alta de una empresa nueva. Quien llena el formulario no tiene sesión: entra con su token.
// La evidencia (IP, navegador, versión y hash del texto) la pone el servidor, nunca el
// navegador: si la mandara el cliente no probaría nada.

const MENSAJE: Record<string, string> = {
  'link no encontrado': 'Este link ya no es válido. Pídele uno nuevo a Reservaps.',
  'este formulario ya fue enviado': 'Este formulario ya se envió. Si necesitas corregir algo, escríbenos.',
  'falta el nombre de la empresa': 'Falta el nombre de la empresa.',
  'falta el nombre de quien acepta': 'Falta el nombre de quien acepta el acuerdo.',
  'plan no válido': 'El plan elegido no es válido.',
}

export async function POST(request: NextRequest) {
  const b = await request.json()

  if (!b.acepta) {
    return NextResponse.json({ error: 'Hay que aceptar el acuerdo para continuar.' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    ''
  const userAgent = request.headers.get('user-agent') || ''

  // El texto que se firma es el de este despliegue con el nombre ya reemplazado:
  // el hash tiene que ser de lo que la persona leyó en pantalla.
  const texto = CONTRATO_TEXTO.replaceAll('{empresa}', String(b.empresa_nombre ?? '').trim() || 'la empresa')
  const hash = createHash('sha256').update(texto, 'utf8').digest('hex')

  const { error } = await supabase.rpc('onboarding_firmar', {
    p_token: b.token,
    p_empresa_nombre: b.empresa_nombre ?? '',
    p_empresa_rut: b.empresa_rut ?? '',
    p_giro: b.giro ?? '',
    p_direccion: b.direccion ?? '',
    p_comuna: b.comuna ?? '',
    p_ciudad: b.ciudad ?? '',
    p_rubro: b.rubro ?? null,
    p_sitio_web: b.sitio_web ?? '',
    p_contacto_nombre: b.contacto_nombre ?? '',
    p_contacto_cargo: b.contacto_cargo ?? '',
    p_contacto_email: b.contacto_email ?? '',
    p_contacto_telefono: b.contacto_telefono ?? '',
    p_comentarios: b.comentarios ?? '',
    p_firmante_nombre: b.firmante_nombre ?? '',
    p_firmante_rut: b.firmante_rut ?? '',
    // La base vuelve a validarlo: acá solo se evita mandar basura
    p_plan: PLANES_QUE_ELIGE_EL_CLIENTE.includes(b.plan) ? b.plan : null,
    p_texto_version: CONTRATO_VERSION,
    p_texto_hash: hash,
    p_ip: ip,
    p_user_agent: userAgent,
  })

  if (error) {
    const limpio = error.message.replace(/^.*?:\s*/, '')
    return NextResponse.json({ error: MENSAJE[limpio] ?? limpio }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
