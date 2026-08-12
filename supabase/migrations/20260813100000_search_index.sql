-- Recherche globale (Phase 6) : un seul endroit d'où lire tout ce qui
-- appartient à l'utilisateur (objets, conteneurs, emplacements, pièces)
-- avec le "fil du dessus" déjà résolu, pour un fetch unique côté client
-- plutôt qu'un aller-retour réseau par frappe de recherche.

-- Même pattern que conteneur_owner() (CTE récursive pour remonter une
-- chaîne de conteneurs imbriqués), mais renvoie l'emplacement racine au
-- lieu du propriétaire — nécessaire pour résoudre le fil des objets et
-- conteneurs qui vivent dans un conteneur plutôt que directement dans un
-- emplacement.
create function public.conteneur_root_emplacement(p_conteneur_id uuid)
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
  select parent_emplacement_id from chain where parent_emplacement_id is not null limit 1
$$;

-- security invoker : la RLS de chaque table source s'applique normalement
-- à l'utilisateur appelant (aucune des requêtes ci-dessous n'est
-- auto-référencée sur sa propre table, donc pas concernée par le bug RLS
-- des migrations précédentes).
create function public.search_index()
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
    'piece'::text, pc.id, pc.name, null::text, null::text,
    pc.id, pc.name, h.id, h.name, h.icon,
    null::text
  from public.pieces pc
  join public.habitations h on h.id = pc.habitation_id
$$;
