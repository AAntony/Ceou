-- Le fil d'ariane d'un objet dit maintenant si sa Pièce est la pièce par
-- défaut d'une habitation mono-espace (Garage, Cave, Box, Véhicule...).
--
-- POURQUOI MAINTENANT. Les maillons du fil deviennent cliquables côté client.
-- Or cette pièce-là n'existe que pour tenir le schéma : elle porte le nom de
-- l'habitation, et TOUTE l'app la masque (app/(entities)/habitation/[id].tsx
-- affiche directement les Emplacements quand `singleSpace`). La laisser
-- passer donnait déjà un « Garage > Garage » un peu bête ; la rendre
-- cliquable ouvrirait en plus un écran de Pièce que l'app ne montre nulle
-- part ailleurs, pour une habitation censée ne pas en avoir.
--
-- La ligne 'piece' est CONSERVÉE dans le retour, seulement étiquetée : la
-- fiche objet s'en sert pour le lien « voir sur le plan » (le plan, lui,
-- raisonne bien en pièces, y compris celle-là). C'est l'affichage du fil qui
-- l'écarte, pas la donnée.
--
-- Colonne ajoutée au retour => DROP puis CREATE, `create or replace` refuse
-- un changement de signature de sortie.
drop function if exists public.objet_location_chain(uuid);

create function public.objet_location_chain(p_objet_id uuid)
returns table (
  kind text,
  id uuid,
  name text,
  preset_key text,
  is_default boolean
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
    select p.id, p.name, p.preset_key, p.is_default, p.habitation_id
    from public.pieces p
    join emplacement_row e on e.piece_id = p.id
  ),
  habitation_row as (
    select h.id, h.name
    from public.habitations h
    join piece_row p on p.habitation_id = h.id
  )
  select t.kind, t.id, t.name, t.preset_key, t.is_default
  from (
    select 'habitation'::text as kind, habitation_row.id, habitation_row.name, null::text as preset_key, false as is_default, 0 as sort_order
    from habitation_row
    union all
    select 'piece'::text, piece_row.id, piece_row.name, piece_row.preset_key, piece_row.is_default, 1
    from piece_row
    union all
    select 'emplacement'::text, emplacement_row.id, emplacement_row.name, emplacement_row.preset_key, false, 2
    from emplacement_row
    union all
    select 'conteneur'::text, cc.id, cc.name, null::text, false, 90 - cc.depth
    from conteneur_chain cc
  ) t
  order by t.sort_order
$$;
