import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isLoginPage = path === '/login'

  // La ficha de riesgo la abre el pasajero sin sesión, con su token
  if (path.startsWith('/ficha/') || path === '/api/ficha') return NextResponse.next()

  // API pública de integración: autentica con su propio token Bearer, no con sesión.
  // Su documentación es pública para que el desarrollador del cliente la lea sin cuenta.
  if (path.startsWith('/api/v1/') || path === '/docs/api') return NextResponse.next()

  // Mercado Pago avisa los pagos sin sesión; la empresa sale del subdominio
  if (path.startsWith('/api/pagos/webhook/')) return NextResponse.next()

  // La cookie de sesión de Supabase tiene el formato sb-<project-ref>-auth-token
  const hasSession = request.cookies.getAll().some(
    (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )

  // admin.<dominio> no es una empresa: entra al panel del superadmin
  const esAdmin = (request.headers.get('host') ?? '').split('.')[0] === 'admin'

  if (!hasSession && !isLoginPage) {
    // A una llamada de API se le responde, no se le redirige: quien la hizo espera JSON
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (hasSession && isLoginPage) {
    return NextResponse.redirect(new URL(esAdmin ? '/admin' : '/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.jpg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
