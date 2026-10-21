'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Parte = { nombre: string; requests: number }
type Cloudflare = {
  ok: boolean; error?: string
  desde?: string; hasta?: string
  dias?: Array<{ fecha: string; requests: number }>
  workers?: Parte[]; hosts?: Parte[]
  errores?: number; pico?: number; limiteDia?: number
}
type Supa = {
  ok: boolean; error?: string
  total?: number; limite: number
  tablas?: Array<{ tabla: string; bytes: number; filas: number }>
}

const miles = (n: number) => n.toLocaleString('es-CL')
// Las tablas chicas pesan bastante menos de 1 MB: redondear a MB las dejaba todas en 0
const peso = (b: number) => {
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`
  return `${Math.round(b / 1024)} KB`
}

const caja = 'bg-white rounded-xl shadow-sm p-5 mb-5'

// Una barra por fila: comparar de un vistazo sin traer una librería de gráficos
function Barras({ datos, maximo, formato }: {
  datos: Parte[]; maximo: number; formato?: (n: number) => string
}) {
  if (datos.length === 0) return <p className="text-sm text-gray-500">Sin datos todavía.</p>
  return (
    <div className="space-y-2">
      {datos.map(d => (
        <div key={d.nombre} className="flex items-center gap-3 text-sm">
          <span className="w-48 shrink-0 truncate text-[#0d2b5c]" title={d.nombre}>{d.nombre}</span>
          <span className="flex-1 bg-[#e8f0f7] rounded h-4 overflow-hidden">
            <span
              className="block bg-[#1e5a96] h-full rounded"
              style={{ width: `${maximo ? Math.max(2, (d.requests / maximo) * 100) : 0}%` }}
            />
          </span>
          <span className="w-24 text-right tabular-nums text-gray-600">
            {(formato ?? miles)(d.requests)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function Consumo() {
  const [cf, setCf] = useState<Cloudflare | null>(null)
  const [sb, setSb] = useState<Supa | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    fetch('/api/superadmin/consumo')
      .then(r => r.json())
      .then(d => { setCf(d.cloudflare); setSb(d.supabase) })
      .finally(() => setCargando(false))
  }, [])

  const pico = cf?.pico ?? 0
  const limite = cf?.limiteDia ?? 100_000
  const usoPico = Math.min(100, (pico / limite) * 100)
  const usoDb = sb?.total ? Math.min(100, (sb.total / sb.limite) * 100) : 0

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#0d2b5c] px-5 py-5 flex items-center gap-4">
        <Link href="/admin" className="text-white text-lg font-semibold hover:opacity-80">← Volver</Link>
        <h1 className="text-white text-xl font-bold flex-1 text-center">📊 Consumo</h1>
        <div className="w-16" />
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">
        {cargando && <p className="text-gray-500">Consultando…</p>}

        {cf && !cf.ok && (
          <div className={caja}>
            <p className="text-[#0d2b5c] font-bold mb-1">Falta conectar la analítica de Cloudflare</p>
            {cf.error === 'sin_token' ? (
              <div className="text-sm text-gray-600 space-y-2">
                <p>
                  Crea un token en Cloudflare (Mi perfil → API Tokens → Create Token → Custom)
                  con estos permisos de solo lectura:
                </p>
                <ul className="list-disc pl-5">
                  <li><b>Account</b> · Account Analytics · <i>Read</i></li>
                  <li><b>Zone</b> · Analytics · <i>Read</i> (zona reservaps.cl)</li>
                </ul>
                <p>Después, en el proyecto:</p>
                <pre className="bg-[#0d2b5c] text-white rounded-lg p-3 text-xs overflow-x-auto">
{`npx wrangler secret put CLOUDFLARE_ANALYTICS_TOKEN
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID
npx wrangler secret put CLOUDFLARE_ZONE_ID`}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-red-700">{cf.error}</p>
            )}
          </div>
        )}

        {cf?.ok && (
          <>
            <div className={caja}>
              <p className="text-[#0d2b5c] font-bold">Día de mayor consumo</p>
              <p className="text-sm text-gray-500 mb-3">
                Del {cf.desde} al {cf.hasta}. El plan gratis da {miles(limite)} requests al día.
              </p>
              <p className="text-3xl font-bold text-[#0d2b5c] tabular-nums">
                {miles(pico)} <span className="text-base font-normal text-gray-500">de {miles(limite)}</span>
              </p>
              <div className="bg-[#e8f0f7] rounded h-3 mt-3 overflow-hidden">
                <div
                  className={`h-full rounded ${usoPico > 80 ? 'bg-red-500' : 'bg-[#1e5a96]'}`}
                  style={{ width: `${Math.max(1, usoPico)}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {usoPico < 1 ? 'Menos del 1%' : `${usoPico.toFixed(1)}%`} del tramo gratis.
                {cf.errores ? ` ${miles(cf.errores)} errores en el periodo.` : ''}
              </p>
            </div>

            <div className={caja}>
              <p className="text-[#0d2b5c] font-bold mb-1">Por sistema</p>
              <p className="text-sm text-gray-500 mb-3">
                Invocaciones de cada worker: esto es lo que se factura. Las landings no
                aparecen porque los archivos estáticos no cuentan ni se cobran.
              </p>
              <Barras datos={cf.workers ?? []} maximo={cf.workers?.[0]?.requests ?? 0} />
            </div>

            <div className={caja}>
              <p className="text-[#0d2b5c] font-bold mb-1">Por empresa</p>
              <p className="text-sm text-gray-500 mb-3">
                Visitas a cada subdominio. Acá sí entran imágenes y archivos, así que los
                números son más altos que los de arriba: sirven para comparar entre
                empresas, no para calcular la cuenta.
              </p>
              <Barras datos={cf.hosts ?? []} maximo={cf.hosts?.[0]?.requests ?? 0} />
            </div>

            <div className={caja}>
              <p className="text-[#0d2b5c] font-bold mb-3">Día a día</p>
              <Barras
                datos={(cf.dias ?? []).map(d => ({ nombre: d.fecha, requests: d.requests }))}
                maximo={pico}
              />
            </div>
          </>
        )}

        <div className={caja}>
          <p className="text-[#0d2b5c] font-bold mb-1">Base de datos</p>
          {sb?.ok ? (
            <>
              <p className="text-sm text-gray-500 mb-3">
                El plan gratis de Supabase da {peso(sb.limite)}.
              </p>
              <p className="text-3xl font-bold text-[#0d2b5c] tabular-nums">
                {peso(sb.total ?? 0)} <span className="text-base font-normal text-gray-500">de {peso(sb.limite)}</span>
              </p>
              <div className="bg-[#e8f0f7] rounded h-3 mt-3 mb-5 overflow-hidden">
                <div
                  className={`h-full rounded ${usoDb > 80 ? 'bg-red-500' : 'bg-[#1e5a96]'}`}
                  style={{ width: `${Math.max(1, usoDb)}%` }}
                />
              </div>
              <Barras
                datos={(sb.tablas ?? []).map(t => ({ nombre: t.tabla, requests: t.bytes }))}
                maximo={sb.tablas?.[0]?.bytes ?? 0}
                formato={peso}
              />
            </>
          ) : (
            <p className="text-sm text-gray-600">
              Falta aplicar la migración: <code>npm run db:push</code> crea la función{' '}
              <code>sa_uso_db()</code> que mide la base.
              {sb?.error && (
                <span className="block text-xs text-gray-400 mt-1">{sb.error}</span>
              )}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
