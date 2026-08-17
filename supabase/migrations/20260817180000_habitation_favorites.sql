-- Phase 9b — Favoris d'Habitation : filtre l'accueil pour qu'il ne montre
-- que les Habitations que l'utilisateur a explicitement marquées comme
-- favorites, plutôt que TOUT ce qu'il peut voir (y compris les objets de
-- chaque ami dès qu'une Habitation est partagée). Existence de ligne = vrai,
-- même philosophie que friend_group_members/habitation_shares déjà en base.

create table public.habitation_favorites (
  habitation_id uuid not null references public.habitations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (habitation_id, user_id)
);

create index habitation_favorites_user_idx on public.habitation_favorites (user_id);

alter table public.habitation_favorites enable row level security;

-- `using` ne vérifie que la propriété de la ligne (mes propres favoris) ;
-- `with check` vérifie EN PLUS que j'ai bien accès à l'Habitation visée au
-- moment d'écrire — empêche de "favoriser" une Habitation qu'on ne peut pas
-- voir. Une ligne qui deviendrait périmée après un retrait de partage
-- resterait lisible ici mais ne remonterait plus rien via le join dans
-- search_index() : la RLS de pieces/objets/etc. reste la vraie frontière.
create policy "habitation_favorites_all_own" on public.habitation_favorites
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_habitation_access(habitation_id, auth.uid(), 'consultation'));

-- Favori automatique de ses PROPRES Habitations à la création — préserve le
-- comportement actuel (tout ce qu'on possède apparaît déjà sur l'accueil)
-- sans action manuelle. Une Habitation reçue par partage n'est JAMAIS
-- favorite par défaut : c'est tout le but du filtre, éviter que l'accueil
-- se noie dans les objets des amis dès qu'un partage est accepté.
create function public.auto_favorite_own_habitation()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.habitation_favorites (habitation_id, user_id) values (new.id, new.user_id);
  return new;
end;
$$;

create trigger habitations_auto_favorite
  after insert on public.habitations
  for each row execute function public.auto_favorite_own_habitation();

-- Rétrocompatibilité : sans ce backfill, TOUTES les Habitations existantes
-- (créées avant ce trigger) disparaîtraient de l'accueil de tous les
-- utilisateurs actuels dès l'application de cette migration.
insert into public.habitation_favorites (habitation_id, user_id)
select id, user_id from public.habitations;

-- === search_index() filtré aux Habitations favorites =====================
-- Signature inchangée (mêmes colonnes de retour) donc CREATE OR REPLACE
-- suffit. Un join supplémentaire vers habitation_favorites dans chacune des
-- 4 branches, juste après le join habitations déjà présent — security
-- invoker inchangé, ce join est un filtre d'affichage, pas une frontière de
-- sécurité (la RLS de chaque table source reste la vraie protection).
create or replace function public.search_index()
returns table (
  kind text,
  id uuid,
  name text,
  photo_url text,
  preset_key text,
  piece_id uuid,
  piece_name text,
  habitation_id uuid,
  habitation_name text,
  habitation_icon text,
  parent_label text
)
language sql stable security invoker set search_path = public as $$
  select
    'objet'::text, o.id, o.name, o.photo_url, null::text,
    p.id, p.name, h.id, h.name, h.icon,
    coalesce(oc.name, e.name)
  from public.objets o
  left join public.conteneurs oc on oc.id = o.parent_conteneur_id
  join public.emplacements e
    on e.id = coalesce(o.parent_emplacement_id, public.conteneur_root_emplacement(o.parent_conteneur_id))
  join public.pieces p on p.id = e.piece_id
  join public.habitations h on h.id = p.habitation_id
  join public.habitation_favorites fav on fav.habitation_id = h.id and fav.user_id = auth.uid()

  union all

  select
    'conteneur'::text, c.id, c.name, null::text, null::text,
    p.id, p.name, h.id, h.name, h.icon,
    coalesce(pc.name, e.name)
  from public.conteneurs c
  left join public.conteneurs pc on pc.id = c.parent_conteneur_id
  join public.emplacements e
    on e.id = coalesce(c.parent_emplacement_id, public.conteneur_root_emplacement(c.parent_conteneur_id))
  join public.pieces p on p.id = e.piece_id
  join public.habitations h on h.id = p.habitation_id
  join public.habitation_favorites fav on fav.habitation_id = h.id and fav.user_id = auth.uid()

  union all

  select
    'emplacement'::text, e.id, e.name, null::text, e.preset_key,
    p.id, p.name, h.id, h.name, h.icon,
    null::text
  from public.emplacements e
  join public.pieces p on p.id = e.piece_id
  join public.habitations h on h.id = p.habitation_id
  join public.habitation_favorites fav on fav.habitation_id = h.id and fav.user_id = auth.uid()

  union all

  select
    'piece'::text, pc.id, pc.name, null::text, pc.preset_key,
    pc.id, pc.name, h.id, h.name, h.icon,
    null::text
  from public.pieces pc
  join public.habitations h on h.id = pc.habitation_id
  join public.habitation_favorites fav on fav.habitation_id = h.id and fav.user_id = auth.uid()
$$;
