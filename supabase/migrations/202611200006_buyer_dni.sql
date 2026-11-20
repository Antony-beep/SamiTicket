begin;

alter table public.orders add column if not exists buyer_dni text;
alter table public.orders drop constraint if exists orders_buyer_dni_check;
alter table public.orders add constraint orders_buyer_dni_check
  check (buyer_dni is null or buyer_dni ~ '^[0-9]{8,9}$');

create index if not exists orders_buyer_dni_idx on public.orders(buyer_dni)
  where buyer_dni is not null;

create or replace function public.set_order_dni(p_order uuid, p_access_hash text, p_dni text)
returns void language plpgsql set search_path = '' as $$
declare v_order public.orders;
begin
  if p_dni is null or p_dni !~ '^[0-9]{8,9}$' then
    raise exception 'ST:invalid_dni';
  end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found or v_order.access_hash <> p_access_hash then
    raise exception 'ST:receipt_denied';
  end if;
  if v_order.buyer_dni is not null and v_order.buyer_dni <> p_dni then
    raise exception 'ST:idempotency_conflict';
  end if;
  update public.orders set buyer_dni = p_dni where id = p_order;
end $$;

revoke all on function public.set_order_dni(uuid, text, text) from public, anon, authenticated;
grant execute on function public.set_order_dni(uuid, text, text) to service_role;

commit;
