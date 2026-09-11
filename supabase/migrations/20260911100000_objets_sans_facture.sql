-- Ce qui MANQUE au dossier, et pas seulement ce qu'il contient.
--
-- POURQUOI CETTE FONCTION EXISTE. Le dossier d'un logement ne valait jusqu'ici
-- que par ce qu'on avait pensé à y mettre. Or personne ne se souvient de ce
-- qu'il n'a PAS fait : on ajoute une facture au moment de l'achat, puis on
-- oublie les cinquante objets déjà là. Le jour du sinistre, la liste paraît
-- complète parce qu'elle ne montre que ses propres lignes — c'est exactement
-- le genre de vide qu'on ne découvre qu'au mauvais moment.
--
-- La question « lesquels de mes objets n'ont aucune preuve d'achat ? » ne se
-- répond pas côté client : il faudrait charger tout l'inventaire du logement
-- ET toutes les liaisons, pour afficher une liste. Elle est donc posée ici,
-- où la jointure coûte une requête.

-- `security invoker`, et c'est ce qui rend le NOT EXISTS juste : la RLS de
-- `facture_objets` ne laisse voir que les liaisons de SES PROPRES factures
-- (voir la policy facture_objets_own). « Aucune liaison visible » vaut donc
-- « aucune facture à moi », ce qui est bien la question posée.
--
-- CONSÉQUENCE À CONNAÎTRE : pour quelqu'un qui n'est pas propriétaire — un ami
-- à qui l'habitation est ouverte — aucune liaison n'est visible, donc TOUS les
-- objets ressortent « sans facture ». Ce n'est pas un défaut de la fonction,
-- c'est le corollaire du fait que les factures sont privées ; l'écran qui
-- l'appelle est réservé au propriétaire pour cette raison.
create or replace function public.objets_sans_facture(p_habitation_id uuid)
returns table (
  id uuid,
  name text,
  photo_url text,
  piece_name text,
  parent_label text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    o.id,
    o.name,
    o.photo_url,
    p.name,
    -- Là où il est POSÉ, pas seulement la pièce : « Salon » ne suffit pas à
    -- reconnaître laquelle des trois lampes est concernée, « Étagère du bas »
    -- si. Même résolution que search_index, où le libellé est le conteneur
    -- quand il y en a un, l'emplacement sinon.
    coalesce(oc.name, e.name)
  from public.objets o
  left join public.conteneurs oc on oc.id = o.parent_conteneur_id
  -- Un objet pend soit d'un Emplacement, soit d'un Conteneur (contrainte
  -- objets_exactly_one_parent) ; dans le second cas il faut remonter la chaîne
  -- de conteneurs imbriqués jusqu'à l'Emplacement racine.
  join public.emplacements e
    on e.id = coalesce(o.parent_emplacement_id, public.conteneur_root_emplacement(o.parent_conteneur_id))
  join public.pieces p on p.id = e.piece_id
  where p.habitation_id = p_habitation_id
    and not exists (
      select 1 from public.facture_objets fo where fo.objet_id = o.id
    )
  -- PAR PIÈCE, PUIS PAR NOM. C'est une liste dont on veut venir à bout : la
  -- ranger comme on parcourt le logement permet de traiter une pièce d'un
  -- coup, plutôt que de faire des allers-retours entre le salon et la cave.
  order by p.name, o.name
$$;
