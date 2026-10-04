'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

type Empresa = {
  id: string
  slug: string
  nombre: string
  logo_url: string | null
  color: string | null
  activa: boolean
  created_at: string
  usuarios: number
  reservas: number
  reservas_30d: number
  ultimo_login: string | null
}
type Usuario = {
  id: string
  email: string
  nombre: string
  roles: string | null
  ultimo_login: string | null
  bloqueado: boolean
}

const ROLES = ['Admin', 'Piloto', 'Coordinador']
const urlEmpresa = (slug: string) => (process.env.NEXT_PUBLIC_TENANT_URL ?? '').replace('{slug}', slug)
const fecha = (f: string | null) => (f ? new Date(f).toLocaleDateString('es-CL') : '—')

const input = 'w-full border border-[#2e6db4] rounded-lg p-3 mb-3 text-sm bg-white'
const label = 'block text-[#1e5a96] font-bold text-sm mb-1'
const btn = 'bg-[#1e5a96] text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-[#174a82] transition-colors disabled:opacity-60'
const btnSec = 'border border-[#1e5a96] text-[#1e5a96] font-semibold py-2 px-3 rounded-lg hover:bg-[#e8f0f7] transition-colors text-sm'

export default function Admin() {
  const [autorizado, setAutorizado] = useState<boolean | null>(null)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [sel, setSel] = useState<Empresa | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [creandoEmpresa, setCreandoEmpresa] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [cargando, setCargando] = useState(false)

  const cargarEmpresas = async () => {
    const { data, error } = await supabase.rpc('sa_empresas')
    if (error) return setMsg({ ok: false, texto: error.message })
    setEmpresas(data as Empresa[])
  }
  const cargarUsuarios = async (empresaId: string) => {
    const { data, error } = await supabase.rpc('sa_usuarios', { p_empresa: empresaId })
    if (error) return setMsg({ ok: false, texto: error.message })
    setUsuarios(data as Usuario[])
  }

  useEffect(() => {
    supabase.rpc('es_superadmin').then(({ data }) => {
      setAutorizado(!!data)
      if (data) cargarEmpresas()
    })
  }, [])

  const abrir = (e: Empresa) => {
    setSel(e)
    setCreandoEmpresa(false)
    setMsg(null)
    cargarUsuarios(e.id)
  }

  const ejecutar = async (fn: () => Promise<string | void>, ok: string) => {
    setCargando(true)
    setMsg(null)
    try {
      const err = await fn()
      setMsg(err ? { ok: false, texto: err } : { ok: true, texto: ok })
      return !err
    } finally {
      setCargando(false)
    }
  }

  const api = async (method: string, body: object) => {
    const res = await fetch('/api/superadmin/usuarios', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return ((await res.json()).error as string) || 'Error'
  }

  const entrarSoporte = async (slug: string) => {
    const { error } = await supabase.rpc('cambiar_empresa', { p_slug: slug })
    if (error) return setMsg({ ok: false, texto: error.message })
    window.location.href = urlEmpresa(slug)
  }

  if (autorizado === null) return <div className="p-8 text-center text-gray-500">Cargando...</div>
  if (!autorizado)
    return (
      <div className="p-8 text-center">
        <p className="text-gray-700 mb-4">Esta sección es solo para el administrador del sistema.</p>
        <Link href="/" className="text-[#1e5a96] font-semibold">← Volver</Link>
      </div>
    )

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#0d2b5c] px-5 py-5 flex items-center gap-4">
        <Link href="/" className="text-white text-lg font-semibold hover:opacity-80">← Volver</Link>
        <h1 className="text-white text-xl font-bold flex-1 text-center">🛠️ Panel de empresas</h1>
        <div className="w-16" />
      </header>

      <div className="max-w-3xl mx-auto px-5 py-5">
        {msg && (
          <div className={`mb-4 p-3 rounded-lg flex justify-between border ${msg.ok ? 'bg-green-100 border-green-400 text-green-800' : 'bg-red-100 border-red-400 text-red-800'}`}>
            <span>{msg.texto}</span>
            <button onClick={() => setMsg(null)} className="font-bold ml-2" aria-label="Cerrar">×</button>
          </div>
        )}

        {/* Resumen */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            ['Empresas activas', empresas.filter(e => e.activa).length],
            ['Usuarios', empresas.reduce((s, e) => s + Number(e.usuarios), 0)],
            ['Reservas 30 días', empresas.reduce((s, e) => s + Number(e.reservas_30d), 0)],
          ].map(([t, v]) => (
            <div key={t} className="bg-white rounded-xl p-4 shadow-sm text-center">
              <p className="text-2xl font-extrabold text-[#0d2b5c]">{v}</p>
              <p className="text-xs text-gray-500">{t}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => { setCreandoEmpresa(!creandoEmpresa); setSel(null); setMsg(null) }}
          className={`w-full mb-5 ${btn}`}
        >
          {creandoEmpresa ? 'Cancelar' : '+ Nueva empresa'}
        </button>

        {creandoEmpresa && (
          <NuevaEmpresa
            cargando={cargando}
            onCrear={async (d) => {
              const ok = await ejecutar(async () => {
                const { data: id, error } = await supabase.rpc('sa_guardar_empresa', {
                  p_id: null, p_slug: d.slug, p_nombre: d.nombre, p_logo_url: d.logo_url, p_color: d.color, p_activa: true,
                })
                if (error) return error.message.includes('duplicate') ? 'Ese slug ya existe' : error.message
                if (d.email) {
                  const err = await api('POST', { empresa_id: id, email: d.email, password: d.password, nombre: d.adminNombre, roles: ['Admin'] })
                  if (err) return `Empresa creada, pero falló el usuario admin: ${err}`
                }
              }, `Empresa "${d.nombre}" creada`)
              if (ok) { setCreandoEmpresa(false); cargarEmpresas() }
            }}
          />
        )}

        {/* Lista de empresas */}
        <div className="space-y-3 mb-6">
          {empresas.map((e) => (
            <button
              key={e.id}
              onClick={() => abrir(e)}
              className={`w-full text-left bg-white rounded-xl p-4 shadow-sm flex items-center gap-4 border-2 transition-colors ${sel?.id === e.id ? 'border-[#2e6db4]' : 'border-transparent hover:border-[#c8dcf0]'}`}
            >
              <Logo empresa={e} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#0d2b5c] truncate">
                  {e.nombre}
                  {!e.activa && <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Inactiva</span>}
                </p>
                <p className="text-xs text-gray-500">{e.slug} · desde {fecha(e.created_at)}</p>
              </div>
              <div className="text-right text-xs text-gray-600 shrink-0">
                <p>{e.usuarios} usuarios</p>
                <p>{e.reservas} reservas ({e.reservas_30d} en 30 días)</p>
                <p>Último acceso: {fecha(e.ultimo_login)}</p>
              </div>
            </button>
          ))}
        </div>

        {sel && (
          <DetalleEmpresa
            key={sel.id}
            empresa={sel}
            usuarios={usuarios}
            cargando={cargando}
            onGuardar={async (d) => {
              const ok = await ejecutar(async () => {
                const { error } = await supabase.rpc('sa_guardar_empresa', {
                  p_id: sel.id, p_slug: sel.slug, p_nombre: d.nombre, p_logo_url: d.logo_url, p_color: d.color, p_activa: d.activa,
                })
                if (error) return error.message
              }, 'Empresa actualizada')
              if (ok) { await cargarEmpresas(); setSel({ ...sel, ...d }) }
            }}
            onSoporte={() => entrarSoporte(sel.slug)}
            onCrearUsuario={async (d) => {
              const ok = await ejecutar(() => api('POST', { empresa_id: sel.id, ...d }), `Usuario ${d.email} creado`)
              if (ok) { cargarUsuarios(sel.id); cargarEmpresas() }
              return !!ok
            }}
            onPassword={(u, password) => ejecutar(() => api('PATCH', { id: u.id, password }), `Contraseña de ${u.email} cambiada`)}
            onBloquear={async (u) => {
              const ok = await ejecutar(() => api('PATCH', { id: u.id, bloquear: !u.bloqueado }), u.bloqueado ? 'Usuario desbloqueado' : 'Usuario bloqueado')
              if (ok) cargarUsuarios(sel.id)
            }}
          />
        )}
      </div>
    </div>
  )
}

function Logo({ empresa }: { empresa: Pick<Empresa, 'nombre' | 'logo_url' | 'color'> }) {
  return (
    <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-white font-extrabold text-lg"
      style={{ background: empresa.color || '#2e6db4' }}>
      {empresa.logo_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={empresa.logo_url} alt="" className="w-full h-full object-cover" />
        : empresa.nombre[0]}
    </div>
  )
}

type DatosEmpresa = { slug: string; nombre: string; logo_url: string; color: string; adminNombre: string; email: string; password: string }

function NuevaEmpresa({ cargando, onCrear }: { cargando: boolean; onCrear: (d: DatosEmpresa) => void }) {
  const [d, setD] = useState<DatosEmpresa>({ slug: '', nombre: '', logo_url: '', color: '#2e6db4', adminNombre: '', email: '', password: '' })
  const set = (k: keyof DatosEmpresa) => (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value })
  const slugValido = /^[a-z0-9-]+$/.test(d.slug)
  const adminIncompleto = !!(d.email || d.password || d.adminNombre) && !(d.email && d.password.length >= 6 && d.adminNombre)

  return (
    <form
      className="bg-[#e8f0f7] rounded-xl p-5 mb-5"
      onSubmit={(e) => { e.preventDefault(); onCrear(d) }}
    >
      <h2 className="text-[#1e5a96] font-bold text-base mb-4">Nueva empresa</h2>
      <label className={label}>Nombre</label>
      <input className={input} value={d.nombre} onChange={set('nombre')} placeholder="Alma Outdoor" required />
      <label className={label}>Slug (subdominio)</label>
      <input className={input} value={d.slug} onChange={(e) => setD({ ...d, slug: e.target.value.toLowerCase() })} placeholder="almaoutdoor" required />
      {d.slug && !slugValido && <p className="text-xs text-red-600 -mt-2 mb-3">Solo minúsculas, números y guiones</p>}
      {d.slug && slugValido && <p className="text-xs text-gray-500 -mt-2 mb-3">{urlEmpresa(d.slug)}</p>}
      <label className={label}>URL del logo (opcional)</label>
      <input className={input} value={d.logo_url} onChange={set('logo_url')} placeholder="https://..." />
      <label className={label}>Color</label>
      <input type="color" className="w-16 h-10 mb-4 rounded" value={d.color} onChange={set('color')} />

      <h3 className="text-[#1e5a96] font-bold text-sm mb-2 mt-2">Primer usuario administrador (opcional)</h3>
      <label className={label}>Nombre</label>
      <input className={input} value={d.adminNombre} onChange={set('adminNombre')} />
      <label className={label}>Email</label>
      <input className={input} type="email" value={d.email} onChange={set('email')} />
      <label className={label}>Contraseña (mín. 6)</label>
      <input className={input} type="password" value={d.password} onChange={set('password')} autoComplete="new-password" />

      <button type="submit" disabled={cargando || !slugValido || !d.nombre || adminIncompleto} className={`w-full ${btn}`}>
        {cargando ? 'Creando...' : 'Crear empresa'}
      </button>
      <p className="text-xs text-gray-500 mt-3">
        Se crean los roles Admin, Piloto y Coordinador. Horarios, valores y métodos de pago los configura la empresa en &quot;Varios&quot;.
      </p>
    </form>
  )
}

function DetalleEmpresa({ empresa, usuarios, cargando, onGuardar, onSoporte, onCrearUsuario, onPassword, onBloquear }: {
  empresa: Empresa
  usuarios: Usuario[]
  cargando: boolean
  onGuardar: (d: { nombre: string; logo_url: string; color: string; activa: boolean }) => void
  onSoporte: () => void
  onCrearUsuario: (d: { nombre: string; email: string; password: string; roles: string[] }) => Promise<boolean>
  onPassword: (u: Usuario, password: string) => void
  onBloquear: (u: Usuario) => void
}) {
  const [d, setD] = useState({ nombre: empresa.nombre, logo_url: empresa.logo_url ?? '', color: empresa.color ?? '#2e6db4', activa: empresa.activa })
  const [nuevo, setNuevo] = useState({ nombre: '', email: '', password: '', roles: ['Admin'] })
  const [mostrarNuevo, setMostrarNuevo] = useState(false)

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-4 mb-5">
        <Logo empresa={{ ...d }} />
        <div className="flex-1">
          <h2 className="font-extrabold text-[#0d2b5c] text-lg">{empresa.nombre}</h2>
          <a href={urlEmpresa(empresa.slug)} target="_blank" rel="noreferrer" className="text-xs text-[#2e6db4] underline break-all">
            {urlEmpresa(empresa.slug)}
          </a>
        </div>
        <button onClick={onSoporte} className={btnSec}>Entrar como soporte →</button>
      </div>

      {/* Datos */}
      <form onSubmit={(e) => { e.preventDefault(); onGuardar(d) }} className="bg-[#e8f0f7] rounded-xl p-4 mb-6">
        <h3 className="text-[#1e5a96] font-bold mb-3">Datos</h3>
        <label className={label}>Nombre</label>
        <input className={input} value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} required />
        <label className={label}>URL del logo</label>
        <input className={input} value={d.logo_url} onChange={(e) => setD({ ...d, logo_url: e.target.value })} placeholder="https://..." />
        <div className="flex items-center gap-6 mb-4">
          <label className="flex items-center gap-2 text-sm text-[#1e5a96] font-bold">
            Color <input type="color" className="w-12 h-9 rounded" value={d.color} onChange={(e) => setD({ ...d, color: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-sm text-[#1e5a96] font-bold">
            <input type="checkbox" checked={d.activa} onChange={(e) => setD({ ...d, activa: e.target.checked })} className="w-4 h-4" />
            Activa
          </label>
        </div>
        {!d.activa && empresa.activa && (
          <p className="text-xs text-red-700 mb-3">Al desactivarla, sus usuarios siguen pudiendo iniciar sesión pero no verán ningún dato.</p>
        )}
        <button type="submit" disabled={cargando} className={btn}>Guardar</button>
      </form>

      {/* Usuarios */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[#1e5a96] font-bold">Usuarios ({usuarios.length})</h3>
        <button onClick={() => setMostrarNuevo(!mostrarNuevo)} className={btnSec}>{mostrarNuevo ? 'Cancelar' : '+ Usuario'}</button>
      </div>

      {mostrarNuevo && (
        <form
          className="bg-[#e8f0f7] rounded-xl p-4 mb-4"
          onSubmit={async (e) => {
            e.preventDefault()
            if (await onCrearUsuario(nuevo)) { setNuevo({ nombre: '', email: '', password: '', roles: ['Admin'] }); setMostrarNuevo(false) }
          }}
        >
          <label className={label}>Nombre</label>
          <input className={input} value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} required />
          <label className={label}>Email</label>
          <input className={input} type="email" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} required />
          <label className={label}>Contraseña (mín. 6)</label>
          <input className={input} type="password" minLength={6} value={nuevo.password} onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })} autoComplete="new-password" required />
          <p className={label}>Roles</p>
          <div className="flex gap-4 mb-4">
            {ROLES.map((r) => (
              <label key={r} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={nuevo.roles.includes(r)}
                  onChange={(e) => setNuevo({ ...nuevo, roles: e.target.checked ? [...nuevo.roles, r] : nuevo.roles.filter((x) => x !== r) })}
                />
                {r}
              </label>
            ))}
          </div>
          <button type="submit" disabled={cargando} className={btn}>Crear usuario</button>
        </form>
      )}

      <div className="divide-y">
        {usuarios.map((u) => (
          <div key={u.id} className="py-3 flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[180px]">
              <p className="font-semibold text-gray-800">
                {u.nombre}
                {u.bloqueado && <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Bloqueado</span>}
              </p>
              <p className="text-xs text-gray-500 break-all">{u.email} · {u.roles || 'Sin roles'} · último acceso {fecha(u.ultimo_login)}</p>
            </div>
            <button
              className={btnSec}
              onClick={() => {
                const p = window.prompt(`Nueva contraseña para ${u.email} (mín. 6 caracteres):`)
                if (p && p.length >= 6) onPassword(u, p)
                else if (p) window.alert('La contraseña debe tener al menos 6 caracteres')
              }}
            >
              Contraseña
            </button>
            <button className={btnSec} onClick={() => onBloquear(u)}>{u.bloqueado ? 'Desbloquear' : 'Bloquear'}</button>
          </div>
        ))}
        {usuarios.length === 0 && <p className="text-sm text-gray-500 py-3">Sin usuarios todavía.</p>}
      </div>
    </div>
  )
}
