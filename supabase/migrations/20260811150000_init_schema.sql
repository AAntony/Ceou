-- Ceou — schema initial (Phase 0/1: profils + arborescence complète posée d'un coup)
-- Hiérarchie : habitations -> pieces -> emplacements -> conteneurs* -> objets
-- Les listes "génériques" (types d'habitation, presets d'emplacement, formes de plan)
-- restent des constantes côté app (FR/EN), pas des tables : ce sont de simples
-- suggestions non éditables par l'utilisateur, pas une donnée métier.

-- === profiles ===================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Crée automatiquement le profil à l'inscription (sinon la ligne n'existe pas
-- tant que l'utilisateur n'a rien modifié, et le reste de l'app suppose qu'elle existe).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, locale)
  values (new.id, 'fr');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- === habitations / pieces / emplacements ========================

create table public.habitations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null,
  icon text,
  created_at timestamptz not null default now()
);

create table public.pieces (
  id uuid primary key default gen_random_uuid(),
  habitation_id uuid not null references public.habitations (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.emplacements (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references public.pieces (id) on delete cascade,
  name text not null,
  preset_key text,
  created_at timestamptz not null default now()
);

create index habitations_user_id_idx on public.habitations (user_id);
create index pieces_habitation_id_idx on public.pieces (habitation_id);
create index emplacements_piece_id_idx on public.emplacements (piece_id);

-- Résout le propriétaire d'un Emplacement en remontant Piece -> Habitation.
-- security definer : les policies RLS des tables intermédiaires ne doivent pas
-- interférer avec cette résolution, seul le résultat (l'uid propriétaire) compte.
create function public.emplacement_owner(p_emplacement_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select h.user_id
  from public.emplacements e
  join public.pieces p on p.id = e.piece_id
  join public.habitations h on h.id = p.habitation_id
  where e.id = p_emplacement_id
$$;

alter table public.habitations enable row level security;
alter table public.pieces enable row level security;
alter table public.emplacements enable row level security;

create policy "habitations_all_own" on public.habitations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "pieces_all_own" on public.pieces
  for all using (
    exists (select 1 from public.habitations h where h.id = habitation_id and h.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.habitations h where h.id = habitation_id and h.user_id = auth.uid())
  );

create policy "emplacements_all_own" on public.emplacements
  for all using (public.emplacement_owner(id) = auth.uid())
  with check (
    exists (
      select 1 from public.pieces p
      join public.habitations h on h.id = p.habitation_id
      where p.id = piece_id and h.user_id = auth.uid()
    )
  );

-- === conteneurs (récursif) =======================================

create table public.conteneurs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_emplacement_id uuid references public.emplacements (id) on delete cascade,
  parent_conteneur_id uuid references public.conteneurs (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint conteneurs_exactly_one_parent check (
    (parent_emplacement_id is not null)::int + (parent_conteneur_id is not null)::int = 1
  )
);

create index conteneurs_parent_emplacement_idx on public.conteneurs (parent_emplacement_id);
create index conteneurs_parent_conteneur_idx on public.conteneurs (parent_conteneur_id);

-- Remonte la chaîne de Conteneurs jusqu'à l'Emplacement racine, puis résout
-- le propriétaire via emplacement_owner. Profondeur d'imbrication utilisateur
-- réaliste (quelques niveaux), une CTE récursive suffit largement ici.
create function public.conteneur_owner(p_conteneur_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select id, parent_emplacement_id, parent_conteneur_id
    from public.conteneurs
    where id = p_conteneur_id
    union all
    select c.id, c.parent_emplacement_id, c.parent_conteneur_id
    from public.conteneurs c
    join chain on chain.parent_conteneur_id = c.id
  )
  select public.emplacement_owner(parent_emplacement_id)
  from chain
  where parent_emplacement_id is not null
  limit 1
$$;

alter table public.conteneurs enable row level security;

create policy "conteneurs_all_own" on public.conteneurs
  for all using (public.conteneur_owner(id) = auth.uid())
  with check (
    case
      when parent_emplacement_id is not null then public.emplacement_owner(parent_emplacement_id) = auth.uid()
      else public.conteneur_owner(parent_conteneur_id) = auth.uid()
    end
  );

-- === objets =======================================================

create table public.objets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  photo_url text,
  barcode text,
  parent_emplacement_id uuid references public.emplacements (id) on delete cascade,
  parent_conteneur_id uuid references public.conteneurs (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint objets_exactly_one_parent check (
    (parent_emplacement_id is not null)::int + (parent_conteneur_id is not null)::int = 1
  )
);

create index objets_parent_emplacement_idx on public.objets (parent_emplacement_id);
create index objets_parent_conteneur_idx on public.objets (parent_conteneur_id);

create function public.objet_owner(p_parent_emplacement_id uuid, p_parent_conteneur_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    public.emplacement_owner(p_parent_emplacement_id),
    public.conteneur_owner(p_parent_conteneur_id)
  )
$$;

alter table public.objets enable row level security;

create policy "objets_all_own" on public.objets
  for all using (public.objet_owner(parent_emplacement_id, parent_conteneur_id) = auth.uid())
  with check (public.objet_owner(parent_emplacement_id, parent_conteneur_id) = auth.uid());

-- === historique de déplacement ====================================

create table public.objet_deplacements (
  id uuid primary key default gen_random_uuid(),
  objet_id uuid not null references public.objets (id) on delete cascade,
  from_location_type text check (from_location_type in ('emplacement', 'conteneur')),
  from_location_id uuid,
  from_location_label text,
  to_location_type text not null check (to_location_type in ('emplacement', 'conteneur')),
  to_location_id uuid not null,
  to_location_label text not null,
  moved_at timestamptz not null default now()
);

create index objet_deplacements_objet_id_idx on public.objet_deplacements (objet_id);

alter table public.objet_deplacements enable row level security;

create policy "objet_deplacements_all_own" on public.objet_deplacements
  for all using (
    exists (
      select 1 from public.objets o
      where o.id = objet_id
        and public.objet_owner(o.parent_emplacement_id, o.parent_conteneur_id) = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.objets o
      where o.id = objet_id
        and public.objet_owner(o.parent_emplacement_id, o.parent_conteneur_id) = auth.uid()
    )
  );

-- === plan 2D =======================================================

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  habitation_id uuid not null references public.habitations (id) on delete cascade,
  name text not null,
  floor_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.plan_formes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  shape_type text not null,
  x real not null default 0,
  y real not null default 0,
  width real not null default 1,
  height real not null default 1,
  rotation real not null default 0,
  emplacement_id uuid references public.emplacements (id) on delete set null,
  created_at timestamptz not null default now()
);

create index plans_habitation_id_idx on public.plans (habitation_id);
create index plan_formes_plan_id_idx on public.plan_formes (plan_id);

alter table public.plans enable row level security;
alter table public.plan_formes enable row level security;

create policy "plans_all_own" on public.plans
  for all using (
    exists (select 1 from public.habitations h where h.id = habitation_id and h.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.habitations h where h.id = habitation_id and h.user_id = auth.uid())
  );

create policy "plan_formes_all_own" on public.plan_formes
  for all using (
    exists (
      select 1 from public.plans pl
      join public.habitations h on h.id = pl.habitation_id
      where pl.id = plan_id and h.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.plans pl
      join public.habitations h on h.id = pl.habitation_id
      where pl.id = plan_id and h.user_id = auth.uid()
    )
  );

-- === stockage : avatars ============================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatar_owner_write" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar_owner_update" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar_owner_delete" on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
