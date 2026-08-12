-- Fil d'ariane complet d'un objet (Habitation > Pièce > Emplacement >
-- Conteneur(s)) pour la fiche objet — un seul aller-retour plutôt que de
-- remonter la chaîne récursive de conteneurs à la main côté client (nombre
-- de niveaux imbriqués inconnu à l'avance).
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
    select p.id, p.name, p.habitation_id
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
    select 'piece'::text, piece_row.id, piece_row.name, null::text, 1
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
