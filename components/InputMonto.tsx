'use client'

import { useLayoutEffect, useRef } from 'react'

// Campo de dinero: solo dígitos, y se ve con punto de miles mientras se escribe
// (65000 -> 65.000). El valor que entra y sale son los dígitos sin formato, así
// que quien lo usa sigue guardando lo mismo que antes.
type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string
  onChange: (digitos: string) => void
}

export const conMiles = (digitos: string) => digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

export default function InputMonto({ value, onChange, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  // Cuántos dígitos quedaban a la izquierda del cursor: al reformatear se vuelve ahí
  const digitosAntes = useRef<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    const n = digitosAntes.current
    if (!el || n === null || document.activeElement !== el) return
    let pos = 0, vistos = 0
    while (pos < el.value.length && vistos < n) { if (/\d/.test(el.value[pos])) vistos++; pos++ }
    el.setSelectionRange(pos, pos)
    digitosAntes.current = null
  }, [value])

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="numeric"
      value={conMiles(value.replace(/\D/g, ''))}
      onChange={e => {
        const t = e.target.value
        digitosAntes.current = t.slice(0, e.target.selectionStart ?? t.length).replace(/\D/g, '').length
        onChange(t.replace(/\D/g, '').replace(/^0+(?=\d)/, ''))
      }}
    />
  )
}
