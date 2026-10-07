-- TRADING EMPIRE — cloud saves (2.1)
-- One save per (account, slot); writes go through te_push_save(), which checks the revision the device is
-- based on, so an older device can never silently overwrite a newer save. Up to 5 previous versions are kept.
-- Row Level Security everywhere: an account can only ever read or delete its own rows.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.saves (
  user_id uuid not null references auth.users (id) on delete cascade,
  slot smallint not null default 0 check (slot between 0 and 9),
  revision bigint not null default 1 check (revision > 0),
  payload text not null,
  encoding text not null default 'json' check (encoding in ('json', 'gz64')),
  checksum text not null,
  size integer not null default 0,
  game_version text,
  save_version integer,
  device_id text,
  device_label text,
  summary jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot),
  constraint saves_payload_size check (octet_length(payload) <= 8000000)
);

create table if not exists public.save_backups (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  slot smallint not null,
  revision bigint not null,
  payload text not null,
  encoding text not null,
  checksum text not null,
  size integer not null default 0,
  game_version text,
  save_version integer,
  device_id text,
  device_label text,
  summary jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null,
  archived_at timestamptz not null default now()
);
create index if not exists save_backups_user_slot_idx on public.save_backups (user_id, slot, revision desc);

alter table public.profiles enable row level security;
alter table public.saves enable row level security;
alter table public.save_backups enable row level security;

-- Own rows only. No INSERT/UPDATE policy on saves/save_backups: writes happen exclusively in te_push_save().
drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own" on public.profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "saves_select_own" on public.saves;
create policy "saves_select_own" on public.saves for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "saves_delete_own" on public.saves;
create policy "saves_delete_own" on public.saves for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists "backups_select_own" on public.save_backups;
create policy "backups_select_own" on public.save_backups for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "backups_delete_own" on public.save_backups;
create policy "backups_delete_own" on public.save_backups for delete to authenticated using (user_id = (select auth.uid()));

-- Least privilege for the API roles (RLS still applies on top).
revoke all on public.profiles, public.saves, public.save_backups from anon;
revoke insert, update, truncate, references, trigger on public.saves, public.save_backups from authenticated;
grant select, delete on public.saves, public.save_backups to authenticated;
grant select, insert, update on public.profiles to authenticated;

-- Revision-checked write. Returns {status:'ok', revision, updated_at} or {status:'conflict', ...cloud metadata}.
-- p_force = the player explicitly chose to overwrite the cloud save (the overwritten version is archived first).
create or replace function public.te_push_save(
  p_slot smallint,
  p_base_revision bigint,
  p_force boolean,
  p_payload text,
  p_encoding text,
  p_checksum text,
  p_size integer,
  p_game_version text,
  p_save_version integer,
  p_device_id text,
  p_device_label text,
  p_summary jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cur public.saves%rowtype;
  new_rev bigint;
  last_backup timestamptz;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_slot is null or p_slot < 0 or p_slot > 9 then raise exception 'invalid slot'; end if;
  if p_encoding not in ('json', 'gz64') then raise exception 'invalid encoding'; end if;
  if p_payload is null or octet_length(p_payload) > 8000000 then raise exception 'invalid payload size'; end if;
  if p_checksum is null or length(p_checksum) > 200 then raise exception 'invalid checksum'; end if;

  select * into cur from public.saves s where s.user_id = uid and s.slot = p_slot for update;

  if not found then
    insert into public.saves (user_id, slot, revision, payload, encoding, checksum, size, game_version, save_version, device_id, device_label, summary, updated_at)
    values (uid, p_slot, 1, p_payload, p_encoding, p_checksum, coalesce(p_size, 0), left(p_game_version, 40), p_save_version,
            left(p_device_id, 80), left(p_device_label, 80), coalesce(p_summary, '{}'::jsonb), now());
    insert into public.profiles (user_id) values (uid) on conflict (user_id) do nothing;
    return jsonb_build_object('status', 'ok', 'revision', 1, 'updated_at', now());
  end if;

  if cur.revision <> coalesce(p_base_revision, 0) and not coalesce(p_force, false) then
    return jsonb_build_object('status', 'conflict', 'revision', cur.revision, 'updated_at', cur.updated_at,
      'device_id', cur.device_id, 'device_label', cur.device_label, 'summary', cur.summary,
      'checksum', cur.checksum, 'game_version', cur.game_version);
  end if;

  if cur.checksum = p_checksum then
    return jsonb_build_object('status', 'ok', 'revision', cur.revision, 'updated_at', cur.updated_at, 'unchanged', true);
  end if;

  -- archive the version being replaced: always when overwriting on purpose or from another device,
  -- otherwise at most every 30 minutes (so the 5 kept versions span hours of play, not minutes)
  select max(b.archived_at) into last_backup from public.save_backups b where b.user_id = uid and b.slot = p_slot;
  if coalesce(p_force, false) or cur.device_id is distinct from left(p_device_id, 80)
     or last_backup is null or last_backup < now() - interval '30 minutes' then
    insert into public.save_backups (user_id, slot, revision, payload, encoding, checksum, size, game_version, save_version, device_id, device_label, summary, updated_at)
    values (uid, cur.slot, cur.revision, cur.payload, cur.encoding, cur.checksum, cur.size, cur.game_version, cur.save_version,
            cur.device_id, cur.device_label, cur.summary, cur.updated_at);
    delete from public.save_backups b
     where b.user_id = uid and b.slot = p_slot
       and b.id not in (select b2.id from public.save_backups b2 where b2.user_id = uid and b2.slot = p_slot
                        order by b2.archived_at desc, b2.id desc limit 5);
  end if;

  new_rev := cur.revision + 1;
  update public.saves s
     set revision = new_rev, payload = p_payload, encoding = p_encoding, checksum = p_checksum, size = coalesce(p_size, 0),
         game_version = left(p_game_version, 40), save_version = p_save_version, device_id = left(p_device_id, 80),
         device_label = left(p_device_label, 80), summary = coalesce(p_summary, '{}'::jsonb), updated_at = now()
   where s.user_id = uid and s.slot = p_slot;
  return jsonb_build_object('status', 'ok', 'revision', new_rev, 'updated_at', now());
end;
$$;

revoke all on function public.te_push_save(smallint, bigint, boolean, text, text, text, integer, text, integer, text, text, jsonb) from public, anon;
grant execute on function public.te_push_save(smallint, bigint, boolean, text, text, text, integer, text, integer, text, text, jsonb) to authenticated;
