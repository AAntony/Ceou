-- Catégories d'amis : « Famille », « Coloc », « Amis »...
--
-- CE QUE CE N'EST PAS. Les `friend_groups` retirés le 17/08 étaient une
-- UNITÉ DE PARTAGE : `habitation_shares.shared_with_group_id` traversait
-- chaque policy RLS, et ajouter quelqu'un au groupe lui ouvrait aussitôt les
-- accès du groupe. C'est cette moitié-là qui avait été jugée inutile à
-- l'usage, et elle ne revient pas.
--
-- Ici, une catégorie est un pur RANGEMENT, visible du seul propriétaire :
-- rien dans ce fichier ne touche à `habitation_shares`, à `has_habitation_
-- access` ni à la moindre policy existante. Le partage reste ami par ami.
-- Un ami ne sait même pas dans quelle catégorie on l'a mis.

create table public.friend_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- Ordre d'affichage choisi par le propriétaire. Un entier plutôt qu'un
  -- tri alphabétique : « Famille » avant « Amis » est un choix personnel,
  -- pas une question d'alphabet.
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index friend_categories_owner_idx on public.friend_categories (owner_id);

alter table public.friend_categories enable row level security;

create policy "friend_categories_all_own" on public.friend_categories
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());


-- Affectation d'un ami à une catégorie.
--
-- LA CLÉ PRIMAIRE PORTE LA RÈGLE MÉTIER : (owner_id, friend_user_id) rend
-- structurellement impossible qu'un ami soit dans deux catégories à la fois
-- (décision produit du 2026-08-21). Pas de contrainte applicative à écrire,
-- pas de doublon possible même si deux appareils écrivent en même temps.
--
-- `on delete cascade` sur la catégorie : la supprimer libère ses amis, qui
-- retombent dans « Sans catégorie ». Aucun ami n'est jamais perdu avec elle.
create table public.friend_category_members (
  owner_id uuid not null references auth.users (id) on delete cascade,
  friend_user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.friend_categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_user_id)
);

create index friend_category_members_category_idx on public.friend_category_members (category_id);

alter table public.friend_category_members enable row level security;

create policy "friend_category_members_all_own" on public.friend_category_members
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());


-- Nombre d'habitations partagées avec chaque ami, DANS LES DEUX SENS.
--
-- C'est l'information affichée sous le nom de l'ami, et « ce qu'il y a entre
-- nous » n'a de sens que symétrique : une habitation que je lui ai ouverte
-- compte autant qu'une qu'il m'a ouverte. `count(distinct)` parce qu'une
-- même habitation pourrait apparaître des deux côtés.
--
-- `security invoker` : la RLS de `habitation_shares` et `habitations`
-- s'applique normalement, la fonction ne peut donc rien révéler que
-- l'appelant ne puisse déjà lire.
create or replace function public.friend_shared_habitation_counts()
returns table (friend_user_id uuid, habitation_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with echanges as (
    -- Ce que JE partage avec quelqu'un.
    select s.shared_with_user_id as friend_id, s.habitation_id
    from public.habitation_shares s
    join public.habitations h on h.id = s.habitation_id
    where h.user_id = auth.uid()
    union all
    -- Ce que quelqu'un partage avec MOI.
    select h.user_id as friend_id, s.habitation_id
    from public.habitation_shares s
    join public.habitations h on h.id = s.habitation_id
    where s.shared_with_user_id = auth.uid()
  )
  select friend_id, count(distinct habitation_id)::bigint
  from echanges
  where friend_id is not null
  group by friend_id
$$;
