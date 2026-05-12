-- Public read-only RLS setup for the main data tables.
-- Keeps the tables readable by anon/authenticated users while avoiding open write access.

alter table public.pizzerior enable row level security;
drop policy if exists "Allow public read" on public.pizzerior;
create policy "Allow public read"
on public.pizzerior
for select
to anon, authenticated
using (true);

alter table public.pizzor enable row level security;
drop policy if exists "Allow public read" on public.pizzor;
create policy "Allow public read"
on public.pizzor
for select
to anon, authenticated
using (true);

alter table public.extras enable row level security;
drop policy if exists "Allow public read" on public.extras;
create policy "Allow public read"
on public.extras
for select
to anon, authenticated
using (true);