'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { capituloDe } from '@/lib/manual'

// Ayuda al pie, en todas las pantallas de la app. Se esconde donde el manual no
// viene al caso: el login (todavía no hay sesión), la ficha que abre el pasajero
// —que no es usuario del sistema— y la documentación de la API.
export default function PieManual() {
  const path = usePathname()
  // La X lo esconde hasta recargar: a propósito sin localStorage, que vuelva a aparecer
  const [oculto, setOculto] = useState(false)
  if (oculto || path === '/login' || path.startsWith('/ficha/') || path.startsWith('/docs/')) return null

  // Flotante y chico: como pie de página sumaba alto a pantallas que ya ocupan
  // la ventana entera (min-h-screen) y obligaba a hacer scroll. Va a la
  // izquierda porque a la derecha está el botón + de varias pantallas.
  return (
    <div className="print:hidden fixed bottom-5 left-4 z-20 inline-flex items-center text-xs font-semibold text-[#2e6db4] bg-white/80 backdrop-blur hover:bg-white border border-[#b0cce8] hover:border-[#2e6db4] rounded-full shadow-sm opacity-80 hover:opacity-100 transition">
      <a
        href={capituloDe(path)}
        target="_blank"
        rel="noopener noreferrer"
        title="Abre el manual en el capítulo de esta pantalla"
        className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5"
      >
        <span aria-hidden className="w-4 h-4 rounded-full bg-[#2e6db4] text-white text-[10px] leading-4 text-center font-bold">?</span>
        Ayuda
      </a>
      <button
        onClick={() => setOculto(true)}
        aria-label="Esconder la ayuda"
        title="Esconder (vuelve al recargar)"
        className="pl-1 pr-2.5 py-1.5 text-[#7aafd4] hover:text-[#0d2b5c]"
      >
        ✕
      </button>
    </div>
  )
}
