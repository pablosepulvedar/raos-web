'use client'

import { useEffect, useState } from 'react'

// Aviso fijo del sitio de demostración. Solo aparece en el subdominio 'demo'.
export default function DemoBanner() {
  const [esDemo, setEsDemo] = useState(false)
  useEffect(() => setEsDemo(window.location.hostname.split('.')[0] === 'demo'), [])
  if (!esDemo) return null

  return (
    <div className="bg-[#ffd700] text-[#0d2b5c] text-center text-xs sm:text-sm font-semibold px-4 py-2">
      Versión de demostración: todo lo que cargues aquí se borra cada 5 días. Si te sirve el sistema, escríbenos y lo dejamos funcionando para tu empresa.
    </div>
  )
}
