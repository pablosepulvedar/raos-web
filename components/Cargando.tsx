// Mientras se piden los datos hay que decir "cargando", no "no hay nada": si no,
// la pantalla afirma que está vacía y un segundo después se llena sola.
export default function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6" role="status" aria-live="polite">
      <span className="w-4 h-4 rounded-full border-2 border-[#2e6db4] border-t-transparent animate-spin" />
      <span className="text-[#2e6db4] text-sm">{texto}</span>
    </div>
  )
}
