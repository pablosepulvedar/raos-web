'use client'

import { useEffect, useState } from 'react'
import { createClient } from './supabase-browser'

export type Jerga = {
  codigo: string
  nombre: string
  actividad: string
  actividad_plural: string
  operador: string
  operador_plural: string
  cliente: string
  cliente_plural: string
  realizado: string
}

// Mientras carga se usa la palabra neutra: ninguna pantalla queda en blanco
export const JERGA_NEUTRA: Jerga = {
  codigo: 'generico',
  nombre: 'Otra actividad',
  actividad: 'salida',
  actividad_plural: 'salidas',
  operador: 'guía',
  operador_plural: 'guías',
  cliente: 'participante',
  cliente_plural: 'participantes',
  realizado: 'salió',
}

export const May = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// La jerga del rubro de la empresa del usuario
export function useJerga() {
  const [jerga, setJerga] = useState<Jerga>(JERGA_NEUTRA)
  useEffect(() => {
    createClient().rpc('mi_jerga').then(({ data }) => data && setJerga(data as Jerga))
  }, [])
  return jerga
}
