'use client'

import { usePathname } from 'next/navigation'

// El manual vive en la landing del producto, igual para todas las empresas.
const MANUAL = 'https://reservaps.cl/manual/'

// Ayuda al pie, en todas las pantallas de la app. Se esconde donde el manual no
// viene al caso: el login (todavía no hay sesión), la ficha que abre el pasajero
// —que no es usuario del sistema— y la documentación de la API.
export default function PieManual() {
  const path = usePathname()
  if (path === '/login' || path.startsWith('/ficha/') || path.startsWith('/docs/')) return null

  return (
    <footer className="py-5 px-5 text-center">
      <a
        href={MANUAL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#2e6db4] bg-white/70 hover:bg-white border border-[#b0cce8] hover:border-[#2e6db4] rounded-full px-4 py-2 transition-colors"
      >
        <span aria-hidden>📖</span>
        Manual del sistema
        <span aria-hidden className="text-xs opacity-70">↗</span>
      </a>
    </footer>
  )
}
