// Carrito de la landing. Sin librerías: los botones "Comprar" de cada tarjeta
// suman al carrito y el pedido se manda por WhatsApp con el detalle y el total.
// ponytail: todavía no cobra en línea. Cuando RAOS tenga Mercado Pago conectado,
// "Enviar pedido" pasa a crear la reserva por la API de Reservaps y abrir el pago.

// Precio según cuántos van: 1 persona, 2 (con promo) o 3 o más (por persona).
// Si cambian los precios, se cambian acá y en las tarjetas de index.html.
const PRODUCTOS = {
  basico:      { nombre: 'Vuelo básico (sin grabación)',  uno: 60000, dos: 110000, cu: 59000 },
  tradicional: { nombre: 'Vuelo + video tradicional',     uno: 70000, dos: 130000, cu: 68000 },
  premium:     { nombre: 'Vuelo + video premium 360°',    uno: 75000, dos: 140000, cu: 72000 },
  gift:        { nombre: 'Gift Card de regalo',           uno: 70000, dos: 140000, cu: 70000 },
}
const WHATSAPP = '56941495370'

const precio = (p, n) => n === 1 ? p.uno : n === 2 ? p.dos : p.cu * n
const tramo = (p, n) =>
  n === 2 && p.dos < p.uno * 2 ? 'Promo 2 personas' : n >= 3 && p.cu < p.uno ? `$${miles(p.cu)} c/u` : ''
const miles = n => n.toLocaleString('es-CL')

// El carrito se recuerda en este navegador; si el almacenamiento falla, vive en memoria
let carro = {}
try { carro = JSON.parse(localStorage.getItem('raos-carro')) || {} } catch {}
const guardar = () => { try { localStorage.setItem('raos-carro', JSON.stringify(carro)) } catch {} }

const $ = id => document.getElementById(id)
const items = () => Object.entries(carro).filter(([id, n]) => PRODUCTOS[id] && n > 0)
const total = () => items().reduce((t, [id, n]) => t + precio(PRODUCTOS[id], n), 0)

function pintar() {
  const lista = items()
  const cuantos = lista.reduce((t, [, n]) => t + n, 0)
  $('carro-btn').hidden = cuantos === 0
  $('carro-n').textContent = cuantos
  $('carro-vacio').hidden = cuantos > 0
  $('carro-pie').hidden = cuantos === 0
  $('carro-total').textContent = `$${miles(total())}`
  $('carro-items').innerHTML = lista.map(([id, n]) => {
    const p = PRODUCTOS[id], t = tramo(p, n)
    return `<li>
      <span class="nom">${p.nombre}</span>
      <span class="monto">$${miles(precio(p, n))}</span>
      <span class="sub">${t || '&nbsp;'}</span>
      <span class="cant">
        <button type="button" data-menos="${id}" aria-label="Uno menos de ${p.nombre}">−</button>
        <b aria-live="polite">${n}</b>
        <button type="button" data-mas="${id}" aria-label="Uno más de ${p.nombre}">+</button>
      </span>
    </li>`
  }).join('')
}

function cambiar(id, d) {
  carro[id] = Math.max(0, (carro[id] || 0) + d)
  if (!carro[id]) delete carro[id]
  guardar(); pintar()
}

function mensaje() {
  const fecha = $('carro-fecha').value, hora = $('carro-hora').value, nombre = $('carro-nombre').value.trim()
  const dia = fecha
    ? new Date(fecha + 'T12:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''
  return [
    'Hola RAOS, quiero comprar:',
    ...items().map(([id, n]) => {
      const p = PRODUCTOS[id], t = tramo(p, n)
      return `• ${n} × ${p.nombre}: $${miles(precio(p, n))}${t ? ` (${t})` : ''}`
    }),
    `Total: $${miles(total())}`,
    nombre && `Nombre: ${nombre}`,
    dia && `Día: ${dia}${hora ? `, ${hora}` : ''}`,
    !dia && hora && `Hora aproximada: ${hora}`,
  ].filter(Boolean).join('\n')
}

if (typeof document !== 'undefined') {
  const dlg = $('carro')
  // Se reserva con al menos un día de anticipación
  const manana = new Date(); manana.setDate(manana.getDate() + 1)
  $('carro-fecha').min = manana.toLocaleDateString('sv-SE')

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-comprar],[data-mas],[data-menos],[data-cerrar]')
    if (!b) return
    if (b.dataset.comprar) { cambiar(b.dataset.comprar, 1); dlg.showModal() }
    else if (b.dataset.mas) cambiar(b.dataset.mas, 1)
    else if (b.dataset.menos) cambiar(b.dataset.menos, -1)
    else dlg.close()
  })
  $('carro-btn').addEventListener('click', () => dlg.showModal())
  // Tocar fuera del panel lo cierra
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close() })
  $('carro-vaciar').addEventListener('click', () => { carro = {}; guardar(); pintar() })
  $('carro-enviar').addEventListener('click', () => {
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje())}`, '_blank', 'noopener')
  })
  pintar()
} else {
  // node carrito.js -> comprueba los tramos de precio
  const assert = require('node:assert/strict')
  const b = PRODUCTOS.basico
  assert.equal(precio(b, 1), 60000)
  assert.equal(precio(b, 2), 110000)
  assert.equal(precio(b, 3), 177000)
  assert.equal(precio(PRODUCTOS.premium, 4), 288000)
  assert.equal(precio(PRODUCTOS.gift, 2), 140000)
  assert.equal(tramo(b, 2), 'Promo 2 personas')
  assert.equal(tramo(PRODUCTOS.gift, 2), '')
  console.log('carrito: precios OK')
}
