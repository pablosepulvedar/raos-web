'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

type Rol = { id: number; nombre: string }
type Usuario = {
  id: string
  nombre: string
  email?: string
  activo: boolean
  perfil_roles?: { id: number; rol_id: number; roles: Rol | null }[]
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [rolesCatalog, setRolesCatalog] = useState<Rol[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<Rol[]>([])
  const [showRolePicker, setShowRolePicker] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchUsuarios()
    fetchRoles()
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
    })
  }, [])

  const fetchRoles = async () => {
    const { data } = await supabase.from('roles').select('id, nombre').order('nombre')
    if (data) setRolesCatalog(data)
  }

  const fetchUsuarios = async () => {
    const [perfilesRes, authRes] = await Promise.all([
      supabase.from('perfiles').select('*, perfil_roles(id, rol_id, roles(id, nombre))').order('created_at', { ascending: false }),
      fetch('/api/admin/users').then(r => r.ok ? r.json() as Promise<{id:string;email:string}[]> : []).catch(() => [])
    ])

    const authEmails: Record<string, string> = {}
    if (Array.isArray(authRes)) authRes.forEach(u => { authEmails[u.id] = u.email })

    const perfiles = (perfilesRes.data || []) as Usuario[]
    const merged = perfiles.map(p => ({ ...p, email: authEmails[p.id] || p.email || '' }))
    setUsuarios(merged)
  }

  const getRoleNames = (usuario: Usuario) =>
    (usuario.perfil_roles || [])
      .map((pr) => pr.roles?.nombre)
      .filter(Boolean)
      .join(', ') || 'Sin roles'

  const resetForm = () => {
    setNombre('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setSelectedRoles([])
    setShowRolePicker(false)
    setEditingId(null)
    setShowForm(false)
    setError(null)
  }

  const syncPerfilRoles = async (perfilId: string, roleIds: number[]) => {
    const { data: existing } = await supabase
      .from('perfil_roles')
      .select('id, rol_id')
      .eq('perfil_id', perfilId)

    const existingRows = existing || []
    const existingRolIds = existingRows.map((r) => r.rol_id)
    const toAdd = roleIds.filter((id) => !existingRolIds.includes(id))
    const toRemove = existingRows.filter((r) => !roleIds.includes(r.rol_id))

    if (toRemove.length > 0) {
      await supabase.from('perfil_roles').delete().in('id', toRemove.map((r) => r.id))
    }
    if (toAdd.length > 0) {
      await supabase.from('perfil_roles').insert(toAdd.map((rol_id) => ({ perfil_id: perfilId, rol_id })))
    }
  }

  const addRole = (rol: Rol) => {
    if (!selectedRoles.find((r) => r.id === rol.id)) {
      setSelectedRoles((prev) => [...prev, rol])
    }
    setShowRolePicker(false)
  }

  const removeRole = (rolId: number) => {
    setSelectedRoles((prev) => prev.filter((r) => r.id !== rolId))
  }

  const availableRoles = rolesCatalog.filter((r) => !selectedRoles.find((s) => s.id === r.id))

  const openCreateForm = () => {
    setEditingId(null)
    setNombre('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setSelectedRoles([])
    setShowRolePicker(false)
    setError(null)
    setShowForm(true)
  }

  const openEditForm = (usuario: Usuario) => {
    const rolesFromProfile: Rol[] = (usuario.perfil_roles || [])
      .map((pr) => pr.roles)
      .filter((r): r is Rol => r !== null)

    setEditingId(usuario.id)
    setNombre(usuario.nombre || '')
    setEmail(usuario.email || '')
    setPassword('')
    setConfirmPassword('')
    setSelectedRoles(rolesFromProfile)
    setShowRolePicker(false)
    setError(null)
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const toggleActivo = async (usuario: Usuario) => {
    const nuevoEstado = !usuario.activo
    const { error } = await supabase
      .from('perfiles')
      .update({ activo: nuevoEstado })
      .eq('id', usuario.id)

    if (error) {
      setError(error.message)
      return
    }
    await fetchUsuarios()
  }

  const eliminarUsuario = async (usuario: Usuario) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar a ${usuario.nombre}?`)) return
    setDeletingId(usuario.id)
    try {
      await supabase.from('perfil_roles').delete().eq('perfil_id', usuario.id)
      await supabase.from('perfiles').delete().eq('id', usuario.id)
      if (editingId === usuario.id) resetForm()
      await fetchUsuarios()
    } finally {
      setDeletingId(null)
    }
  }

  const guardarUsuario = async () => {
    setError(null)
    if (!nombre.trim()) return setError('Ingresa el nombre')
    if (!editingId && (!email.trim() || !password.trim())) return setError('Completa email y contraseña')
    if (!editingId || password.trim()) {
      if (!confirmPassword.trim()) return setError('Confirma la contraseña')
      if (password !== confirmPassword) return setError('Las contraseñas no coinciden')
    }
    if (selectedRoles.length === 0) return setError('Selecciona al menos un rol')

    setLoading(true)
    try {
      if (editingId) {
        const { error: profileError } = await supabase
          .from('perfiles')
          .update({ nombre: nombre.trim() })
          .eq('id', editingId)

        if (profileError) throw profileError

        if (password.trim()) {
          const res = await fetch('/api/admin/set-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: editingId, password: password.trim() }),
          })
          if (!res.ok) {
            const { error } = await res.json()
            throw new Error(error || 'No se pudo cambiar la contraseña')
          }
        }

        await syncPerfilRoles(editingId, selectedRoles.map((r) => r.id))
        await fetchUsuarios()
        setSuccess('Usuario actualizado correctamente')
        resetForm()
        return
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      })
      if (authError) throw authError
      if (!authData.user) throw new Error('No se pudo crear el usuario')

      const profileInsert: Record<string, unknown> = {
        id: authData.user.id,
        nombre: nombre.trim(),
        activo: true,
        email: email.trim(),
      }

      let { error: profileError } = await supabase.from('perfiles').insert(profileInsert)
      if (profileError?.message?.includes('email')) {
        const { email: _e, ...withoutEmail } = profileInsert
        const retry = await supabase.from('perfiles').insert(withoutEmail)
        profileError = retry.error
      }
      if (profileError) throw profileError

      await syncPerfilRoles(authData.user.id, selectedRoles.map((r) => r.id))
      setSuccess('Usuario creado correctamente')
      resetForm()
      await fetchUsuarios()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el usuario')
    } finally {
      setLoading(false)
    }
  }

  const passwordMatchColor =
    confirmPassword.length === 0 ? 'border-[#2e6db4]' : password === confirmPassword ? 'border-green-500' : 'border-red-500'

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Header */}
      <header className="bg-[#2e6db4] px-5 py-5 flex items-center gap-4">
        <Link href="/" className="text-white text-lg font-semibold hover:opacity-80">
          ← Volver
        </Link>
        <h1 className="text-white text-xl font-bold flex-1 text-center">👥 Usuarios</h1>
        <div className="w-16" />
      </header>

      <div className="max-w-lg mx-auto px-5 py-5">
        {/* Toast mensajes */}
        {success && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-800 rounded-lg flex justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="font-bold ml-2">×</button>
          </div>
        )}

        {/* Botón agregar */}
        <button
          onClick={() => (showForm ? resetForm() : openCreateForm())}
          className="w-full bg-[#1e5a96] text-white font-semibold py-3 rounded-lg mb-5 hover:bg-[#174a82] transition-colors"
        >
          {showForm ? 'Cancelar' : '+ Agregar Usuario'}
        </button>

        {/* Formulario */}
        {showForm && (
          <div ref={formRef} className="bg-[#e8f0f7] rounded-xl p-5 mb-5">
            <h2 className="text-[#1e5a96] font-bold text-base mb-4">
              {editingId ? 'Editar usuario' : 'Nuevo usuario'}
            </h2>

            {error && (
              <div className="mb-3 p-3 bg-red-100 border border-red-400 text-red-800 rounded-lg text-sm">
                {error}
              </div>
            )}

            <label className="block text-[#1e5a96] font-bold text-sm mb-1">Nombre</label>
            <input
              className="w-full border border-[#2e6db4] rounded-lg p-3 mb-3 text-sm bg-white"
              placeholder="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />

            <label className="block text-[#1e5a96] font-bold text-sm mb-1">Email</label>
            <input
              className={`w-full border border-[#2e6db4] rounded-lg p-3 mb-3 text-sm ${editingId ? 'bg-gray-100 text-gray-500' : 'bg-white'}`}
              placeholder="correo@ejemplo.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={!!editingId}
            />

            <label className="block text-[#1e5a96] font-bold text-sm mb-1">
              {editingId ? 'Nueva contraseña (opcional)' : 'Contraseña'}
            </label>
            <input
              className="w-full border border-[#2e6db4] rounded-lg p-3 mb-3 text-sm bg-white"
              placeholder={editingId ? 'Dejar vacío para no cambiar' : 'Contraseña'}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {(!editingId || password.length > 0) && (
              <>
                <label className="block text-[#1e5a96] font-bold text-sm mb-1">Confirmar contraseña</label>
                <input
                  className={`w-full border rounded-lg p-3 mb-1 text-sm bg-white ${passwordMatchColor}`}
                  placeholder="Confirmar contraseña"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {confirmPassword.length > 0 && (
                  <p className={`text-xs font-semibold mb-3 ${password === confirmPassword ? 'text-green-600' : 'text-red-600'}`}>
                    {password === confirmPassword ? '✓ Las contraseñas coinciden' : '✗ Las contraseñas no coinciden'}
                  </p>
                )}
              </>
            )}

            {/* Roles */}
            <label className="block text-[#1e5a96] font-bold text-sm mb-2">Roles</label>
            <div className="relative mb-2">
              <button
                type="button"
                onClick={() => setShowRolePicker(!showRolePicker)}
                className="w-full border border-[#2e6db4] rounded-lg p-3 text-sm bg-white text-left text-gray-600 hover:bg-gray-50"
              >
                {availableRoles.length === 0 ? 'No hay más roles disponibles' : 'Seleccionar rol...'}
              </button>
              {showRolePicker && availableRoles.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-[#2e6db4] rounded-lg mt-1 shadow-lg overflow-hidden">
                  {availableRoles.map((rol) => (
                    <button
                      key={rol.id}
                      type="button"
                      onClick={() => addRole(rol)}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-[#e8f0f7] border-b last:border-b-0 border-gray-100"
                    >
                      {rol.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="min-h-12 border border-[#2e6db4] rounded-lg p-3 bg-white flex flex-wrap gap-2 mb-4">
              {selectedRoles.length === 0 ? (
                <span className="text-gray-400 text-sm">Los roles seleccionados aparecerán aquí</span>
              ) : (
                selectedRoles.map((rol) => (
                  <span key={rol.id} className="flex items-center gap-1 bg-[#e8f0f7] text-[#1e5a96] font-semibold text-sm px-3 py-1 rounded-full">
                    {rol.nombre}
                    <button type="button" onClick={() => removeRole(rol.id)} className="text-red-600 font-bold ml-1 hover:text-red-800">×</button>
                  </span>
                ))
              )}
            </div>

            <button
              onClick={guardarUsuario}
              disabled={loading}
              className="w-full bg-[#ffd700] text-[#1e5a96] font-bold py-3 rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-60"
            >
              {loading ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        )}

        {/* Lista de usuarios */}
        <p className="text-[#1e5a96] font-bold text-sm mb-3">{usuarios.length} usuarios registrados</p>

        <div className="flex flex-col gap-3">
          {usuarios.map((usuario) => (
            <div
              key={usuario.id}
              className="bg-white rounded-xl p-4 shadow-sm border-l-4"
              style={{ borderLeftColor: usuario.activo ? '#2e6db4' : '#ccc' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[#1e5a96] font-bold text-base truncate">{usuario.nombre}</p>
                  {usuario.email && (
                    <p className="text-gray-500 text-xs mt-1 truncate">{usuario.email}</p>
                  )}
                  <p className="text-gray-500 text-xs mt-1">
                    {usuario.activo ? '✅ Activo' : '❌ Inactivo'}
                  </p>
                  <p className="text-[#1e5a96] text-xs mt-1">🛡️ {getRoleNames(usuario)}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEditForm(usuario)}
                    className="px-3 py-1.5 bg-[#e8f0f7] text-[#1e5a96] font-bold text-sm rounded-lg hover:bg-[#d0e3f5] transition-colors"
                  >
                    Editar
                  </button>

                  {/* Toggle activo */}
                  <button
                    onClick={() => toggleActivo(usuario)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${usuario.activo ? 'bg-[#a8c8e8]' : 'bg-gray-300'}`}
                    title={usuario.activo ? 'Desactivar' : 'Activar'}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform ${usuario.activo ? 'translate-x-5 bg-[#2e6db4]' : 'translate-x-0 bg-gray-400'}`}
                    />
                  </button>

                  <button
                    onClick={() => eliminarUsuario(usuario)}
                    disabled={deletingId === usuario.id}
                    className="p-2 bg-[#ffe5e5] rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <span className="text-base">{deletingId === usuario.id ? '⏳' : '🗑️'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {usuarios.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">👥</p>
              <p className="text-sm">No hay usuarios registrados</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
