-- Les Pièces gagnent une catégorie suggérée (Chambre, Séjour, Cuisine...),
-- même pattern que emplacements.preset_key : simple étiquette texte non
-- contrainte, la liste des valeurs valides reste un détail client
-- (src/features/inventory/constants.ts), pas une contrainte DB.
alter table public.pieces add column preset_key text;

-- search_index() et objet_location_chain() renvoyaient déjà une colonne
-- preset_key pour les lignes 'piece' (toujours null faute de donnée) —
-- on la branche maintenant sur la vraie colonne, signature inchangée donc
-- create or replace suffit.
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

  union all

  select
    'emplacement'::text, e.id, e.name, null::text, e.preset_key,
    p.id, p.name, h.id, h.name, h.icon,
    null::text
  from public.emplacements e
  join public.pieces p on p.id = e.piece_id
  join public.habitations h on h.id = p.habitation_id

  union all

  select
    'piece'::text, pc.id, pc.name, null::text, pc.preset_key,
    pc.id, pc.name, h.id, h.name, h.icon,
    null::text
  from public.pieces pc
  join public.habitations h on h.id = pc.habitation_id
$$;

create or replace function public.objet_location_chain(p_objet_id uuid)
returns table (
  kind text,
  id uuid,
  name text,
  preset_key text
)
language sql stable security invoker set search_path = public as $$
  with recursive objet_row as (
    select o.parent_emplacement_id, o.parent_conteneur_id
    from public.objets o
    where o.id = p_objet_id
  ),
  conteneur_chain as (
    select c.id, c.name, c.parent_emplacement_id, c.parent_conteneur_id, 1 as depth
    from public.conteneurs c
    join objet_row r on r.parent_conteneur_id = c.id
    union all
    select c.id, c.name, c.parent_emplacement_id, c.parent_conteneur_id, cc.depth + 1
    from public.conteneurs c
    join conteneur_chain cc on cc.parent_conteneur_id = c.id
  ),
  resolved_emplacement_id as (
    select coalesce(
      (select parent_emplacement_id from objet_row),
      (select parent_emplacement_id from conteneur_chain where parent_emplacement_id is not null order by depth desc limit 1)
    ) as id
  ),
  emplacement_row as (
    select e.id, e.name, e.preset_key, e.piece_id
    from public.emplacements e, resolved_emplacement_id r
    where e.id = r.id
  ),
  piece_row as (
    select p.id, p.name, p.preset_key, p.habitation_id
    from public.pieces p
    join emplacement_row e on e.piece_id = p.id
  ),
  habitation_row as (
    select h.id, h.name
    from public.habitations h
    join piece_row p on p.habitation_id = h.id
  )
  select t.kind, t.id, t.name, t.preset_key
  from (
    select 'habitation'::text as kind, habitation_row.id, habitation_row.name, null::text as preset_key, 0 as sort_order
    from habitation_row
    union all
    select 'piece'::text, piece_row.id, piece_row.name, piece_row.preset_key, 1
    from piece_row
    union all
    select 'emplacement'::text, emplacement_row.id, emplacement_row.name, emplacement_row.preset_key, 2
    from emplacement_row
    union all
    select 'conteneur'::text, cc.id, cc.name, null::text, 90 - cc.depth
    from conteneur_chain cc
  ) t
  order by t.sort_order
$$;
