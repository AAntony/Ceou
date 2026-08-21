-- Photo optionnelle sur les quatre niveaux, icône de Conteneur, et compteurs
-- d'objets par niveau — de quoi alimenter la nouvelle présentation en liste
-- (vignette, icône, nom, nombre d'objets).
--
-- Aucune valeur par défaut, aucune contrainte : une photo absente vaut null,
-- et c'est l'app qui décide quoi montrer à la place (image générique). Rien
-- ici ne casse une ligne existante.

alter table public.habitations add column if not exists photo_url text;
alter table public.pieces add column if not exists photo_url text;
alter table public.emplacements add column if not exists photo_url text;
alter table public.conteneurs add column if not exists photo_url text;

-- Les Conteneurs étaient le seul niveau sans aucune notion de type/icône :
-- même colonne, même nom que sur `pieces` et `emplacements` pour que le code
-- client n'ait pas trois conventions à retenir.
alter table public.conteneurs add column if not exists preset_key text;


-- Nombre d'objets par Habitation, pour la liste des Habitations.
--
-- Sans paramètre : la RLS de `objets`/`emplacements`/`pieces` filtre déjà
-- aux habitations accessibles à l'appelant (les siennes et celles qu'on lui
-- a partagées), donc la fonction retourne exactement les lignes que l'écran
-- affiche, ni plus ni moins. `security invoker` est ce qui garantit ça.
create or replace function public.habitation_object_counts()
returns table (habitation_id uuid, objet_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select p.habitation_id, count(*)::bigint
  from public.objets o
  -- Un objet pend soit d'un Emplacement, soit d'un Conteneur ; dans le
  -- second cas conteneur_root_emplacement remonte la chaîne de conteneurs
  -- imbriqués jusqu'à l'Emplacement racine (déjà utilisée par search_index).
  join public.emplacements e
    on e.id = coalesce(o.parent_emplacement_id, public.conteneur_root_emplacement(o.parent_conteneur_id))
  join public.pieces p on p.id = e.piece_id
  group by p.habitation_id
$$;


-- Compteurs de TOUS les nœuds d'une habitation en un seul appel : pièces,
-- emplacements et conteneurs.
--
-- Un appel par écran (Pièces, Emplacements d'une pièce, contenu d'un
-- emplacement, contenu d'un conteneur) aurait multiplié les allers-retours
-- alors que l'utilisateur reste dans la même habitation pendant toute sa
-- navigation : ici le résultat est mis en cache une fois et resservi à
-- chaque descente d'un niveau.
--
-- `piece_object_counts` (utilisée par le Plan) n'est pas remplacée : elle a
-- son propre appelant et sa propre forme de retour.
create or replace function public.habitation_node_counts(p_habitation_id uuid)
returns table (node_kind text, node_id uuid, objet_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with recursive
  emplacements_hab as (
    select e.id, e.piece_id
    from public.emplacements e
    join public.pieces p on p.id = e.piece_id
    where p.habitation_id = p_habitation_id
  ),
  objets_hab as (
    select o.id,
           coalesce(o.parent_emplacement_id, public.conteneur_root_emplacement(o.parent_conteneur_id)) as emplacement_id,
           o.parent_conteneur_id
    from public.objets o
    where coalesce(o.parent_emplacement_id, public.conteneur_root_emplacement(o.parent_conteneur_id))
          in (select id from emplacements_hab)
  ),
  -- Remontée de la chaîne de conteneurs : un objet rangé dans une boîte
  -- elle-même dans un carton compte pour la boîte ET pour le carton. Sans
  -- cette récursion, un carton plein de boîtes pleines afficherait « 0 ».
  ancetres as (
    select o.id as objet_id, o.parent_conteneur_id as conteneur_id
    from objets_hab o
    where o.parent_conteneur_id is not null
    union all
    select a.objet_id, c.parent_conteneur_id
    from ancetres a
    join public.conteneurs c on c.id = a.conteneur_id
    where c.parent_conteneur_id is not null
  )
  select 'piece'::text, e.piece_id, count(*)::bigint
  from objets_hab o
  join emplacements_hab e on e.id = o.emplacement_id
  group by e.piece_id
  union all
  select 'emplacement'::text, o.emplacement_id, count(*)::bigint
  from objets_hab o
  group by o.emplacement_id
  union all
  select 'conteneur'::text, a.conteneur_id, count(*)::bigint
  from ancetres a
  group by a.conteneur_id
$$;
