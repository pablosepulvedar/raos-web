'use client'

import { useEffect, useState } from 'react'

// Aviso fijo del sitio de demostración. Solo aparece en el subdominio 'demo'.
// En el teléfono va en una línea: el texto completo se abre al tocarlo.
export default function DemoBanner() {
  const [esDemo, setEsDemo] = useState(false)
  const [abierto, setAbierto] = useState(false)
  useEffect(() => setEsDemo(window.location.hostname.split('.')[0] === 'demo'), [])
  if (!esDemo) return null

  return (
    <button
      type="button"
      onClick={() => setAbierto((v) => !v)}
      aria-expanded={abierto}
      className="w-full bg-[#ffd700] text-[#0d2b5c] text-xs sm:text-sm font-semibold px-4 py-2 text-center"
    >
      {abierto ? (
        <span>
          Versión de demostración: todo lo que cargues aquí se borra cada 5 días. Si te sirve el
          sistema, escríbenos y lo dejamos funcionando para tu empresa.
        </span>
      ) : (
        <span className="flex items-center justify-center gap-1.5">
          <span className="truncate">Versión de demostración: se borra cada 5 días</span>
          <span aria-hidden className="opacity-70">▾</span>
        </span>
      )}
    </button>
  )
}
