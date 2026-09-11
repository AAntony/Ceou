-- De quoi dessiner l'arbre de l'export ET remplir le PDF, en une requête.
--
-- CE QUE L'ÉCRAN D'EXPORT DEMANDE. Une arborescence à cocher — Habitation,
-- Pièce, Emplacement, Conteneur(s), Objet — où cocher un nœud emporte toutes
-- les factures qui pendent en dessous. Cocher une Pièce doit donc suffire,
-- sans que l'écran ait à redemander quoi que ce soit : la sélection se résout
-- entièrement en mémoire.
--
-- L'ARBRE EST CONSTRUIT DEPUIS LES FACTURES, PAS DEPUIS L'INVENTAIRE, et
-- c'est le choix structurant. On ne peut pas exporter ce qui n'existe pas :
-- un logement de deux cents objets dont douze portent un ticket doit montrer
-- douze feuilles, pas deux cents. Partir des factures rend cette propriété
-- gratuite — une branche n'apparaît que parce qu'une facture y mène.
--
-- UNE LIGNE PAR COUPLE (FACTURE, OBJET). Une facture couvrant trois objets
-- ressort trois fois, avec trois chemins différents : c'est exactement ce
-- qu'il faut pour que la cocher depuis n'importe laquelle des trois branches
-- fonctionne. Le client dédoublonne par `facture_id` au moment de générer le
-- PDF — une facture cochée deux fois ne s'imprime qu'une.
--
-- `security invoker` : la RLS de `factures` s'applique, donc cette fonction
-- ne rend jamais que les siennes. C'est aussi ce qui rend inutile tout filtre
-- sur le propriétaire ici.
create or replace function public.factures_export_rows()
returns table (
  facture_id uuid,
  vendor text,
  amount numeric,
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
    f.amount,
    f.purchase_date,
    f.warranty_until,
    f.document_url,
    f.document_kind,
    f.created_at,
    o.id,
    o.name,
    -- LE CHEMIN COMPLET, DANS L'ORDRE, ET L'ORDRE N'EST PAS UN DÉTAIL : la
    -- profondeur des conteneurs imbriqués est inconnue à l'avance, c'est lui
    -- seul qui dit lequel contient l'autre. `with ordinality` capture l'ordre
    -- dans lequel objet_location_chain rend ses lignes ; sans lui, jsonb_agg
    -- n'aurait aucune garantie de le conserver.
    --
    -- `is_default` voyage avec : la pièce d'une habitation mono-espace
    -- (Garage, Cave, Box) n'existe que pour tenir le schéma, toute l'app la
    -- masque, et l'arbre de l'export doit la masquer aussi — sans quoi on
    -- déplierait « Garage » pour trouver « Garage ».
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
  -- Le même ordre que le dossier d'un logement : le PDF sort dans l'ordre
  -- qu'on avait sous les yeux en cochant.
  order by coalesce(f.purchase_date, f.created_at::date) desc, f.id
$$;
