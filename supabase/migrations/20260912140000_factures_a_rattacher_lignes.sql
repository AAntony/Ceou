-- Les factures proposées au rattachement rendent leurs LIGNES.
--
-- POURQUOI : rattacher un objet à une facture déjà enregistrée n'apparaissait
-- à l'écran qu'au rafraîchissement suivant. Hors ligne — c'est-à-dire dans le
-- magasin, là où le geste se fait — il n'apparaissait pas du tout, puisque
-- rien ne se recharge jamais. Toutes les autres écritures de l'app posent
-- leur résultat dans le cache avant même de parler au serveur ; celle-ci ne
-- le pouvait pas, faute de connaître la facture qu'elle rattache.
--
-- Ce qui manquait tient en trois champs. Pour poser dans le cache la facture
-- telle que la fiche de l'objet l'attend (`factures_for_objet`), il faut son
-- `document_kind`, le total du ticket TEL QUE SAISI — et surtout ses lignes
-- AVEC LEURS IDENTIFIANTS.
--
-- ⚠️ LES IDENTIFIANTS DE LIGNE SONT LA RAISON D'ÊTRE DE CETTE MIGRATION, et
-- pas un confort. La feuille de modification garde en mémoire TOUTES les
-- lignes de la facture, y compris depuis la fiche d'un objet, et
-- l'enregistrement supprime celles qui ont disparu de cette mémoire. Une
-- facture posée dans le cache avec des lignes incomplètes — ou pire, avec des
-- identifiants inventés — ferait donc effacer les autres objets du ticket à
-- la première modification. Le rattachement optimiste n'était pas possible
-- sans ces identifiants-là.
--
-- `objet_names` disparaît : les noms sont dans `lignes`, et deux sources pour
-- la même chose finissent par se contredire. L'écran de rattachement les y lit
-- désormais — sans rien changer à ce qu'il affiche.
--
-- Le type de retour change, donc `drop` puis `create` : `create or replace`
-- refuse de changer les colonnes rendues.

drop function if exists public.factures_a_rattacher(uuid, int);

create function public.factures_a_rattacher(p_objet_id uuid, p_limite int default 40)
returns table (
  id uuid,
  document_url text,
  document_kind text,
  vendor text,
  purchase_date date,
  -- Ce que la rangée AFFICHE : la somme des lignes, à défaut le total du
  -- ticket. Même repli que dans le dossier d'un logement.
  amount numeric,
  -- Le total du ticket TEL QU'IL A ÉTÉ SAISI, à côté du précédent : c'est lui
  -- que le formulaire rééditera, et les confondre ferait réécrire une somme
  -- calculée à la place du total.
  facture_amount numeric,
  created_at timestamptz,
  lignes jsonb
)
language sql
stable
-- `security invoker` : c'est la RLS qui fait que « les factures » veut dire
-- « les miennes ». Une facture d'autrui ne doit jamais être proposée.
security invoker
set search_path = public
as $$
  select
    f.id,
    f.document_url,
    f.document_kind,
    f.vendor,
    f.purchase_date,
    coalesce((select sum(x.amount) from public.facture_objets x where x.facture_id = f.id), f.amount),
    f.amount,
    f.created_at,
    -- TOUTES LES LIGNES, sans filtre de logement : contrairement au dossier,
    -- on ne parle pas ici d'un logement mais d'un TICKET, et c'est le ticket
    -- entier que la fiche de l'objet affichera ensuite.
    --
    -- Le repli sur `'[]'` plutôt que `null` : une facture sans ligne ne
    -- devrait pas exister (un déclencheur les purge), mais `jsonb_agg` d'un
    -- ensemble vide rend `null`, et l'écran n'a pas à s'en méfier.
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', x.id,
            'objetId', x.objet_id,
            'name', o.name,
            'photoUrl', o.photo_url,
            'amount', x.amount,
            'warrantyUntil', x.warranty_until
          )
          order by o.name
        )
        from public.facture_objets x
        join public.objets o on o.id = x.objet_id
        where x.facture_id = f.id
      ),
      '[]'::jsonb
    ) as lignes
  from public.factures f
  -- CELLES QUI NE COUVRENT PAS DÉJÀ CET OBJET : les proposer serait proposer
  -- de créer une liaison que la contrainte d'unicité refuserait.
  where not exists (
    select 1 from public.facture_objets x where x.facture_id = f.id and x.objet_id = p_objet_id
  )
  -- LES PLUS RÉCENTES D'ABORD : un rattachement suit presque toujours une
  -- saisie de la minute précédente.
  order by coalesce(f.purchase_date, f.created_at::date) desc, f.created_at desc
  limit p_limite
$$;
