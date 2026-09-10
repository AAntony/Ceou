-- Les factures : prouver ce qu'on possède, et ce que ça valait.
--
-- À QUOI ÇA SERT, parce que ça décide de la forme : après un cambriolage, un
-- incendie ou un dégât des eaux, un assureur ne demande pas des photos — il
-- demande une liste. Quel objet, acheté quand, combien, chez qui, avec la
-- preuve jointe. Céoù est le seul à pouvoir la produire, puisqu'il sait déjà
-- où était chaque chose.
--
-- UNE FACTURE COUVRE PLUSIEURS OBJETS, et c'est le choix structurant. Un
-- ticket de caisse, une livraison de meubles, une commande en ligne en
-- couvrent presque toujours plusieurs. La ranger comme une colonne de plus
-- sur `objets` aurait obligé à re-photographier le même document autant de
-- fois — et compté le même achat plusieurs fois dans le total du dossier.
-- D'où une table à part et une table de liaison.
--
-- ELLE NAÎT TOUJOURS D'UN OBJET. Il n'y a pas de facture orpheline : on
-- l'ajoute depuis une fiche, on lui rattache d'autres objets ensuite. Son
-- logement se déduit donc de ses objets, il n'est stocké nulle part — une
-- facture qui n'appartiendrait à aucun logement n'apparaîtrait dans aucun
-- dossier, ce qui est le seul cas vraiment inutile.
--
-- ELLE EST PRIVÉE À SON PROPRIÉTAIRE, décidé explicitement. Un ami à qui une
-- habitation est ouverte voit les objets, jamais leurs factures : un document
-- d'achat porte un montant, une adresse de livraison, parfois un moyen de
-- paiement. Ce n'est pas de l'inventaire, c'est de la comptabilité.

-- === Le bucket =========================================================
--
-- PRIVÉ DÈS SA CRÉATION, contrairement aux deux autres qu'il a fallu fermer
-- après coup (voir close_public_buckets). Il n'y a aucune raison de repasser
-- par là.
--
-- Un bucket À PART et non le bucket `objets` réutilisé : la lecture d'un
-- fichier d'`objets` peut être accordée à un tiers quand le chemin se résout
-- en une habitation partagée (`can_read_media`). Une facture ne doit jamais
-- l'être. En la rangeant ailleurs, elle tombe dans la branche `else false` de
-- cette même fonction, et seul le test du propriétaire — le préfixe du
-- chemin — peut l'ouvrir. La confidentialité tient donc à la STRUCTURE, pas à
-- une règle qu'on pourrait oublier de maintenir.
insert into storage.buckets (id, name, public)
values ('factures', 'factures', false)
on conflict (id) do nothing;

-- Les policies d'écriture sont déclarées par bucket (voir init_schema et
-- move_objet) : un nouveau bucket a besoin des siennes. La lecture, elle,
-- passe déjà par `media_read`, qui vaut pour tous les buckets.
create policy "factures_owner_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'factures' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "factures_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'factures' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "factures_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'factures' and (storage.foldername(name))[1] = auth.uid()::text);

-- === Les tables ========================================================

create table public.factures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- L'adresse du document, dans la même forme que `photo_url` : elle porte le
  -- chemin ET la version, ce dont l'app a besoin pour demander une signature
  -- et pour garder une clé de cache stable (voir lib/images/media.ts).
  document_url text not null,
  -- `pdf` n'est pas encore acceptée à la saisie : l'import demande un module
  -- natif, donc un build. La colonne existe dès maintenant pour que ce jour-là
  -- ne demande pas de migration — et la contrainte dit déjà ce qui est prévu.
  document_kind text not null default 'image' check (document_kind in ('image', 'pdf')),

  -- LES QUATRE INFORMATIONS QUI FONT LE DOSSIER. Toutes facultatives : une
  -- facture photographiée sans rien saisir vaut mieux qu'une facture qu'on
  -- renonce à ajouter parce que le formulaire est long. Le dossier dira ce
  -- qu'il sait.
  amount numeric(12, 2),
  purchase_date date,
  -- Celle qui fait vivre la fonctionnalité un mardi ordinaire : sans elle,
  -- on ne rouvre ses factures qu'après un sinistre — donc jamais, donc on
  -- oublie de les remplir.
  warranty_until date,
  vendor text,

  created_at timestamptz not null default now()
);

-- La liaison. Une facture couvre 1..n objets ; un objet peut avoir plusieurs
-- factures (l'achat, puis la réparation, puis l'extension de garantie).
create table public.facture_objets (
  facture_id uuid not null references public.factures (id) on delete cascade,
  objet_id uuid not null references public.objets (id) on delete cascade,
  primary key (facture_id, objet_id)
);

create index factures_user_idx on public.factures (user_id);
create index facture_objets_objet_idx on public.facture_objets (objet_id);

-- === RLS ===============================================================
--
-- LE PROPRIÉTAIRE, ET PERSONNE D'AUTRE. Pas de passage par
-- `has_habitation_access` : ce serait précisément ouvrir les factures au
-- partage, ce qu'on a écarté.
--
-- Conséquence assumée : un objet partagé peut porter une facture que le
-- destinataire du partage ne verra pas. C'est voulu, et l'app ne doit donc
-- pas lui afficher un bloc vide là où il n'y a rien à voir POUR LUI.

alter table public.factures enable row level security;
alter table public.facture_objets enable row level security;

create policy "factures_own" on public.factures
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- La liaison suit sa facture : c'est elle qui porte le droit. Passer par
-- l'objet aurait rendu la liaison visible à qui voit l'objet — donc révélé
-- qu'une facture existe, à quelqu'un qui n'a pas le droit de la lire.
create policy "facture_objets_own" on public.facture_objets
  for all to authenticated
  using (exists (select 1 from public.factures f where f.id = facture_id and f.user_id = auth.uid()))
  with check (exists (select 1 from public.factures f where f.id = facture_id and f.user_id = auth.uid()));

-- === Le dossier d'un logement ==========================================
--
-- Les factures dont AU MOINS UN objet se trouve dans ce logement. Le calcul
-- vit en SQL parce qu'il descend la chaîne emplacement/conteneur jusqu'à la
-- pièce : le faire côté client demanderait de charger tout l'inventaire pour
-- répondre à une question de liste.
--
-- `security invoker` : la RLS de `factures` s'applique, donc on ne peut pas
-- lire par ce biais celles d'un autre — même sur une habitation partagée.
create or replace function public.factures_for_habitation(p_habitation_id uuid)
returns table (
  id uuid,
  document_url text,
  document_kind text,
  amount numeric,
  purchase_date date,
  warranty_until date,
  vendor text,
  created_at timestamptz,
  objet_count bigint,
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
    f.document_kind,
    f.amount,
    f.purchase_date,
    f.warranty_until,
    f.vendor,
    f.created_at,
    -- CE QUI EST COMPTÉ, C'EST CE QUI EST ICI. Le `join` étant déjà filtré
    -- sur le logement, une facture à cheval sur deux logements n'annonce dans
    -- chaque dossier que les objets qui s'y trouvent. C'est ce qu'on veut :
    -- un dossier ne parle que de ce qu'il couvre.
    count(o.id) as objet_count,
    array_agg(o.name order by o.name) as objet_names
  from public.factures f
  join public.facture_objets fo on fo.facture_id = f.id
  join public.objets o on o.id = fo.objet_id
  where public.location_habitation(o.parent_emplacement_id, o.parent_conteneur_id) = p_habitation_id
  group by f.id
  order by coalesce(f.purchase_date, f.created_at::date) desc
$$;
