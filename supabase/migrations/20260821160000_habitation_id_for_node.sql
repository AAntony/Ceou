-- Habitation d'appartenance d'un nœud quelconque de l'arborescence.
--
-- `habitation_node_counts` renvoie les compteurs de toute une habitation en
-- un appel, ce qui suppose de connaître cette habitation. Les écrans le
-- savent pour les Pièces (la ligne porte `habitation_id`), mais pas pour un
-- Conteneur imbriqué : il faudrait remonter la chaîne des conteneurs parents
-- puis l'emplacement puis la pièce, soit trois allers-retours réseau ou plus
-- selon la profondeur.
--
-- Une résolution côté SQL en un appel, donc — et surtout, le résultat sert
-- de CLÉ DE CACHE : tous les écrans d'une même habitation retombent ensuite
-- sur le même `habitation_node_counts` déjà en mémoire, au lieu d'avoir
-- chacun sa propre requête de comptage.
--
-- `security invoker` : la RLS de `pieces` s'applique, donc un utilisateur
-- sans accès obtient null plutôt que l'identifiant d'une habitation qu'il ne
-- devrait pas connaître.
create or replace function public.habitation_id_for_node(p_kind text, p_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select p.habitation_id
  from public.pieces p
  where p.id = case p_kind
    when 'piece' then p_id
    when 'emplacement' then (select e.piece_id from public.emplacements e where e.id = p_id)
    -- conteneur_root_emplacement remonte déjà la chaîne des conteneurs
    -- imbriqués jusqu'à l'emplacement racine (voir search_index).
    when 'conteneur' then (
      select e.piece_id
      from public.emplacements e
      where e.id = public.conteneur_root_emplacement(p_id)
    )
  end
$$;
