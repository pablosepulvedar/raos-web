'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type Empresa = { nombre: string; logo_url: string | null }

// raos.reservasps.dev / raos.<cuenta>.workers.dev / raos.localhost -> 'raos'
const slugDelHost = () => window.location.hostname.split('.')[0]

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)

  useEffect(() => {
    createClient()
      .rpc('empresa_publica', { p_slug: slugDelHost() })
      .then(({ data }) => setEmpresa(data?.[0] ?? null))
  }, [])

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password.trim()) {
      setError('Ingresa correo y contraseña')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    })

    if (error) {
      setLoading(false)
      setError(error.message)
      return
    }

    // El usuario debe pertenecer a la empresa del subdominio (superadmin se cambia a ella)
    const slug = slugDelHost()
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('es_superadmin, empresas(slug)')
      .single()
    const suEmpresa = (perfil?.empresas as unknown as { slug: string } | null)?.slug
    // Solo si el host es de una empresa (localhost u otro host: sin chequeo, RLS igual aísla)
    if (empresa && suEmpresa !== slug) {
      const cambio = perfil?.es_superadmin
        ? await supabase.rpc('cambiar_empresa', { p_slug: slug })
        : { error: true }
      if (cambio.error) {
        await supabase.auth.signOut()
        setLoading(false)
        setError('Este usuario no pertenece a esta empresa')
        return
      }
    }
    setLoading(false)

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#0d2b5c] flex flex-col items-center justify-center px-8 py-10">
      {/* Logo */}
      <div className="flex flex-col items-center mb-9">
        <div className="w-40 h-40 rounded-full border-4 border-[#ffd700] overflow-hidden shadow-[0_0_30px_rgba(255,215,0,0.35)]">
          {empresa?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={empresa.logo_url} alt={`Logo ${empresa.nombre}`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-white/10 flex items-center justify-center text-[#ffd700] text-6xl font-extrabold">
              {empresa?.nombre?.[0] ?? ''}
            </div>
          )}
        </div>
        <h1 className="text-[#ffd700] text-2xl font-extrabold mt-4 tracking-wide uppercase">
          {empresa?.nombre ?? ''}
        </h1>
        <p className="text-[#a8c4e0] text-sm mt-1">Sistema de gestión de reservas</p>
      </div>

      {/* Formulario */}
      <form
        onSubmit={login}
        className="w-full max-w-sm bg-white/7 backdrop-blur border border-white/12 rounded-2xl p-6"
        style={{ background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.12)' }}
      >
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-400/40 text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        <label className="block text-[#a8c4e0] text-xs font-bold mb-1.5 tracking-wider uppercase">
          Correo
        </label>
        <input
          type="email"
          placeholder="correo@ejemplo.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 px-4 py-3.5 rounded-xl text-white placeholder-white/30 text-base outline-none focus:border-[#ffd700]/60 transition-colors"
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        />

        <label className="block text-[#a8c4e0] text-xs font-bold mb-1.5 tracking-wider uppercase">
          Contraseña
        </label>
        <input
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-6 px-4 py-3.5 rounded-xl text-white placeholder-white/30 text-base outline-none focus:border-[#ffd700]/60 transition-colors"
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#ffd700] text-[#0d2b5c] font-extrabold text-base py-4 rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-70"
        >
          {loading ? 'Ingresando...' : 'Iniciar sesión'}
        </button>
      </form>

      {empresa && <p className="text-white/20 text-xs mt-8">© {empresa.nombre}</p>}
    </div>
  )
}
