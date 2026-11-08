// Contrato de confidencialidad y uso de Reservaps. Lo acepta el cliente al dar de alta su
// empresa, en /alta/<token>. Al aceptar se guardan la versión y el hash de este texto, así
// que CUALQUIER cambio obliga a subir CONTRATO_VERSION: si no, un contrato viejo quedaría
// con el hash de uno nuevo y la evidencia no serviría de nada.
//
// Pendiente: revisión de un abogado. Está escrito para ser claro y razonable, no para
// cubrir todos los casos.
export const CONTRATO_VERSION = '2026-11-v1'

export const CONTRATO_TITULO = 'Acuerdo de confidencialidad y condiciones de uso'

// {empresa} se reemplaza por el nombre que el cliente escribe en el formulario.
export const CONTRATO_TEXTO = `1. QUÉ ES ESTE ACUERDO

Este documento regula el uso de Reservaps (en adelante, "el sistema") por parte de {empresa} (en adelante, "el cliente") y los compromisos de confidencialidad entre ambas partes. Se acepta marcando la casilla al final; esa aceptación tiene valor de firma conforme a la Ley 19.799 sobre documentos electrónicos.

2. LOS DATOS DEL CLIENTE SON DEL CLIENTE

La información que el cliente carga en el sistema —sus reservas, sus clientes, sus guías, sus precios y sus cifras— le pertenece. Reservaps la guarda y la procesa únicamente para prestar el servicio.

Reservaps no comparte, vende ni cede esa información a terceros, y **no la comparte con otros clientes de Reservaps**. Cada empresa ve solamente sus propios datos: la separación está implementada en la base de datos, no solo en la pantalla.

El personal de Reservaps accede a los datos del cliente solo cuando es necesario para dar soporte, corregir una falla o cumplir una obligación legal.

3. EL CLIENTE ASUME EL MISMO COMPROMISO

El cliente se obliga a:

a) No divulgar ni usar fuera del sistema la información de sus pasajeros, salvo para prestar su propio servicio.

b) No intentar acceder a datos de otras empresas usuarias de Reservaps, ni a partes del sistema que no le correspondan. Si detecta que puede ver algo que no es suyo, avisarlo de inmediato y no utilizarlo.

c) Mantener en reserva lo que conozca del funcionamiento interno del sistema.

d) No ceder sus credenciales. Cada persona que use el sistema debe tener su propio usuario.

4. DATOS PERSONALES

Los pasajeros entregan datos personales, y en la ficha de aceptación de riesgo también datos de salud, que la ley considera sensibles.

El cliente es responsable de tratarlos conforme a la Ley 19.628 sobre protección de la vida privada: recogerlos para el fin informado, no usarlos para otra cosa, no entregarlos a terceros sin autorización y resguardarlos.

Reservaps actúa como encargado del tratamiento: los guarda por cuenta del cliente y no los usa para fines propios.

Las fichas de aceptación de riesgo se conservan durante dos años, según exige el D.S. 19 del Ministerio de Economía para los prestadores de turismo aventura.

5. OBLIGACIONES DEL CLIENTE EN SU ACTIVIDAD

El cliente declara que cumple la normativa que le corresponde por su actividad —registro ante Sernatur, licencias y habilitaciones de su rubro, seguros y normas de seguridad— y que el uso del sistema no lo sustituye ni lo acredita. Reservaps es una herramienta de gestión: no certifica, fiscaliza ni respalda el cumplimiento de esas obligaciones.

6. DISPONIBILIDAD Y RESPALDOS

Reservaps se presta con dedicación profesional, pero no se garantiza una disponibilidad ininterrumpida. Se realizan respaldos periódicos de la base de datos.

Reservaps no responde por lucro cesante ni por perjuicios indirectos derivados de una interrupción del servicio.

7. PAGO Y SUSPENSIÓN

El precio y la periodicidad son los acordados por escrito entre las partes. El atraso en el pago faculta a suspender el acceso tras avisar; la suspensión impide usar el sistema pero **no borra los datos del cliente**.

8. TÉRMINO

Cualquiera de las partes puede poner término avisando con 30 días. Al terminar, el cliente puede pedir una copia de sus datos en formato legible, y Reservaps los elimina de sus sistemas activos pasados 60 días, salvo lo que deba conservar por ley.

Los compromisos de confidencialidad de los puntos 2 y 3 siguen vigentes después del término.

9. PROPIEDAD DEL SISTEMA

El sistema, su código y su diseño son de Reservaps. El cliente recibe un derecho de uso mientras dure el acuerdo; no adquiere propiedad sobre el software ni puede copiarlo, revenderlo ni cederlo.

10. LEGISLACIÓN

Este acuerdo se rige por la ley chilena. Las partes buscarán resolver de buena fe cualquier diferencia antes de acudir a los tribunales competentes.`

// El hash viaja con la aceptación: prueba qué texto exacto se aceptó.
export async function hashContrato(texto: string) {
  const datos = new TextEncoder().encode(texto)
  const buf = await crypto.subtle.digest('SHA-256', datos)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
