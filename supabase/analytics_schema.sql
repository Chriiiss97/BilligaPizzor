-- Rensa eventuella kvarlevor från tidigare version av projektet
drop table if exists public.events cascade;
drop view if exists public.events cascade;

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  role text not null default 'owner' check (role in ('owner', 'admin')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  event_name text not null check (char_length(trim(event_name)) >= 2),
  page_path text,
  page_title text,
  client_type text not null default 'web' check (client_type in ('web', 'app', 'admin')),
  platform text,
  session_id text,
  visitor_id text,
  entity_type text,
  entity_slug text,
  search_term text,
  app_version text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);

create index if not exists analytics_events_event_name_idx
  on public.analytics_events (event_name);

create index if not exists analytics_events_client_type_idx
  on public.analytics_events (client_type);

create index if not exists analytics_events_entity_lookup_idx
  on public.analytics_events (entity_type, entity_slug);

create index if not exists analytics_events_page_path_idx
  on public.analytics_events (page_path);

create index if not exists analytics_events_search_term_idx
  on public.analytics_events (search_term);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users admin_user
    where admin_user.user_id = auth.uid()
  );
$$;

create or replace function public.log_analytics_event(
  p_event_name text,
  p_page_path text default null,
  p_page_title text default null,
  p_client_type text default 'web',
  p_platform text default null,
  p_session_id text default null,
  p_visitor_id text default null,
  p_entity_type text default null,
  p_entity_slug text default null,
  p_search_term text default null,
  p_app_version text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_event_name text;
  v_client_type text;
begin
  v_event_name := left(trim(coalesce(p_event_name, '')), 80);
  v_client_type := lower(trim(coalesce(p_client_type, 'web')));

  if v_event_name = '' then
    raise exception 'event_name is required';
  end if;

  if v_client_type not in ('web', 'app', 'admin') then
    v_client_type := 'web';
  end if;

  insert into public.analytics_events (
    event_name,
    page_path,
    page_title,
    client_type,
    platform,
    session_id,
    visitor_id,
    entity_type,
    entity_slug,
    search_term,
    app_version,
    metadata
  )
  values (
    v_event_name,
    nullif(left(trim(coalesce(p_page_path, '')), 300), ''),
    nullif(left(trim(coalesce(p_page_title, '')), 200), ''),
    v_client_type,
    nullif(left(trim(coalesce(p_platform, '')), 50), ''),
    nullif(left(trim(coalesce(p_session_id, '')), 120), ''),
    nullif(left(trim(coalesce(p_visitor_id, '')), 120), ''),
    nullif(left(trim(coalesce(p_entity_type, '')), 80), ''),
    nullif(left(trim(coalesce(p_entity_slug, '')), 160), ''),
    nullif(left(trim(coalesce(p_search_term, '')), 120), ''),
    nullif(left(trim(coalesce(p_app_version, '')), 40), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

alter table public.admin_users enable row level security;
alter table public.analytics_events enable row level security;

drop policy if exists "admin_users_self_select" on public.admin_users;
create policy "admin_users_self_select"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "analytics_events_admin_select" on public.analytics_events;
create policy "analytics_events_admin_select"
on public.analytics_events
for select
to authenticated
using (public.is_admin());

drop policy if exists "analytics_events_admin_delete" on public.analytics_events;
create policy "analytics_events_admin_delete"
on public.analytics_events
for delete
to authenticated
using (public.is_admin());

revoke all on public.analytics_events from anon, authenticated;
revoke all on public.admin_users from anon;

grant execute on function public.log_analytics_event(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) to anon, authenticated;

grant execute on function public.is_admin() to authenticated;

comment on table public.admin_users is 'Users allowed to access the private analytics dashboard.';
comment on table public.analytics_events is 'Raw analytics events from the public website and Capacitor app.';
comment on function public.log_analytics_event(text, text, text, text, text, text, text, text, text, text, text, jsonb)
  is 'Safe insert function for public analytics events. Use this from the site/app instead of direct inserts.';

-- Efter att du skapat ditt eget konto i Supabase Auth:
-- byt ut e-postadressen nedan och kör raden en gång.
-- insert into public.admin_users (user_id, email, role)
-- select id, email, 'owner'
-- from auth.users
-- where email = 'din-epost@exempel.se'
-- on conflict (user_id) do update set email = excluded.email, role = excluded.role;
