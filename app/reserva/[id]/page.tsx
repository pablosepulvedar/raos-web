'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import DetalleContent from '@/components/reserva/DetalleContent'

export default function ReservaDetallePage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="min-h-screen" style={{ background:'linear-gradient(160deg,#e8f2ff 0%,#d0e6ff 100%)' }}>
      <header className="sticky top-0 z-20 flex items-center gap-3 px-5 py-4"
        style={{ background:'linear-gradient(135deg,#0d2b5c 0%,#1a4a85 100%)', boxShadow:'0 2px 12px rgba(13,43,92,0.3)' }}>
        <Link href="/reservas" className="text-[#7aafd4] text-sm font-medium">← Volver</Link>
        <span className="text-white font-extrabold text-base flex-1 text-center">Detalle Reserva</span>
        <div className="w-14" />
      </header>
      <DetalleContent id={id} />
    </div>
  )
}
