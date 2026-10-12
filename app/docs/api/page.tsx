'use client'

import { useEffect, useState } from 'react'

const Bloque = ({ children }: { children: string }) => (
  <pre className="bg-[#0d2b5c] text-[#d7e7fb] rounded-xl p-4 text-xs overflow-x-auto mb-5">{children}</pre>
)
const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-[#0d2b5c] font-extrabold text-xl mt-10 mb-3">{children}</h2>
)
const Campo = ({ nombre, tipo, req, children }: { nombre: string; tipo: string; req?: boolean; children: React.ReactNode }) => (
  <tr className="border-b border-gray-100 align-top">
    <td className="py-2 pr-3 font-mono text-[13px] text-[#1e5a96] whitespace-nowrap">{nombre}</td>
    <td className="py-2 pr-3 text-xs text-gray-500 whitespace-nowrap">{tipo}{req && <span className="text-red-600"> *</span>}</td>
    <td className="py-2 text-sm text-gray-700">{children}</td>
  </tr>
)

export default function DocsApi() {
  const [base, setBase] = useState('https://tuempresa.ejemplo.cl')
  useEffect(() => setBase(window.location.origin), [])

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-[#0d2b5c] px-6 py-6">
        <h1 className="text-white font-extrabold text-2xl">API de reservas</h1>
        <p className="text-[#a8c4e0] text-sm mt-1">Para crear reservas desde tu sitio web cuando se paga un vuelo.</p>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 text-gray-800">
        <H2>Autenticación</H2>
        <p className="text-sm mb-3">
          Cada empresa tiene su propio token, que entrega el administrador del sistema. Va en el header
          <code className="mx-1 bg-gray-100 px-1.5 py-0.5 rounded text-[13px]">Authorization</code>
          de cada llamada. La empresa sale del token: no se manda en el cuerpo y un token no puede tocar datos de otra.
        </p>
        <Bloque>{`Authorization: Bearer rsv_1a2b3c...`}</Bloque>
        <p className="text-sm mb-3 bg-[#fff8e1] border border-[#ffd700] rounded-xl p-3">
          <strong>El token va en tu servidor</strong>, nunca en el JavaScript del navegador ni en el repositorio:
          quien lo tenga puede crear reservas a tu nombre. Si se filtra, se revoca desde el panel y se genera otro.
        </p>

        <H2>POST /api/v1/reservas</H2>
        <p className="text-sm mb-3">Crea la reserva. Lo normal es llamarlo cuando la pasarela confirma el pago.</p>
        <Bloque>{`curl -X POST ${base}/api/v1/reservas \
  -H "Authorization: Bearer rsv_..." \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan Pérez",
    "telefono": "56912345678",
    "fecha": "2026-11-05",
    "hora": "12:00",
    "cantidad": 2,
    "servicios": [9, 10],
    "pago": { "monto": 40000, "metodo": "Transferencia" },
    "personas": [
      { "nombre": "Juan Pérez", "edad": 34, "peso": 78 },
      { "nombre": "Ana Soto" }
    ],
    "referencia": "orden-4821"
  }'`}</Bloque>

        <table className="w-full mb-5">
          <tbody>
            <Campo nombre="nombre" tipo="texto" req>Quien reserva.</Campo>
            <Campo nombre="telefono" tipo="texto" req>Solo dígitos; se limpian espacios, + y guiones.</Campo>
            <Campo nombre="fecha" tipo="YYYY-MM-DD" req>Día del vuelo.</Campo>
            <Campo nombre="hora" tipo="HH:MM" req>Uno de los horarios de la empresa. Alternativa: <code>horario_id</code>.</Campo>
            <Campo nombre="cantidad" tipo="entero" req>Pasajeros.</Campo>
            <Campo nombre="servicios" tipo="array de id">Un id por unidad: dos vuelos = <code>[9, 9]</code>. Los ids salen del catálogo.</Campo>
            <Campo nombre="pago" tipo="objeto">
              <code>monto</code> en pesos y <code>metodo</code> con el nombre exacto de un método de pago de la empresa.
              Queda registrado como pago de la reserva.
            </Campo>
            <Campo nombre="personas" tipo="array">Pasajeros con <code>nombre</code>, <code>edad</code> y <code>peso</code>. Si no los mandas, la reserva queda con los cupos y los datos se completan después.</Campo>
            <Campo nombre="referencia" tipo="texto">Tu número de orden o pago. Si repites la llamada con la misma referencia no se duplica la reserva.</Campo>
          </tbody>
        </table>

        <p className="text-sm mb-3">Respuesta <code>201</code>:</p>
        <Bloque>{`{
  "id": 65,
  "creada": true,
  "fichas": [
    { "nombre": "Juan Pérez", "url": "${base}/ficha/86dd.../juan-perez" },
    { "nombre": "Ana Soto",   "url": "${base}/ficha/4687.../ana-soto" }
  ]
}`}</Bloque>
        <p className="text-sm mb-3">
          Cada pasajero trae el link de su <strong>ficha de aceptación de riesgo</strong>: mándalo por correo o WhatsApp y
          que la firme antes del vuelo. Si repites una <code>referencia</code> ya usada, responde <code>200</code> con
          <code className="mx-1">&quot;creada&quot;: false</code> y el id de la reserva que ya existía, sin crear otra.
        </p>

        <H2>GET /api/v1/catalogo</H2>
        <p className="text-sm mb-3">Horarios, servicios y métodos de pago de la empresa, para armar tu formulario.</p>
        <Bloque>{`curl ${base}/api/v1/catalogo -H "Authorization: Bearer rsv_..."

{
  "horarios": [{ "id": 13, "hora": "12:00" }, { "id": 17, "hora": "12:30" }],
  "servicios": [{ "id": 9, "servicio": "Vuelo 360", "monto": 25000, "descuento": false }],
  "metodos_pago": ["Efectivo", "Transferencia", "Débito", "Crédito"]
}`}</Bloque>

        <H2>Errores</H2>
        <table className="w-full mb-5">
          <tbody>
            <Campo nombre="401" tipo="">Token ausente, revocado o inválido.</Campo>
            <Campo nombre="400" tipo="">Falta un dato o no existe en esta empresa (horario, servicio, método de pago). El mensaje dice cuáles sí existen.</Campo>
            <Campo nombre="500" tipo="">Error del sistema. Reintenta mandando la misma <code>referencia</code>: no se duplica nada.</Campo>
          </tbody>
        </table>
        <Bloque>{`{ "error": "horario no encontrado. Disponibles: 12:00, 12:30, 13:00" }`}</Bloque>

        <H2>Ejemplo en Node</H2>
        <Bloque>{`const res = await fetch('${base}/api/v1/reservas', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${process.env.RESERVAS_TOKEN}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    nombre: compra.cliente,
    telefono: compra.telefono,
    fecha: compra.fecha,
    hora: compra.hora,
    cantidad: compra.pasajeros,
    pago: { monto: compra.total, metodo: 'Transferencia' },
    referencia: compra.ordenId,
  }),
})
const reserva = await res.json()`}</Bloque>

        <p className="text-xs text-gray-500 mt-10">
          Las llamadas son de servidor a servidor: la API no habilita CORS y no debe llamarse desde el navegador.
        </p>
      </main>
    </div>
  )
}
