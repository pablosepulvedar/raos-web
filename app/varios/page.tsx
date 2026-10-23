import Link from 'next/link'

const menuItems = [
  { href: '/varios/horarios', icon: '🕒', label: 'Horarios', desc: 'Configuración de horarios' },
  { href: '/varios/valores', icon: '💲', label: 'Valores', desc: 'Configuración de valores' },
  { href: '/varios/roles', icon: '🛡️', label: 'Roles', desc: 'Agregar y gestionar roles' },
  { href: '/varios/metodos_pago', icon: '💳', label: 'Métodos de pago', desc: 'Formas de pago disponibles' },
  { href: '/varios/pagos', icon: '🔗', label: 'Cobro en línea', desc: 'Conecta Mercado Pago y manda links de pago' },
  { href: '/varios/calendar', icon: '📅', label: 'Google Calendar', desc: 'Conecta tu calendario y define cómo se leen tus eventos' },
  { href: '/varios/permisos', icon: '🔒', label: 'Permisos', desc: 'Qué pueden ver los pilotos' },
  { href: '/varios/bitacora', icon: '🧾', label: 'Quién hizo qué', desc: 'Quién creó, cambió o borró cada cosa' },
]

export default function Varios() {
  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#0d2b5c] px-5 py-5 flex items-center gap-4">
        <Link href="/" className="text-[#ffd700] text-lg font-semibold hover:opacity-80">← Volver</Link>
        <h1 className="text-white text-xl font-bold flex-1 text-center">⚙️ Varios</h1>
        <div className="w-16" />
      </header>

      <main className="max-w-lg mx-auto px-5 py-8 flex flex-col gap-3">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-white border border-[#d4e6f5] rounded-xl px-5 py-5 hover:bg-[#f0f7ff] transition-colors"
          >
            <p className="text-[#0d2b5c] font-bold text-base">{item.icon} {item.label}</p>
            <p className="text-[#2e6db4] text-xs mt-1">{item.desc}</p>
          </Link>
        ))}
      </main>
    </div>
  )
}
