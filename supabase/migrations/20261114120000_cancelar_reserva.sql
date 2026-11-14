-- Cancelar una reserva, con motivo.
--
-- Es el mismo borrado lógico de siempre (la reserva se esconde, las fichas firmadas
-- se conservan), solo que ahora queda escrito POR QUÉ. En pantalla el botón dejó de
-- decir "Eliminar": el cliente que no llega o que avisa que no viene no es un error
-- de tipeo, es un dato del negocio.
--
-- El motivo se escribe ANTES de borrar a propósito: una vez marcada `borrada_at` la
-- fila deja de verse (política restrictiva) y Postgres ya no deja actualizarla.
-- Por eso van los dos pasos en una función: o pasan los dos, o no pasa ninguno.

alter table public.reservas add column motivo_cancelacion text;

-- Sin security definer: el RLS sigue decidiendo qué reserva puede cancelar cada quien,
-- igual que cuando el botón hacía un DELETE directo.
create function public.reserva_cancelar(p_id bigint, p_motivo text) returns void
  language plpgsql set search_path = ''
  as $$
begin
  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'falta el motivo de la cancelación';
  end if;
  update public.reservas set motivo_cancelacion = btrim(p_motivo) where id = p_id;
  if not found then raise exception 'reserva no encontrada'; end if;
  delete from public.reservas where id = p_id;   -- el trigger la deja en borrado lógico
end $$;
grant execute on function public.reserva_cancelar(bigint, text) to authenticated;
