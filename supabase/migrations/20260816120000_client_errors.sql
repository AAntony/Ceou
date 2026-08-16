-- Journal d'erreurs/crashs client léger — alternative maison à un service
-- tiers type Sentry (pas de nouveau compte à créer, pas de module natif
-- donc aucun rebuild nécessaire pour les utilisateurs déjà installés).
-- Écriture seule côté client (insert), lecture réservée au propriétaire du
-- projet via Supabase Studio (dashboard, accès qui contourne RLS) : aucune
-- policy select n'est délibérément définie pour les rôles client.
create table public.client_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  message text not null,
  stack text,
  context jsonb,
  app_version text,
  git_commit text,
  platform text,
  created_at timestamptz not null default now()
);

create index client_errors_created_at_idx on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;

-- `user_id is null` autorisé : une erreur peut survenir avant connexion
-- (écran de login, par exemple). `auth.uid() = user_id` sinon, pour qu'un
-- client authentifié ne puisse pas usurper l'id d'un autre utilisateur dans
-- ses propres logs.
create policy "client_errors_insert" on public.client_errors
  for insert
  to anon, authenticated
  with check (user_id is null or auth.uid() = user_id);
