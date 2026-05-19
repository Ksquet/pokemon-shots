create table if not exists public.app_state (
    id text primary key,
    data jsonb,
    updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "pokemon_shots_read_app_state" on public.app_state;
drop policy if exists "pokemon_shots_insert_app_state" on public.app_state;
drop policy if exists "pokemon_shots_update_app_state" on public.app_state;
drop policy if exists "pokemon_shots_delete_app_state" on public.app_state;

create policy "pokemon_shots_read_app_state"
on public.app_state
for select
to anon
using (true);

create policy "pokemon_shots_insert_app_state"
on public.app_state
for insert
to anon
with check (id in (
    'pokemonShotsAccountDb',
    'pokemonShotsPartyState',
    'pokemonShotsPartyDefaultSettings'
));

create policy "pokemon_shots_update_app_state"
on public.app_state
for update
to anon
using (id in (
    'pokemonShotsAccountDb',
    'pokemonShotsPartyState',
    'pokemonShotsPartyDefaultSettings'
))
with check (id in (
    'pokemonShotsAccountDb',
    'pokemonShotsPartyState',
    'pokemonShotsPartyDefaultSettings'
));

create policy "pokemon_shots_delete_app_state"
on public.app_state
for delete
to anon
using (id in (
    'pokemonShotsAccountDb',
    'pokemonShotsPartyState',
    'pokemonShotsPartyDefaultSettings'
));
