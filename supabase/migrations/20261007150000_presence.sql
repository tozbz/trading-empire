-- TRADING EMPIRE — live player counter (2.2)
-- Each running game sends an anonymous heartbeat (random id for that page load only, no personal data).
-- Rows older than 10 minutes are deleted; the function returns the number of games seen in the last 2 minutes.
create table if not exists public.presence (
  sid text primary key check (length(sid) between 8 and 64),
  seen_at timestamptz not null default now()
);
alter table public.presence enable row level security;
revoke all on public.presence from anon, authenticated;

create or replace function public.te_ping(p_sid text) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  if p_sid is null or length(p_sid) < 8 or length(p_sid) > 64 then
    raise exception 'invalid id';
  end if;
  insert into public.presence (sid, seen_at) values (p_sid, now())
    on conflict (sid) do update set seen_at = now();
  delete from public.presence p where p.seen_at < now() - interval '10 minutes';
  select count(*) into n from public.presence p where p.seen_at > now() - interval '2 minutes';
  return n;
end;
$$;
revoke all on function public.te_ping(text) from public;
grant execute on function public.te_ping(text) to anon, authenticated;
