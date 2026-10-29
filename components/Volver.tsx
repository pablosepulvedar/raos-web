'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

// Botón de volver: círculo de 40px (se acierta con el dedo) que al tocarlo se
// bloquea y gira hasta que carga la otra pantalla, para que no lo aprieten dos veces.
// Sin href vuelve a la pantalla anterior del historial.
export default function Volver({ href, className = 'text-white' }: { href?: string; className?: string }) {
  const router = useRouter()
  const [yendo, setYendo] = useState(false)
  const cls = `shrink-0 w-10 h-10 rounded-full border-2 border-current/40 bg-white/10 flex items-center justify-center text-lg leading-none hover:bg-white/20 active:scale-95 transition ${yendo ? 'pointer-events-none opacity-70' : ''} ${className}`
  const contenido = yendo
    ? <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" role="status" aria-label="Cargando" />
    : <span aria-hidden="true">←</span>

  if (!href) {
    return (
      <button type="button" aria-label="Volver" disabled={yendo} className={cls}
        onClick={() => { setYendo(true); router.back() }}>
        {contenido}
      </button>
    )
  }
  return (
    <Link href={href} aria-label="Volver" aria-disabled={yendo} className={cls} onClick={() => setYendo(true)}>
      {contenido}
    </Link>
  )
}
