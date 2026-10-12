'use client'

import { useState } from 'react'

const Ojo = ({ abierto }: { abierto: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    {abierto ? (
      <>
        <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
        <path d="M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 9 7 0 .9-.9 2.4-2.4 3.8M6.3 7.2C4 8.7 3 10.5 3 12c0 2.5 4 7 9 7 1.4 0 2.6-.3 3.7-.8" />
      </>
    ) : (
      <>
        <path d="M3 12s4-7 9-7 9 7 9 7-4 7-9 7-9-7-9-7z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    )}
  </svg>
)

// Campo de contraseña con el ojito para verla
export function InputPassword({ className, style, botonClassName, ...props }: React.ComponentProps<'input'> & { botonClassName?: string }) {
  const [ver, setVer] = useState(false)

  return (
    <div className="relative">
      <input {...props} type={ver ? 'text' : 'password'} className={`${className ?? ''} pr-12`} style={style} />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors ${botonClassName ?? 'text-gray-400 hover:text-[#1e5a96]'}`}
      >
        <Ojo abierto={ver} />
      </button>
    </div>
  )
}
