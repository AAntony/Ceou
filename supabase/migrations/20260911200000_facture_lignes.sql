-- Une facture qui couvre plusieurs objets ne peut pas porter UN montant.
--
-- LE DÉFAUT, ÉNONCÉ SIMPLEMENT. Le modèle a été bâti autour de « une facture
-- couvre plusieurs objets » — c'était le choix structurant — et le montant a
-- malgré tout été posé sur la facture. Un ticket avec un frigo à 800 € et un
-- grille-pain à 40 € affiche donc 840 € sur la fiche du grille-pain. La fin
-- de garantie a le même problème : deux ans pour l'un, un an pour l'autre,
-- une seule date pour les deux.
--
-- ═══ EN-TÊTE ET LIGNES ═══
--
-- Ce qui appartient au TICKET reste sur `factures` : le document, le vendeur,
-- la date d'achat. Un ticket, c'est un magasin et un jour — les répéter par
-- objet serait les ressaisir pour rien.
--
-- Ce qui appartient à CHAQUE CHOSE ACHETÉE descend sur `facture_objets` : le
-- montant et la fin de garantie. C'est le modèle en-tête/lignes ordinaire, et
-- il ne coûte rien au cas courant — une facture pour un seul objet a une
-- seule ligne, donc un seul jeu de champs à l'écran.
--
-- `factures.amount` RESTE, mais change de sens : ce n'est plus « le » montant,
-- c'est le TOTAL DU TICKET. Il garde sa raison d'être, et elle est courante :
-- on photographie un ticket de 840 € sans faire la répartition. Le dossier
-- additionne les lignes quand elles sont chiffrées, et se rabat sur ce total
-- sinon — un total qu'on connaît vaut mieux qu'une somme de rien.

-- === 1. Un identifiant propre sur la liaison ============================
--
-- ELLE DEVIENT MODIFIABLE, donc elle a besoin d'une clé que la file
-- d'écriture sache viser. `updateOp` et `deleteOp` écrivent `.eq('id', …)` :
-- une clé composite n'a pas d'`id`, et la mise à jour optimiste du cache
-- reconnaît elle aussi les lignes par leur `id`. Sans cette colonne, il
-- faudrait une opération d'écriture de plus pour ce seul cas.
--
-- Le couple reste UNIQUE : un objet ne peut pas être rattaché deux fois à la
-- même facture, c'est ce que la clé primaire garantissait.
alter table public.facture_objets add column id uuid not null default gen_random_uuid();
alter table public.facture_objets drop constraint facture_objets_pkey;
alter table public.facture_objets add primary key (id);
alter table public.facture_objets add constraint facture_objets_facture_objet_key unique (facture_id, objet_id);

-- === 2. Les colonnes qui descendent ====================================
alter table public.facture_objets
  add column amount numeric(12, 2),
  add column warranty_until date;

-- LA GARANTIE SE RECOPIE SUR TOUTES LES LIGNES : elle n'est pas additive,
-- chaque objet héritait déjà de celle de la facture.
update public.facture_objets fo
set warranty_until = f.warranty_until
from public.factures f
where f.id = fo.facture_id and f.warranty_until is not null;

-- LE MONTANT, LUI, NE SE RECOPIE QUE SUR LES FACTURES À UN SEUL OBJET.
--
-- Le poser sur chaque ligne d'une facture qui en couvre plusieurs
-- multiplierait le total par le nombre d'objets ; le poser sur une seule
-- ligne choisie au hasard mentirait sur la fiche de cet objet-là. Ne rien
-- poser est le seul choix juste : `factures.amount` garde le total du ticket,
-- et le dossier s'en sert tant qu'aucune ligne n'est chiffrée.
--
-- En pratique aucune facture n'a plus d'un objet aujourd'hui — l'interface ne
-- permettait pas de les rattacher — mais la migration ne doit pas en dépendre.
update public.facture_objets fo
set amount = f.amount
from public.factures f
where f.id = fo.facture_id
  and f.amount is not null
  and 1 = (select count(*) from public.facture_objets x where x.facture_id = f.id);

-- La fin de garantie n'a PLUS de sens au niveau de la facture : une date pour
-- des produits aux durées différentes est forcément fausse pour l'un d'eux.
alter table public.factures drop column warranty_until;

comment on column public.factures.amount is
  'Total du ticket, facultatif. Le montant par objet vit sur facture_objets ; '
  'celui-ci sert quand on connait la somme payee sans avoir fait la repartition.';

-- === 3. Le dossier d'un logement =======================================
--
-- ELLE REND SES LIGNES, et ne rend plus ni `objet_names` ni `warranty_until`.
--
-- Les trois se déduisaient les uns des autres, et les faire cohabiter aurait
-- été trois façons de dire la même chose — donc trois occasions de diverger.
-- Le client lit les noms dans les lignes, et décide de la pastille « Sous
-- garantie » en regardant s'il en reste UNE encore couverte. C'est aussi ce
-- qui permet de remettre en phase les rappels de garantie, qui sont désormais
-- posés par ligne et non par facture.
--
-- `amount` devient le total de la facture : la somme de ses lignes situées
-- dans CE logement, et à défaut le total du ticket.
--
-- Colonnes retirées => DROP puis CREATE.
drop function if exists public.factures_for_habitation(uuid);

create function public.factures_for_habitation(p_habitation_id uuid)
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
    -- calculé, mais le formulaire doit rééditer celui qui a été SAISI. Les
    -- confondre ferait réécrire une somme calculée à la place du total, et le
    -- repli cesserait de vouloir dire quelque chose.
    f.amount as facture_amount,
    f.purchase_date,
    f.vendor,
    f.created_at,
    -- CE QUI EST RENDU, C'EST CE QUI EST ICI. Le `join` étant déjà filtré sur
    -- le logement, une facture à cheval sur deux logements n'annonce dans
    -- chaque dossier que les objets qui s'y trouvent. C'est ce qu'on veut :
    -- un dossier ne parle que de ce qu'il couvre.
    jsonb_agg(
      jsonb_build_object(
        'id', fo.id,
        'objetId', o.id,
        'name', o.name,
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

-- === 4. Les factures d'un objet ========================================
--
-- REMPLACE LA REQUÊTE POSTGREST DE L'ÉCRAN, qui assemblait la facture et ses
-- objets par deux embarquements imbriqués. Il faut désormais, pour un même
-- appel : les champs du ticket, la ligne DE CET OBJET — c'est elle qui
-- s'affiche sur sa fiche — et toutes les autres lignes, pour pouvoir ouvrir
-- la facture entière en modification. Trois choses de trois niveaux
-- différents : c'est le moment d'écrire du SQL plutôt que d'empiler des
-- embarquements.
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
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', autre.id,
          'objetId', autre.objet_id,
          'name', o.name,
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

-- === 5. L'export ========================================================
--
-- Une colonne de plus — le total du ticket — donc DROP puis CREATE :
-- `create or replace` refuse un changement de signature de sortie.
--
-- `amount` et `warranty_until` viennent maintenant de la LIGNE. Le
-- récapitulatif du PDF y gagne : il devient une ligne par objet avec son
-- propre montant, ce qu'un assureur demande, au lieu d'un montant de ticket
-- réparti nulle part.
drop function if exists public.factures_export_rows();

create function public.factures_export_rows()
returns table (
  facture_id uuid,
  vendor text,
  amount numeric,
  facture_amount numeric,
  purchase_date date,
  warranty_until date,
  document_url text,
  document_kind text,
  created_at timestamptz,
  objet_id uuid,
  objet_name text,
  chain jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    f.id,
    f.vendor,
    fo.amount,
    f.amount,
    f.purchase_date,
    fo.warranty_until,
    f.document_url,
    f.document_kind,
    f.created_at,
    o.id,
    o.name,
    (
      select jsonb_agg(
        jsonb_build_object('kind', c.kind, 'id', c.id, 'name', c.name, 'is_default', c.is_default)
        order by c.ord
      )
      from public.objet_location_chain(o.id)
        with ordinality as c(kind, id, name, preset_key, is_default, ord)
    )
  from public.factures f
  join public.facture_objets fo on fo.facture_id = f.id
  join public.objets o on o.id = fo.objet_id
  order by coalesce(f.purchase_date, f.created_at::date) desc, f.id
$$;

-- === 6. Les factures qu'on peut rattacher ==============================
--
-- Pour l'écran « choisir une facture déjà enregistrée », ouvert depuis la
-- fiche d'un objet. Les plus récentes d'abord : un ticket qu'on rattache à un
-- deuxième objet vient presque toujours d'être saisi.
--
-- CELLES DÉJÀ RATTACHÉES À CET OBJET SONT ÉCARTÉES — le couple est unique,
-- les proposer ne mènerait qu'à un refus de la base.
create or replace function public.factures_a_rattacher(p_objet_id uuid, p_limite int default 40)
returns table (
  id uuid,
  document_url text,
  vendor text,
  purchase_date date,
  amount numeric,
  created_at timestamptz,
  objet_names text[]
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    f.id,
    f.document_url,
    f.vendor,
    f.purchase_date,
    coalesce((select sum(x.amount) from public.facture_objets x where x.facture_id = f.id), f.amount),
    f.created_at,
    coalesce(
      (
        select array_agg(o.name order by o.name)
        from public.facture_objets x
        join public.objets o on o.id = x.objet_id
        where x.facture_id = f.id
      ),
      '{}'::text[]
    )
  from public.factures f
  where not exists (
    select 1 from public.facture_objets x where x.facture_id = f.id and x.objet_id = p_objet_id
  )
  order by coalesce(f.purchase_date, f.created_at::date) desc, f.created_at desc
  limit p_limite
$$;
