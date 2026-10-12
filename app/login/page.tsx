'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type Empresa = { nombre: string; logo_url: string | null }

// Credenciales visibles del demo (las crea supabase/migrations/20261010120000_usuarios_demo.sql)
const USUARIOS_PRUEBA = [
  { email: 'demo1@demo.cl', rol: 'Administrador' },
  { email: 'demo2@demo.cl', rol: 'Coordinador' },
  { email: 'demo3@demo.cl', rol: 'Piloto' },
]

// raos.reservasps.dev / raos.<cuenta>.workers.dev / raos.localhost -> 'raos'
const slugDelHost = () => window.location.hostname.split('.')[0]

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [slug, setSlug] = useState('')
  const [verPrueba, setVerPrueba] = useState(false)
  const [verPassword, setVerPassword] = useState(false)

  const esAdmin = slug === 'admin'

  useEffect(() => {
    setSlug(slugDelHost())
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
    const { data: sesion, error } = await supabase.auth.signInWithPassword({
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
      .eq('id', sesion.user.id)
      .single()
    const suEmpresa = (perfil?.empresas as unknown as { slug: string } | null)?.slug

    // admin.<dominio> es solo del superadmin
    if (slug === 'admin' && !perfil?.es_superadmin) {
      await supabase.auth.signOut()
      setLoading(false)
      setError('Esta sección es solo para el administrador del sistema')
      return
    }
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

    router.push(esAdmin ? '/admin' : '/')
    router.refresh()
  }

  return (
    <div className="flex-1 bg-[#0d2b5c] flex flex-col items-center justify-center px-8 py-10">
      {/* Logo */}
      <div className="flex flex-col items-center mb-9">
        <div className="w-40 h-40 rounded-full border-4 border-[#ffd700] overflow-hidden shadow-[0_0_30px_rgba(255,215,0,0.35)]">
          {empresa?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={empresa.logo_url} alt={`Logo ${empresa.nombre}`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-white/10 flex items-center justify-center text-[#ffd700] text-6xl font-extrabold">
              {esAdmin ? '🛠️' : empresa?.nombre?.[0] ?? ''}
            </div>
          )}
        </div>
        <h1 className="text-[#ffd700] text-2xl font-extrabold mt-4 tracking-wide uppercase">
          {esAdmin ? 'Administración' : empresa?.nombre ?? ''}
        </h1>
        <div className="relative flex items-center gap-2 mt-1">
          <p className="text-[#a8c4e0] text-sm">
            {esAdmin ? 'Panel de empresas' : 'Sistema de gestión de reservas'}
          </p>
          {slug === 'demo' && (
            <button
              type="button"
              onClick={() => setVerPrueba((v) => !v)}
              aria-label="Usuarios de prueba"
              className="w-5 h-5 shrink-0 rounded-full border border-[#ffd700] text-[#ffd700] text-xs font-bold leading-none hover:bg-[#ffd700] hover:text-[#0d2b5c] transition-colors"
            >
              ?
            </button>
          )}
          {verPrueba && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 z-10 rounded-xl border border-[#ffd700]/40 bg-[#0d2b5c] p-4 text-left shadow-xl">
              <p className="text-[#ffd700] text-xs font-bold uppercase tracking-wider mb-2">Usuarios de prueba</p>
              <p className="text-[#a8c4e0] text-xs mb-3">Toca uno para entrar con él. Contraseña: <span className="text-white font-mono">123456</span></p>
              {USUARIOS_PRUEBA.map((u) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => {
                    setEmail(u.email)
                    setPassword('123456')
                    setVerPrueba(false)
                  }}
                  className="w-full text-left px-3 py-2 mb-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <span className="block text-white text-sm font-mono">{u.email}</span>
                  <span className="block text-[#a8c4e0] text-xs">{u.rol}</span>
                </button>
              ))}
            </div>
          )}
        </div>
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
        <div className="relative mb-6">
          <input
            type={verPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3.5 pr-12 rounded-xl text-white placeholder-white/30 text-base outline-none focus:border-[#ffd700]/60 transition-colors"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          />
          <button
            type="button"
            onClick={() => setVerPassword((v) => !v)}
            aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#a8c4e0] hover:text-[#ffd700] transition-colors"
          >
            {verPassword ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
                <path d="M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 9 7 0 .9-.9 2.4-2.4 3.8M6.3 7.2C4 8.7 3 10.5 3 12c0 2.5 4 7 9 7 1.4 0 2.6-.3 3.7-.8" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 12s4-7 9-7 9 7 9 7-4 7-9 7-9-7-9-7z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            )}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#ffd700] text-[#0d2b5c] font-extrabold text-base py-4 rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-70"
        >
          {loading ? 'Ingresando...' : 'Iniciar sesión'}
        </button>
      </form>

      {(empresa || esAdmin) && (
        <p className="text-white/20 text-xs mt-8">© {esAdmin ? 'Panel de empresas' : empresa?.nombre}</p>
      )}
    </div>
  )
}
