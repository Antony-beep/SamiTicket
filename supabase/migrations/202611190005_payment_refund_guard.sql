begin;

-- Only the payment that previously issued an entry may revoke it on refund.
create or replace function public.reconcile_mp_payment(p_order uuid,p_payment text,p_seller text,p_amount integer,p_state text,p_token text)
returns text language plpgsql set search_path = '' as $$
declare v_order public.orders; v_checkout public.mp_checkouts; v_payment public.mp_payments;
  v_type public.ticket_types; v_held integer; v_start timestamptz; v_ticket public.tickets;
begin
  select * into v_order from public.orders where id=p_order for update;
  select * into v_checkout from public.mp_checkouts where order_id=p_order;
  if v_order.id is null or v_checkout.order_id is null or v_order.payment_mode<>'mp_test'
    or v_checkout.seller_id<>p_seller or v_order.amount_cents<>p_amount then raise exception 'ST:mp_mismatch'; end if;
  if p_state not in ('approved','pending','in_process','authorized','rejected','cancelled','refunded','charged_back') then
    raise exception 'ST:mp_mismatch';
  end if;
  select * into v_payment from public.mp_payments where payment_id=p_payment for update;
  if found and v_payment.order_id<>p_order then raise exception 'ST:mp_mismatch'; end if;
  if v_payment.state in ('refunded','charged_back') then return v_payment.state; end if;
  if v_payment.refund_required then return 'refund_required'; end if;
  insert into public.mp_payments(payment_id,order_id,state) values(p_payment,p_order,p_state)
    on conflict(payment_id) do update set state=excluded.state,updated_at=now();
  if p_state in ('refunded','charged_back') then
    -- Lock the same ticket as check_in before revoking access.
    select * into v_ticket from public.tickets where order_id=p_order for update;
    if v_payment.state='approved' and v_ticket.id is not null and v_ticket.revoked_at is null then
      update public.tickets set revoked_at=now() where id=v_ticket.id;
      if not exists(select 1 from public.check_ins where ticket_id=v_ticket.id) then
        update public.ticket_types set sold=sold-1 where id=v_order.ticket_type_id and sold>0;
      end if;
      update public.orders set status='rejected' where id=p_order;
    end if;
    return p_state;
  end if;
  if p_state<>'approved' then return p_state; end if;
  if v_payment.state='approved' and v_order.status='paid' then return 'paid'; end if;
  select starts_at into v_start from public.events where id=v_order.event_id for share;
  select * into v_type from public.ticket_types where id=v_order.ticket_type_id for update;
  select count(*) into v_held from public.mp_checkouts c join public.orders o on o.id=c.order_id
    where o.ticket_type_id=v_type.id and o.status='pending' and c.order_id<>p_order and c.expires_at>now();
  if v_order.status<>'pending' or v_type.sold+v_held>=v_type.capacity or v_start<=now() then
    update public.mp_payments set refund_required=true where payment_id=p_payment;
    return 'refund_required';
  end if;
  insert into public.tickets(order_id,event_id,token) values(p_order,v_order.event_id,p_token);
  update public.ticket_types set sold=sold+1 where id=v_type.id;
  update public.orders set status='paid' where id=p_order;
  return 'paid';
end $$;

commit;

