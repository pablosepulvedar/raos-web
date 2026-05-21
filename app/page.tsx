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
    fondo: '#4fa3ff',
    texto: '#fff',
    subtexto: '#dceeff',
  },
  {
    href: '/reservas',
    emoji: '📅',
    titulo: 'Reservas',
    descripcion: 'Ver y gestionar reservas',
    fondo: '#ffd700',
    texto: '#0d2b5c',
    subtexto: '#2a4f85',
  },
  {
    href: '/pilotos',
    emoji: '🪂',
    titulo: 'Pilotos',
    descripcion: 'Ver y gestionar pagos de pilotos',
    fondo: '#2e6db4',
    texto: '#fff',
    subtexto: '#c8ddf5',
  },
  {
    href: '/varios',
    emoji: '⚙️',
    titulo: 'Varios',
    descripcion: 'Horarios, valores y roles',
    fondo: '#0d2b5c',
    texto: '#fff',
    subtexto: '#7aafd4',
  },
]

export default function Home() {
  const router = useRouter()
  const [userName, setUserName] = useState('Usuario')

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.auth.getUser()
        if (error || !data.user) return

        const { data: profile } = await supabase
          .from('perfiles')
          .select('nombre')
          .eq('id', data.user.id)
          .single()

        setUserName(profile?.nombre || data.user.email?.split('@')[0] || 'Usuario')
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
    <div className="min-h-screen bg-[#f0f4f8]">
      {/* Header */}
      <header className="bg-[#0d2b5c] pt-10 pb-7 px-6">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <div className="w-14 h-14 rounded-full border-2 border-[#ffd700] overflow-hidden shrink-0">
            <Image
              src="/logo.jpg"
              alt="RAOS Logo"
              width={56}
              height={56}
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
            className="text-[#7aafd4] text-sm hover:text-white transition-colors shrink-0"
          >
            Salir →
          </button>
        </div>
      </header>

      {/* Menú */}
      <main className="max-w-lg mx-auto px-5 pt-6 pb-8">
        <p className="text-xs font-bold text-[#1e5a96] mb-4 tracking-wider uppercase">
          Menú principal
        </p>

        <div className="flex flex-col gap-3">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{ backgroundColor: item.fondo }}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl shadow-md hover:opacity-90 transition-opacity"
            >
              <span className="text-3xl">{item.emoji}</span>
              <div>
                <p style={{ color: item.texto }} className="text-base font-bold">
                  {item.titulo}
                </p>
                <p style={{ color: item.subtexto }} className="text-xs mt-0.5">
                  {item.descripcion}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
