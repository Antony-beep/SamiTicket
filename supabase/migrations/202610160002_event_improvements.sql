-- Apply after 202610160001_mvp.sql. Existing published events are grandfathered.
begin;
alter table public.events add column reference text not null default '' check (length(reference) <= 300);
alter table public.events add column cover_version uuid;
alter table public.events add constraint coordinate_pair check ((latitude is null) = (longitude is null)) not valid;
-- NOT VALID preserves legacy drafts; all new writes must provide a coordinate pair.
create table public.cover_cleanup (
  event_id uuid not null, version uuid not null, not_before timestamptz not null default (now() + interval '1 hour'),
  primary key(event_id, version)
);
alter table public.cover_cleanup enable row level security;
revoke all on public.cover_cleanup from public, anon, authenticated;
grant all on public.cover_cleanup to service_role;

create or replace function public.freeze_published_event() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'published' and (
    (to_jsonb(new) - 'cover_version') is distinct from (to_jsonb(old) - 'cover_version')
    or new.cover_version is null
  ) then raise exception 'ST:published_immutable'; end if;
  return new;
end $$;
create or replace function public.save_event(p_actor uuid, p_id uuid, p_data jsonb) returns uuid
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
    venue = p_data->>'venue', address = p_data->>'address', city = p_data->>'city', reference = coalesce(p_data->>'reference', ''),
    latitude = (p_data->>'latitude')::double precision, longitude = (p_data->>'longitude')::double precision,
    category = p_data->>'category', outdoor = (p_data->>'outdoor')::boolean where id = p_id;
  insert into public.ticket_types(event_id, price_cents, capacity)
    values (p_id, (p_data->>'price_cents')::integer, (p_data->>'capacity')::integer)
    on conflict (event_id) do update set price_cents = excluded.price_cents, capacity = excluded.capacity;
  return p_id;
end $$;

create or replace function public.publish_event(p_actor uuid, p_event uuid) returns void
language plpgsql set search_path = '' as $$
declare v_event public.events;
begin
  select * into v_event from public.events where id = p_event for update;
  if p_actor is null or not found or v_event.owner_id <> p_actor then raise exception 'ST:forbidden'; end if;
  if v_event.status = 'published' then return; end if;
  if v_event.starts_at is null or v_event.starts_at <= now() or
    length(trim(v_event.title)) = 0 or length(trim(v_event.description)) = 0 or
    length(trim(v_event.venue)) = 0 or length(trim(v_event.address)) = 0 or length(trim(v_event.city)) = 0 or
    v_event.latitude is null or v_event.longitude is null or v_event.cover_version is null or
    not exists (select 1 from public.ticket_types where event_id = p_event and capacity > 0) then
    raise exception 'ST:incomplete_event';
  end if;
  update public.events set status = 'published' where id = p_event;
end $$;

create or replace function public.create_order(p_id uuid, p_event uuid, p_name text, p_email text, p_access_hash text) returns uuid
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
  perform 1 from public.events where id = p_event and status = 'published' and starts_at > now() for share;
  if not found then
    raise exception 'ST:event_unavailable';
  end if;
  select * into v_type from public.ticket_types where event_id = p_event;
  if not found or v_type.sold >= v_type.capacity then raise exception 'ST:sold_out'; end if;
  insert into public.orders(id, event_id, ticket_type_id, buyer_name, buyer_email, amount_cents, access_hash)
    values(p_id, p_event, v_type.id, p_name, p_email, v_type.price_cents, p_access_hash);
  return p_id;
end $$;


-- Compare-and-swap prevents concurrent replacements from orphaning or deleting the winner.
create function public.set_event_cover(p_actor uuid, p_event uuid, p_expected uuid, p_version uuid) returns void
language plpgsql set search_path = '' as $$
declare v_event public.events;
begin
  select * into v_event from public.events where id = p_event for update;
  if p_actor is null or not found or v_event.owner_id <> p_actor then raise exception 'ST:forbidden'; end if;
  if v_event.cover_version is distinct from p_expected then raise exception 'ST:cover_conflict'; end if;
  if p_version is null and v_event.status = 'published' then raise exception 'ST:published_immutable'; end if;
  if p_version is not null and not exists(select 1 from public.cover_cleanup where event_id = p_event and version = p_version and not_before > now()) then
    raise exception 'ST:cover_conflict';
  end if;
  update public.events set cover_version = p_version where id = p_event;
  delete from public.cover_cleanup where event_id = p_event and version = p_version;
  if v_event.cover_version is not null and v_event.cover_version is distinct from p_version then
    insert into public.cover_cleanup(event_id, version, not_before) values(p_event, v_event.cover_version, now())
      on conflict(event_id, version) do update set not_before = excluded.not_before;
  end if;
end $$;

create function public.delete_event(p_actor uuid, p_event uuid) returns void
language plpgsql set search_path = '' as $$
declare v_event public.events;
begin
  -- Same lock order as save; create_order holds SHARE through its insert.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event::text, 0));
  select * into v_event from public.events where id = p_event for update;
  if p_actor is null or not found or v_event.owner_id <> p_actor then raise exception 'ST:forbidden'; end if;
  if exists(select 1 from public.orders where event_id = p_event) then raise exception 'ST:event_has_orders'; end if;
  if v_event.cover_version is not null then
    insert into public.cover_cleanup(event_id, version, not_before) values(p_event, v_event.cover_version, now())
      on conflict(event_id, version) do update set not_before = excluded.not_before;
  end if;
  delete from public.event_staff where event_id = p_event;
  delete from public.ticket_types where event_id = p_event;
  delete from public.events where id = p_event;
end $$;
revoke all on function public.set_event_cover(uuid,uuid,uuid,uuid), public.delete_event(uuid,uuid) from public, anon, authenticated;
grant execute on function public.set_event_cover(uuid,uuid,uuid,uuid), public.delete_event(uuid,uuid) to service_role;

-- Private originals are never stored. No Storage read/write policies are granted to clients.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('event-covers', 'event-covers', false, 360000, array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
commit;
