'use client'

import { useMemo, useState } from 'react'
import { May, useJerga } from '@/lib/jerga'
import { usePermisos } from '@/lib/permisos'
import Cargando from '@/components/Cargando'
import Volver from '@/components/Volver'
import { REPORTES, type ReporteId } from './reportes'
import CuadreDia from './CuadreDia'
import ResumenPeriodo from './ResumenPeriodo'
import PorPiloto from './PorPiloto'
import PorServicio from './PorServicio'
import PorMetodoPago from './PorMetodoPago'

export default function Reporteria() {
  const j = useJerga()
  const { cargando, esAdmin, permisos } = usePermisos()
  const [elegido, setElegido] = useState<ReporteId | null>(null)

  // Solo se ofrecen los reportes que su rol le permite; el admin los ve todos
  const disponibles = useMemo(
    () => REPORTES.filter(r => esAdmin || permisos.has(r.permiso)),
    [esAdmin, permisos])

  const actual = elegido && disponibles.some(r => r.id === elegido)
    ? elegido
    : disponibles[0]?.id ?? null

  // En singular: es una tarjeta por cada uno ("Por guía", no "Por guías")
  const nombre = (titulo: string) => titulo.replace('{operador}', j.operador)

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg,#e8f2ff 0%,#d0e6ff 100%)' }}>
      <header className="sticky top-0 z-20 flex items-center gap-2 px-4 py-4"
        style={{ background: 'linear-gradient(135deg,#0d2b5c 0%,#1a4a85 100%)', boxShadow: '0 2px 12px rgba(13,43,92,0.3)' }}>
        <Volver href="/" className="text-[#7aafd4]" />
        <div className="flex-1 min-w-0">
          {disponibles.length > 1 ? (
            <select
              value={actual ?? ''}
              onChange={e => setElegido(e.target.value as ReporteId)}
              aria-label="Elegir reporte"
              className="w-full bg-transparent text-white font-extrabold text-sm text-center outline-none cursor-pointer"
            >
              {disponibles.map(r => (
                <option key={r.id} value={r.id} className="text-gray-800">{nombre(r.titulo)}</option>
              ))}
            </select>
          ) : (
            <p className="text-white font-extrabold text-sm text-center">
              {actual ? nombre(disponibles[0].titulo) : 'Reportería'}
            </p>
          )}
        </div>
        <span className="w-8 shrink-0" />
      </header>

      {cargando ? (
        <div className="py-10"><Cargando /></div>
      ) : !actual ? (
        <p className="text-center text-gray-600 py-10 px-4">
          Tu rol no tiene reportes habilitados. Pídele a un administrador que te los active en Varios &gt; Roles.
        </p>
      ) : actual === 'dia' ? <CuadreDia />
        : actual === 'periodo' ? <ResumenPeriodo />
        : actual === 'pilotos' ? <PorPiloto />
        : actual === 'servicios' ? <PorServicio />
        : <PorMetodoPago />}
    </div>
  )
}
