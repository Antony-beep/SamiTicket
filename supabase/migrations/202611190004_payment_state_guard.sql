begin;

-- A delayed pending/rejected snapshot must never replace an already approved payment.
create or replace function public.preserve_mp_approved_state() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.state='approved' and new.state in ('pending','in_process','authorized','rejected','cancelled') then
    new.state:=old.state;
  end if;
  return new;
end $$;
drop trigger if exists mp_preserve_approved_state on public.mp_payments;
create trigger mp_preserve_approved_state before update on public.mp_payments
  for each row execute function public.preserve_mp_approved_state();
revoke all on function public.preserve_mp_approved_state() from public, anon, authenticated;
commit;
