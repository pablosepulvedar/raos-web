-- Con qué se pagó el sitio, cuando se paga en el día.
--
-- El cuadre ya descuenta lo que cobra el lugar, pero el desglose por método de
-- pago no sabía de dónde salió esa plata: la fila de Efectivo quedaba sin el
-- egreso, y anotarlo a mano lo contaba dos veces.

alter table public.dias_de_vuelo
  add column metodo_pago_id bigint references public.metodos_pago(id) on delete set null;
