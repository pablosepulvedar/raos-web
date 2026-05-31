'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const menuItems = [
  {
    href: '/usuarios',
    emoji: '👥',
    titulo: 'Usuarios',
    descripcion: 'Agregar y gestionar usuarios',
    from: '#4fa3ff',
    to: '#2e6db4',
    texto: '#fff',
    subtexto: '#dceeff',
    sombra: 'rgba(79,163,255,0.35)',
  },
  {
    href: '/reservas',
    emoji: '📅',
    titulo: 'Reservas',
    descripcion: 'Ver y gestionar reservas',
    from: '#ffd700',
    to: '#e6a800',
    texto: '#0d2b5c',
    subtexto: '#2a4f85',
    sombra: 'rgba(255,215,0,0.35)',
  },
  {
    href: '/pilotos',
    emoji: '🪂',
    titulo: 'Pilotos',
    descripcion: 'Ver y gestionar pagos de pilotos',
    from: '#2e6db4',
    to: '#1a4a85',
    texto: '#fff',
    subtexto: '#c8ddf5',
    sombra: 'rgba(46,109,180,0.4)',
  },
  {
    href: '/varios',
    emoji: '⚙️',
    titulo: 'Varios',
    descripcion: 'Horarios, valores y roles',
    from: '#1a4a85',
    to: '#0d2b5c',
    texto: '#fff',
    subtexto: '#7aafd4',
    sombra: 'rgba(13,43,92,0.4)',
  },
  {
    href: '/calendar',
    emoji: '🗓️',
    titulo: 'Importar Calendar',
    descripcion: 'Importar reservas desde Google Calendar',
    from: '#34a853',
    to: '#1e7e34',
    texto: '#fff',
    subtexto: '#c8f0d4',
    sombra: 'rgba(52,168,83,0.35)',
  },
  {
    href: '/reporte',
    emoji: '📊',
    titulo: 'Cuadre del día',
    descripcion: 'Reporte diario de ingresos, pagos y pilotos',
    from: '#b45309',
    to: '#78350f',
    texto: '#fff',
    subtexto: '#fde68a',
    sombra: 'rgba(180,83,9,0.35)',
    adminOnly: true,
  },
]

const ROLES_RESTRINGIDOS = ['piloto', 'coordinador']

export default function Home() {
  const router = useRouter()
  const [userName, setUserName] = useState('Usuario')
  const [esAdmin, setEsAdmin] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.auth.getUser()
        if (error || !data.user) return

        const { data: profile } = await supabase
          .from('perfiles')
          .select('nombre, perfil_roles(roles(nombre))')
          .eq('id', data.user.id)
          .single()

        setUserName(profile?.nombre || data.user.email?.split('@')[0] || 'Usuario')

        const roles: string[] = (profile?.perfil_roles ?? [])
          .map((pr: any) => pr.roles?.nombre?.toLowerCase() ?? '')
          .filter(Boolean)

        const soloRolesRestringidos =
          roles.length > 0 && roles.every(r => ROLES_RESTRINGIDOS.includes(r))
        setEsAdmin(!soloRolesRestringidos)
      } catch {
        // Sin acción
      }
    }

    fetchUser()
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #e8f2ff 0%, #d0e6ff 100%)' }}>
      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #0d2b5c 0%, #1a4a85 100%)' }} className="pt-10 pb-8 px-6 shadow-lg">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <div className="w-16 h-16 rounded-full border-[3px] border-[#ffd700] overflow-hidden shrink-0 shadow-md">
            <Image
              src="/logo.jpg"
              alt="RAOS Logo"
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <p className="text-[#ffd700] text-xs font-bold tracking-widest uppercase">
              Parapente RAOS
            </p>
            <h1 className="text-white text-xl font-extrabold mt-0.5">Bienvenido</h1>
            <p className="text-[#7aafd4] text-sm">{userName}</p>
          </div>
          <button
            onClick={signOut}
            className="text-[#7aafd4] text-sm hover:text-white transition-colors shrink-0 border border-[#7aafd4]/40 hover:border-white/60 px-3 py-1.5 rounded-lg"
          >
            Salir →
          </button>
        </div>
      </header>

      {/* Menú */}
      <main className="max-w-lg mx-auto px-5 pt-6 pb-8">
        <p className="text-xs font-bold text-[#2e6db4] mb-4 tracking-wider uppercase">
          Menú principal
        </p>

        <div className="flex flex-col gap-3">
          {menuItems.filter(item => !((item.href === '/usuarios' || (item as any).adminOnly) && !esAdmin)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                background: `linear-gradient(135deg, ${item.from} 0%, ${item.to} 100%)`,
                boxShadow: `0 4px 16px ${item.sombra}`,
              }}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl hover:opacity-95 hover:scale-[1.01] transition-all duration-150"
            >
              <span className="text-3xl">{item.emoji}</span>
              <div className="flex-1">
                <p style={{ color: item.texto }} className="text-base font-bold">
                  {item.titulo}
                </p>
                <p style={{ color: item.subtexto }} className="text-xs mt-0.5">
                  {item.descripcion}
                </p>
              </div>
              <span style={{ color: item.subtexto }} className="text-lg">›</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
