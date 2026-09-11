-- Les lignes d'une facture portent la photo de leur objet.
--
-- POURQUOI : dans le dossier d'un logement, une facture doit montrer CE
-- QU'ELLE COUVRE, et un nom ne suffit pas à reconnaître ses affaires. « Chaise
-- Ana » ne dit rien ; la photo de la chaise, si. C'est aussi ce qui permet d'en
-- faire un lien vers la fiche de l'objet, demandé à l'usage.
--
-- Une clé de plus dans le jsonb déjà rendu, donc aucune colonne ne change :
-- `create or replace` suffit pour les deux fonctions.

create or replace function public.factures_for_habitation(p_habitation_id uuid)
returns table (
  id uuid,
  document_url text,
  document_kind text,
  amount numeric,
  facture_amount numeric,
  purchase_date date,
  vendor text,
  created_at timestamptz,
  lignes jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    f.id,
    f.document_url,
    f.document_kind,
    -- LE REPLI EST ASSUMÉ, avec sa limite : le total du ticket peut couvrir
    -- des objets situés dans un autre logement. C'est le prix d'un chiffre
    -- affiché plutôt qu'un tiret, et il ne se paie que sur les factures dont
    -- aucune ligne n'est chiffrée.
    coalesce(sum(fo.amount), f.amount) as amount,
    -- LE TOTAL DU TICKET TEL QUEL, à côté du précédent : la carte affiche le
    -- calculé, mais le formulaire doit rééditer celui qui a été SAISI.
    f.amount as facture_amount,
    f.purchase_date,
    f.vendor,
    f.created_at,
    -- CE QUI EST RENDU, C'EST CE QUI EST ICI. Le `join` étant déjà filtré sur
    -- le logement, une facture à cheval sur deux logements n'annonce dans
    -- chaque dossier que les objets qui s'y trouvent.
    jsonb_agg(
      jsonb_build_object(
        'id', fo.id,
        'objetId', o.id,
        'name', o.name,
        'photoUrl', o.photo_url,
        'amount', fo.amount,
        'warrantyUntil', fo.warranty_until
      )
      order by o.name
    ) as lignes
  from public.factures f
  join public.facture_objets fo on fo.facture_id = f.id
  join public.objets o on o.id = fo.objet_id
  where public.location_habitation(o.parent_emplacement_id, o.parent_conteneur_id) = p_habitation_id
  group by f.id
  order by coalesce(f.purchase_date, f.created_at::date) desc
$$;

create or replace function public.factures_for_objet(p_objet_id uuid)
returns table (
  id uuid,
  document_url text,
  document_kind text,
  vendor text,
  purchase_date date,
  facture_amount numeric,
  created_at timestamptz,
  amount numeric,
  warranty_until date,
  lignes jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    f.id,
    f.document_url,
    f.document_kind,
    f.vendor,
    f.purchase_date,
    f.amount,
    f.created_at,
    ligne.amount,
    ligne.warranty_until,
    -- LES AUTRES LIGNES NE S'AFFICHENT PAS SUR LA FICHE D'UN OBJET — on y
    -- parle de CET objet, et lister ses voisins de ticket prête à confusion.
    -- Elles restent rendues parce que l'écran a besoin de leur NOMBRE : une
    -- suppression emporte le document pour tout le monde, et ça doit se dire.
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', autre.id,
          'objetId', autre.objet_id,
          'name', o.name,
          'photoUrl', o.photo_url,
          'amount', autre.amount,
          'warrantyUntil', autre.warranty_until
        )
        order by o.name
      )
      from public.facture_objets autre
      join public.objets o on o.id = autre.objet_id
      where autre.facture_id = f.id
    ) as lignes
  from public.factures f
  join public.facture_objets ligne on ligne.facture_id = f.id and ligne.objet_id = p_objet_id
  order by coalesce(f.purchase_date, f.created_at::date) desc, f.id
$$;
