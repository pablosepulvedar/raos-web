'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type Cuenta = { estado: string; vence: string; suspende: string }

// Lo que paga la empresa por la plataforma (ver /admin/cobros). Vencida: franja
// amarilla 7 días. Después: la app se suspende, salvo para el superadmin.
// ponytail: el bloqueo es de pantalla; las fichas públicas y la API siguen andando
// para no dejar botados a los pasajeros. Si hace falta cortar todo, va al RLS.
const LIBRES = ['/login', '/ficha/', '/docs', '/admin']
const fecha = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })

export default function AvisoCuenta({ children }: { children: React.ReactNode }) {
  const ruta = usePathname()
  const libre = LIBRES.some(l => ruta.startsWith(l))
  const [cuenta, setCuenta] = useState<Cuenta | null>(null)
  const [superadmin, setSuperadmin] = useState(false)

  useEffect(() => {
    if (libre) return
    const sb = createClient()
    sb.rpc('mi_cuenta').then(({ data }) => setCuenta(data?.[0] ?? null))
    sb.rpc('es_superadmin').then(({ data }) => setSuperadmin(!!data))
  }, [ruta, libre])

  if (libre || !cuenta) return <>{children}</>

  if (cuenta.estado === 'suspendida' && !superadmin) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0d2b5c] px-6 py-16">
        <div className="max-w-sm text-center">
          <p className="text-5xl mb-4">⏸️</p>
          <h1 className="text-[#ffd700] text-2xl font-extrabold mb-3">Servicio suspendido</h1>
          <p className="text-[#dceeff] mb-6">
            El plan venció el {fecha(cuenta.vence)} y no se registró el pago. Ponte al día para
            reactivar el sistema: tus reservas y fichas están guardadas.
          </p>
          <button onClick={() => createClient().auth.signOut().then(() => { window.location.href = '/login' })}
            className="px-5 py-3 rounded-xl bg-white/10 text-white font-semibold">
            Salir
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {cuenta.estado === 'vencida' && (
        <div role="alert" className="w-full bg-[#ffd700] text-[#0d2b5c] text-xs sm:text-sm font-semibold px-4 py-2 text-center">
          Tu plan venció el {fecha(cuenta.vence)}. Ponte al día antes del {fecha(cuenta.suspende)} para que el servicio no se suspenda.
        </div>
      )}
      {cuenta.estado === 'suspendida' && (
        <div className="w-full bg-red-600 text-white text-xs font-semibold px-4 py-2 text-center">
          Empresa suspendida por falta de pago (la ves porque eres superadmin).
        </div>
      )}
      {children}
    </>
  )
}
