begin;

alter table public.orders drop constraint if exists orders_payment_mode_check;
alter table public.orders add constraint orders_payment_mode_check check (payment_mode in ('demo','mp_test'));
alter table public.tickets add column if not exists revoked_at timestamptz;

create table if not exists public.mp_checkouts (
  order_id uuid primary key references public.orders(id),
  seller_id text not null,
  creation_key uuid not null default gen_random_uuid(),
  expires_at timestamptz not null,
  preference_id text unique,
  checkout_url text,
  claimed_until timestamptz
);
create table if not exists public.mp_payments (
  payment_id text primary key check (payment_id ~ '^[0-9]+$'),
  order_id uuid not null references public.orders(id),
  state text not null,
  refund_required boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists mp_payments_order_idx on public.mp_payments(order_id);
alter table public.mp_checkouts enable row level security;
alter table public.mp_payments enable row level security;
revoke all on public.mp_checkouts, public.mp_payments from public, anon, authenticated;
grant all on public.mp_checkouts, public.mp_payments to service_role;

create or replace function public.create_mp_order(p_id uuid, p_event uuid, p_name text, p_email text, p_access_hash text, p_seller text)
returns uuid language plpgsql set search_path = '' as $$
declare v_order public.orders; v_type public.ticket_types; v_start timestamptz; v_held integer;
begin
  perform public.create_order(p_id,p_event,p_name,p_email,p_access_hash);
  select * into v_order from public.orders where id=p_id for update;
  if v_order.status <> 'pending' then return p_id; end if;
  if exists(select 1 from public.mp_checkouts where order_id=p_id) then return p_id; end if;
  select starts_at into v_start from public.events where id=p_event for share;
  select * into v_type from public.ticket_types where id=v_order.ticket_type_id for update;
  if v_order.amount_cents <= 0 then raise exception 'ST:mp_positive_amount'; end if;
  select count(*) into v_held from public.mp_checkouts c join public.orders o on o.id=c.order_id
    where o.ticket_type_id=v_type.id and o.status='pending' and c.expires_at>now();
  if v_type.sold+v_held >= v_type.capacity then raise exception 'ST:sold_out'; end if;
  update public.orders set payment_mode='mp_test' where id=p_id;
  insert into public.mp_checkouts(order_id,seller_id,expires_at)
    values(p_id,p_seller,least(now()+interval '30 minutes',v_start));
  return p_id;
end $$;

create or replace function public.claim_mp_checkout(p_order uuid,p_access_hash text) returns jsonb
language plpgsql set search_path = '' as $$
declare v_order public.orders; v_checkout public.mp_checkouts; v_title text;
begin
  select * into v_order from public.orders where id=p_order for update;
  if not found or v_order.access_hash<>p_access_hash then raise exception 'ST:receipt_denied'; end if;
  select * into v_checkout from public.mp_checkouts where order_id=p_order for update;
  if not found or v_order.payment_mode<>'mp_test' then raise exception 'ST:mp_not_configured'; end if;
  if v_order.status<>'pending' then raise exception 'ST:mp_order_final'; end if;
  if v_checkout.expires_at<=now() then raise exception 'ST:mp_expired'; end if;
  if v_checkout.checkout_url is not null then return jsonb_build_object('url',v_checkout.checkout_url); end if;
  if v_checkout.claimed_until>now() then raise exception 'ST:mp_busy'; end if;
  update public.mp_checkouts set claimed_until=now()+interval '45 seconds' where order_id=p_order;
  select title into v_title from public.events where id=v_order.event_id;
  return jsonb_build_object('creationKey',v_checkout.creation_key,'expiresAt',v_checkout.expires_at,
    'sellerId',v_checkout.seller_id,'amountCents',v_order.amount_cents,'title',v_title);
end $$;

create or replace function public.save_mp_checkout(p_order uuid,p_preference text,p_url text) returns text
language plpgsql set search_path = '' as $$
declare v_checkout public.mp_checkouts;
begin
  select * into v_checkout from public.mp_checkouts where order_id=p_order for update;
  if not found then raise exception 'ST:mp_not_configured'; end if;
  if v_checkout.preference_id is null then
    update public.mp_checkouts set preference_id=p_preference,checkout_url=p_url where order_id=p_order;
    return p_url;
  end if;
  return v_checkout.checkout_url;
end $$;

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

create or replace function public.confirm_mp_refund(p_payment text) returns void
language plpgsql set search_path = '' as $$
begin
  update public.mp_payments set state='refunded',refund_required=false,updated_at=now() where payment_id=p_payment;
end $$;

create or replace function public.simulate_payment(p_order uuid,p_access_hash text,p_approve boolean,p_token text) returns text
language plpgsql set search_path = '' as $$
declare v_order public.orders; v_type public.ticket_types; v_held integer;
begin
  select * into v_order from public.orders where id=p_order for update;
  if not found or v_order.access_hash<>p_access_hash then raise exception 'ST:receipt_denied'; end if;
  if v_order.payment_mode<>'demo' then raise exception 'ST:mp_order_final'; end if;
  if v_order.status<>'pending' then return v_order.status; end if;
  if not p_approve then update public.orders set status='rejected' where id=p_order; return 'rejected'; end if;
  if not exists(select 1 from public.events where id=v_order.event_id and status='published' and starts_at>now()) then
    raise exception 'ST:event_unavailable'; end if;
  select * into v_type from public.ticket_types where id=v_order.ticket_type_id for update;
  select count(*) into v_held from public.mp_checkouts c join public.orders o on o.id=c.order_id
    where o.ticket_type_id=v_type.id and o.status='pending' and c.expires_at>now();
  if v_type.sold+v_held>=v_type.capacity then raise exception 'ST:sold_out'; end if;
  update public.ticket_types set sold=sold+1 where id=v_type.id;
  insert into public.tickets(order_id,event_id,token) values(p_order,v_order.event_id,p_token);
  update public.orders set status='paid' where id=p_order;
  return 'paid';
end $$;

create or replace function public.check_in(p_actor uuid,p_event uuid,p_token text) returns jsonb
language plpgsql set search_path = '' as $$
declare v_owner uuid; v_ticket public.tickets; v_check public.check_ins;
begin
  select owner_id into v_owner from public.events where id=p_event for share;
  if p_actor is null or v_owner is null or (v_owner<>p_actor and not exists(
    select 1 from public.event_staff where event_id=p_event and user_id=p_actor
  )) then raise exception 'ST:forbidden'; end if;
  select * into v_ticket from public.tickets where token=p_token for update;
  if not found or v_ticket.revoked_at is not null then return jsonb_build_object('status','invalid'); end if;
  if v_ticket.event_id<>p_event then return jsonb_build_object('status','wrong_event'); end if;
  insert into public.check_ins(ticket_id,event_id,checked_by) values(v_ticket.id,p_event,p_actor)
    on conflict(ticket_id) do nothing returning * into v_check;
  if found then return jsonb_build_object('status','accepted','checkedAt',v_check.checked_at); end if;
  select * into v_check from public.check_ins where ticket_id=v_ticket.id;
  return jsonb_build_object('status','used','checkedAt',v_check.checked_at);
end $$;

revoke all on function public.create_mp_order(uuid,uuid,text,text,text,text), public.claim_mp_checkout(uuid,text),
 public.save_mp_checkout(uuid,text,text),public.reconcile_mp_payment(uuid,text,text,integer,text,text),
 public.confirm_mp_refund(text) from public,anon,authenticated;
grant execute on function public.create_mp_order(uuid,uuid,text,text,text,text),public.claim_mp_checkout(uuid,text),
 public.save_mp_checkout(uuid,text,text),public.reconcile_mp_payment(uuid,text,text,integer,text,text),
 public.confirm_mp_refund(text) to service_role;
commit;
