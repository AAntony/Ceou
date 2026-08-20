-- Nombre d'objets par Pièce, pour l'afficher directement sur le Plan.
--
-- Aujourd'hui une pièce dessinée sur le plan n'affiche que son nom. Elle ne
-- dit rien de ce qu'elle contient, alors que c'est toute la question que le
-- plan est censé aider à répondre.
--
-- Une seule requête pour toute l'habitation plutôt qu'un compte par pièce :
-- le plan les affiche toutes en même temps, les demander une par une ferait
-- autant d'allers-retours réseau que de pièces.
--
-- `security invoker` : la RLS des tables sources s'applique normalement, donc
-- un invité en consultation obtient exactement les mêmes comptes que le
-- propriétaire, et rien pour une habitation à laquelle il n'a pas accès.
create function public.piece_object_counts(p_habitation_id uuid)
returns table (piece_id uuid, objet_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select e.piece_id, count(*)::bigint
  from public.objets o
  -- Un objet pend soit d'un Emplacement, soit d'un Conteneur (contrainte
  -- objets_exactly_one_parent). Dans le second cas il faut remonter la
  -- chaîne de conteneurs imbriqués jusqu'à l'Emplacement racine —
  -- conteneur_root_emplacement fait déjà exactement ça pour search_index.
  join public.emplacements e
    on e.id = coalesce(o.parent_emplacement_id, public.conteneur_root_emplacement(o.parent_conteneur_id))
  join public.pieces p on p.id = e.piece_id
  where p.habitation_id = p_habitation_id
  group by e.piece_id
$$;
