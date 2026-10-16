-- Apply once in a dedicated Supabase demo project. No existing data is deleted.
begin;
create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  slug text not null unique,
  title text not null default '' check (length(title) <= 160),
  description text not null default '' check (length(description) <= 5000),
  starts_at timestamptz,
  timezone text not null default 'America/Lima' check (timezone = 'America/Lima'),
  venue text not null default '', address text not null default '', city text not null default '',
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  category text not null default 'Eventos locales', outdoor boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  check (status = 'draft' or (length(trim(title)) > 0 and length(trim(description)) > 0
    and starts_at is not null and length(trim(venue)) > 0 and length(trim(address)) > 0
    and length(trim(city)) > 0 and latitude is not null and longitude is not null))
);
create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id),
  name text not null default 'General' check (name = 'General'),
  price_cents integer not null default 0 check (price_cents between 0 and 100000000),
  capacity integer not null default 1 check (capacity between 1 and 10000),
  sold integer not null default 0 check (sold >= 0 and sold <= capacity)
);
create table public.event_staff (
  event_id uuid not null references public.events(id),
  user_id uuid not null references auth.users(id),
  email text not null,
  primary key (event_id, user_id)
);
create table public.orders (
  id uuid primary key,
  event_id uuid not null references public.events(id),
  ticket_type_id uuid not null references public.ticket_types(id),
  buyer_name text not null check (length(trim(buyer_name)) between 2 and 120),
  buyer_email text not null check (length(buyer_email) between 3 and 254),
  amount_cents integer not null check (amount_cents >= 0),
  access_hash text not null check (access_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  payment_mode text not null default 'demo' check (payment_mode = 'demo'),
  created_at timestamptz not null default now()
);
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id),
  event_id uuid not null references public.events(id),
  token text not null unique check (token ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create table public.check_ins (
  ticket_id uuid primary key references public.tickets(id),
  event_id uuid not null references public.events(id),
  checked_by uuid not null references auth.users(id),
  checked_at timestamptz not null default now()
);
create index events_owner_idx on public.events(owner_id);
create index events_public_idx on public.events(starts_at) where status = 'published';
create index staff_user_idx on public.event_staff(user_id);
create index orders_event_idx on public.orders(event_id);
create index tickets_event_idx on public.tickets(event_id);
create index check_ins_event_idx on public.check_ins(event_id);

alter table public.events enable row level security;
alter table public.ticket_types enable row level security;
alter table public.event_staff enable row level security;
alter table public.orders enable row level security;
alter table public.tickets enable row level security;
alter table public.check_ins enable row level security;
revoke all on public.events, public.ticket_types, public.event_staff, public.orders, public.tickets, public.check_ins from anon, authenticated;
grant select on public.events, public.ticket_types to anon, authenticated;
grant all on public.events, public.ticket_types, public.event_staff, public.orders, public.tickets, public.check_ins to service_role;
create policy public_events on public.events for select to anon, authenticated using (status = 'published' and starts_at > now());
create policy public_ticket_types on public.ticket_types for select to anon, authenticated using (
  exists (select 1 from public.events e where e.id = event_id and e.status = 'published' and e.starts_at > now())
);

-- Freeze published event details even if a future server handler misses the check.
create function public.freeze_published_event() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'published' then raise exception 'ST:published_immutable'; end if;
  return new;
end $$;
create trigger freeze_event before update on public.events for each row execute function public.freeze_published_event();
create function public.freeze_published_type() returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.price_cents, new.capacity, new.event_id, new.name) is distinct from
     (old.price_cents, old.capacity, old.event_id, old.name)
     and exists(select 1 from public.events where id = old.event_id and status = 'published') then
    raise exception 'ST:published_immutable';
  end if;
  return new;
end $$;
create trigger freeze_type before update on public.ticket_types for each row execute function public.freeze_published_type();

create function public.save_event(p_actor uuid, p_id uuid, p_data jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare v_event public.events;
begin
  -- Serialize concurrent first saves of the same draft as well as updates.
  if p_actor is null then raise exception 'ST:forbidden'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text, 0));
  select * into v_event from public.events where id = p_id for update;
  if found then
    if v_event.owner_id <> p_actor then raise exception 'ST:forbidden'; end if;
    if v_event.status <> 'draft' then raise exception 'ST:published_immutable'; end if;
  else
    insert into public.events(id, owner_id, slug) values (p_id, p_actor, 'evento-' || p_id::text);
  end if;
  update public.events set title = p_data->>'title', description = p_data->>'description',
    starts_at = nullif(p_data->>'starts_at', '')::timestamptz,
    venue = p_data->>'venue', address = p_data->>'address', city = p_data->>'city',
    latitude = (p_data->>'latitude')::double precision, longitude = (p_data->>'longitude')::double precision,
    category = p_data->>'category', outdoor = (p_data->>'outdoor')::boolean where id = p_id;
  insert into public.ticket_types(event_id, price_cents, capacity)
    values (p_id, (p_data->>'price_cents')::integer, (p_data->>'capacity')::integer)
    on conflict (event_id) do update set price_cents = excluded.price_cents, capacity = excluded.capacity;
  return p_id;
end $$;

create function public.publish_event(p_actor uuid, p_event uuid) returns void
language plpgsql set search_path = '' as $$
declare v_event public.events;
begin
  select * into v_event from public.events where id = p_event for update;
  if p_actor is null or not found or v_event.owner_id <> p_actor then raise exception 'ST:forbidden'; end if;
  if v_event.status = 'published' then return; end if;
  if v_event.starts_at is null or v_event.starts_at <= now() or
    length(trim(v_event.title)) = 0 or length(trim(v_event.description)) = 0 or
    length(trim(v_event.venue)) = 0 or length(trim(v_event.address)) = 0 or length(trim(v_event.city)) = 0 or
    v_event.latitude is null or v_event.longitude is null or
    not exists (select 1 from public.ticket_types where event_id = p_event and capacity > 0) then
    raise exception 'ST:incomplete_event';
  end if;
  update public.events set status = 'published' where id = p_event;
end $$;

-- service_role cannot assume direct SELECT access to Supabase's managed auth schema.
-- This exact-email lookup is private, fixed-search-path, and callable only by the server.
create schema if not exists private;
grant usage on schema private to service_role;
create function private.verified_staff_id(p_email text) returns uuid
language sql security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) and email_confirmed_at is not null limit 1;
$$;
revoke all on function private.verified_staff_id(text) from public, anon, authenticated;
grant execute on function private.verified_staff_id(text) to service_role;

create function public.manage_staff(p_actor uuid, p_event uuid, p_email text, p_remove boolean) returns void
language plpgsql set search_path = '' as $$
declare v_owner uuid; v_user uuid;
begin
  select owner_id into v_owner from public.events where id = p_event for update;
  if p_actor is null or v_owner is null or v_owner <> p_actor then raise exception 'ST:forbidden'; end if;
  if p_remove then
    delete from public.event_staff where event_id = p_event and email = lower(trim(p_email));
    return;
  end if;
  v_user := private.verified_staff_id(p_email);
  if v_user is null then raise exception 'ST:unregistered_staff'; end if;
  if v_user = v_owner then raise exception 'ST:owner_is_staff'; end if;
  insert into public.event_staff(event_id, user_id, email) values(p_event, v_user, lower(trim(p_email)))
    on conflict (event_id, user_id) do nothing;
end $$;

create function public.create_order(p_id uuid, p_event uuid, p_name text, p_email text, p_access_hash text) returns uuid
language plpgsql set search_path = '' as $$
declare v_order public.orders; v_type public.ticket_types;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text, 0));
  select * into v_order from public.orders where id = p_id;
  if found then
    if v_order.access_hash <> p_access_hash or v_order.event_id <> p_event or
      v_order.buyer_name <> p_name or v_order.buyer_email <> p_email then raise exception 'ST:idempotency_conflict'; end if;
    return v_order.id;
  end if;
  if not exists(select 1 from public.events where id = p_event and status = 'published' and starts_at > now()) then
    raise exception 'ST:event_unavailable';
  end if;
  select * into v_type from public.ticket_types where event_id = p_event;
  if not found or v_type.sold >= v_type.capacity then raise exception 'ST:sold_out'; end if;
  insert into public.orders(id, event_id, ticket_type_id, buyer_name, buyer_email, amount_cents, access_hash)
    values(p_id, p_event, v_type.id, p_name, p_email, v_type.price_cents, p_access_hash);
  return p_id;
end $$;

create function public.simulate_payment(p_order uuid, p_access_hash text, p_approve boolean, p_token text) returns text
language plpgsql set search_path = '' as $$
declare v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order for update;
  if not found or v_order.access_hash <> p_access_hash then raise exception 'ST:receipt_denied'; end if;
  if v_order.status <> 'pending' then return v_order.status; end if;
  if not p_approve then
    update public.orders set status = 'rejected' where id = p_order;
    return 'rejected';
  end if;
  if not exists(select 1 from public.events where id = v_order.event_id and status = 'published' and starts_at > now()) then
    raise exception 'ST:event_unavailable';
  end if;
  -- Conditional UPDATE locks the stock row. A competing transaction rechecks capacity.
  update public.ticket_types set sold = sold + 1 where id = v_order.ticket_type_id and sold < capacity;
  if not found then raise exception 'ST:sold_out'; end if;
  insert into public.tickets(order_id, event_id, token) values (p_order, v_order.event_id, p_token);
  update public.orders set status = 'paid' where id = p_order;
  return 'paid';
end $$;

create function public.check_in(p_actor uuid, p_event uuid, p_token text) returns jsonb
language plpgsql set search_path = '' as $$
declare v_owner uuid; v_ticket public.tickets; v_check public.check_ins;
begin
  -- Staff revocation takes UPDATE on this same event: checks after revocation fail immediately.
  select owner_id into v_owner from public.events where id = p_event for share;
  if p_actor is null or v_owner is null or (v_owner <> p_actor and not exists (
    select 1 from public.event_staff where event_id = p_event and user_id = p_actor
  )) then raise exception 'ST:forbidden'; end if;
  select * into v_ticket from public.tickets where token = p_token;
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  if v_ticket.event_id <> p_event then return jsonb_build_object('status', 'wrong_event'); end if;
  insert into public.check_ins(ticket_id, event_id, checked_by) values(v_ticket.id, p_event, p_actor)
    on conflict (ticket_id) do nothing returning * into v_check;
  if found then return jsonb_build_object('status', 'accepted', 'checkedAt', v_check.checked_at); end if;
  select * into v_check from public.check_ins where ticket_id = v_ticket.id;
  return jsonb_build_object('status', 'used', 'checkedAt', v_check.checked_at);
end $$;

-- Functions run as invoker. Only the server's service_role can invoke business writes.
revoke all on function public.save_event(uuid, uuid, jsonb), public.publish_event(uuid, uuid),
  public.manage_staff(uuid, uuid, text, boolean), public.create_order(uuid, uuid, text, text, text),
  public.simulate_payment(uuid, text, boolean, text), public.check_in(uuid, uuid, text),
  public.freeze_published_event(), public.freeze_published_type() from public, anon, authenticated;
grant execute on function public.save_event(uuid, uuid, jsonb), public.publish_event(uuid, uuid),
  public.manage_staff(uuid, uuid, text, boolean), public.create_order(uuid, uuid, text, text, text),
  public.simulate_payment(uuid, text, boolean, text), public.check_in(uuid, uuid, text) to service_role;
commit;
