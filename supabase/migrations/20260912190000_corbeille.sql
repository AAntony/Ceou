-- UNE CORBEILLE : aucune suppression n'était rattrapable.
--
-- CE QUE ÇA CORRIGE, et ce n'est pas une commodité : les clés étrangères de
-- l'inventaire cascadent toutes en `on delete cascade`. Supprimer une pièce
-- emporte ses rangements, leurs boîtes, et TOUS les objets qui s'y trouvent —
-- potentiellement des centaines de fiches construites pendant des mois, en un
-- appui, sans retour possible. Et le déclencheur `purge_facture_sans_objet`
-- ajoute une couche : supprimer un objet supprime aussi sa facture quand elle
-- ne couvrait que lui.
--
-- ═══ POURQUOI UN INSTANTANÉ, ET NON UN `deleted_at` ═══
--
-- La suppression douce est la solution d'école. Elle a ici un coût qu'on ne
-- peut pas payer sans risque : il faudrait ajouter « et non supprimé » à
-- CHAQUE lecture — non seulement aux requêtes de l'app, mais aux quelque
-- quinze fonctions SQL qui parcourent l'arbre (search_index,
-- objet_location_chain, piece_object_counts, objets_sans_facture,
-- factures_for_habitation, apply_plan_template…). Une seule oubliée, et un
-- objet supprimé réapparaît quelque part sans qu'on sache pourquoi.
--
-- L'instantané inverse le risque. On photographie la ligne et sa descendance
-- AVANT de la supprimer pour de bon ; la suppression reste exactement celle
-- d'aujourd'hui, cascade comprise, et PAS UNE SEULE LECTURE DE L'APP NE
-- CHANGE. Ce qui n'est pas dans la corbeille se comporte comme avant, et ce
-- qui y est n'existe nulle part ailleurs.
--
-- Le prix de ce choix : restaurer réinsère des lignes dont le parent a pu
-- disparaître entre-temps. La fonction de restauration le vérifie et refuse
-- plutôt que d'inventer — voir plus bas.
--
-- LES FICHIERS DU STOCKAGE SURVIVENT DÉJÀ à une suppression (c'est documenté
-- dans useDeleteFacture : « le fichier du bucket, lui, reste »). Une photo
-- d'objet restaurée retrouve donc son image, sans rien à faire ici.

create table public.corbeille (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('habitation', 'piece', 'emplacement', 'conteneur', 'objet', 'facture')),
  -- Ce qu'on lit dans la liste : le nom que portait la chose supprimée.
  label text not null,
  -- Ce qui partait avec elle, en nombres. L'écran en fait une phrase — un
  -- décompte se traduit, une phrase construite en SQL non.
  resume jsonb not null default '{}'::jsonb,
  -- La ligne et toute sa descendance, table par table.
  payload jsonb not null,
  deleted_at timestamptz not null default now()
);

create index corbeille_user_idx on public.corbeille (user_id, deleted_at desc);

alter table public.corbeille enable row level security;

create policy "corbeille_all_own" on public.corbeille
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- === Déposer =========================================================
--
-- Appelée par l'app JUSTE AVANT la suppression, dans le même lot d'écriture :
-- la file exécute ses opérations dans l'ordre, donc l'instantané part en
-- premier même quand tout a été fait hors ligne des heures plus tôt.
--
-- `security invoker` : c'est la RLS qui décide ce qu'on a le droit de
-- photographier. On ne peut pas déposer dans sa corbeille ce qu'on n'a pas le
-- droit de lire.

create or replace function public.corbeille_deposer(p_kind text, p_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pieces uuid[] := '{}';
  v_emplacements uuid[] := '{}';
  v_conteneurs uuid[] := '{}';
  v_objets uuid[] := '{}';
  v_factures uuid[] := '{}';
  v_label text;
  v_payload jsonb;
  v_id uuid;
begin
  -- ── Les pièces emportées ────────────────────────────────────────────
  if p_kind = 'habitation' then
    select coalesce(array_agg(id), '{}') into v_pieces from public.pieces where habitation_id = p_id;
  elsif p_kind = 'piece' then
    v_pieces := array[p_id];
  end if;

  -- ── Les rangements ──────────────────────────────────────────────────
  if p_kind = 'emplacement' then
    v_emplacements := array[p_id];
  elsif array_length(v_pieces, 1) is not null then
    select coalesce(array_agg(id), '{}') into v_emplacements
    from public.emplacements where piece_id = any(v_pieces);
  end if;

  -- ── Les boîtes, EN DESCENDANT : une boîte peut en contenir une autre,
  --    et la profondeur sert à les réinsérer parent avant enfant.
  with recursive descendance as (
    select c.id, 0 as profondeur
    from public.conteneurs c
    where (p_kind = 'conteneur' and c.id = p_id)
       or (p_kind <> 'conteneur' and c.parent_emplacement_id = any(v_emplacements))
    union all
    select enfant.id, d.profondeur + 1
    from public.conteneurs enfant
    join descendance d on enfant.parent_conteneur_id = d.id
  )
  select coalesce(array_agg(id order by profondeur), '{}') into v_conteneurs from descendance;

  -- ── Les objets ──────────────────────────────────────────────────────
  if p_kind = 'objet' then
    v_objets := array[p_id];
  else
    select coalesce(array_agg(id), '{}') into v_objets
    from public.objets
    where parent_emplacement_id = any(v_emplacements) or parent_conteneur_id = any(v_conteneurs);
  end if;

  -- ── Les factures qui ne survivraient pas ────────────────────────────
  --
  -- Celle qu'on supprime explicitement, ou celles dont TOUTES les lignes
  -- partent avec ces objets : le déclencheur purge_facture_sans_objet les
  -- supprimerait dans la foulée, silencieusement.
  if p_kind = 'facture' then
    v_factures := array[p_id];
  elsif array_length(v_objets, 1) is not null then
    select coalesce(array_agg(f.id), '{}') into v_factures
    from public.factures f
    where exists (
      select 1 from public.facture_objets fo where fo.facture_id = f.id and fo.objet_id = any(v_objets)
    )
    and not exists (
      select 1 from public.facture_objets fo where fo.facture_id = f.id and not (fo.objet_id = any(v_objets))
    );
  end if;

  -- ── Le nom lisible ──────────────────────────────────────────────────
  v_label := case p_kind
    when 'habitation' then (select name from public.habitations where id = p_id)
    when 'piece' then (select name from public.pieces where id = p_id)
    when 'emplacement' then (select name from public.emplacements where id = p_id)
    when 'conteneur' then (select name from public.conteneurs where id = p_id)
    when 'objet' then (select name from public.objets where id = p_id)
    when 'facture' then (select coalesce(vendor, '') from public.factures where id = p_id)
  end;

  -- RIEN À DÉPOSER SI LA LIGNE N'EXISTE PLUS : un lot rejoué, ou deux
  -- appareils qui suppriment la même chose. Mieux vaut ne rien écrire qu'une
  -- entrée de corbeille vide qu'on ne saurait pas restaurer.
  if v_label is null then
    return null;
  end if;

  v_payload := jsonb_build_object(
    'habitations', coalesce((select jsonb_agg(to_jsonb(x)) from public.habitations x
                             where p_kind = 'habitation' and x.id = p_id), '[]'::jsonb),
    'pieces', coalesce((select jsonb_agg(to_jsonb(x)) from public.pieces x
                        where x.id = any(v_pieces)), '[]'::jsonb),
    'emplacements', coalesce((select jsonb_agg(to_jsonb(x)) from public.emplacements x
                              where x.id = any(v_emplacements)), '[]'::jsonb),
    -- L'ORDRE COMPTE ICI, et seulement ici : `v_conteneurs` est trié par
    -- profondeur, et `with ordinality` est ce qui conserve ce tri dans le
    -- tableau jsonb. Réinsérer une boîte avant la boîte qui la contient
    -- violerait la clé étrangère.
    'conteneurs', coalesce((select jsonb_agg(to_jsonb(c) order by ordre)
                            from unnest(v_conteneurs) with ordinality as u(id, ordre)
                            join public.conteneurs c on c.id = u.id), '[]'::jsonb),
    'objets', coalesce((select jsonb_agg(to_jsonb(x)) from public.objets x
                        where x.id = any(v_objets)), '[]'::jsonb),
    'factures', coalesce((select jsonb_agg(to_jsonb(x)) from public.factures x
                          where x.id = any(v_factures)), '[]'::jsonb),
    'facture_objets', coalesce((select jsonb_agg(to_jsonb(x)) from public.facture_objets x
                                where x.objet_id = any(v_objets) or x.facture_id = any(v_factures)), '[]'::jsonb)
  );

  insert into public.corbeille (user_id, kind, label, resume, payload)
  values (
    auth.uid(),
    p_kind,
    v_label,
    jsonb_build_object(
      'pieces', coalesce(array_length(v_pieces, 1), 0),
      'emplacements', coalesce(array_length(v_emplacements, 1), 0),
      'conteneurs', coalesce(array_length(v_conteneurs, 1), 0),
      'objets', coalesce(array_length(v_objets, 1), 0),
      'factures', coalesce(array_length(v_factures, 1), 0)
    ),
    v_payload
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- === Restaurer =======================================================
--
-- Rend une chaîne : 'ok', ou le nom du maillon manquant. L'écran en fait un
-- message ; une exception serait remontée comme « une erreur est survenue »,
-- ce qui n'aiderait personne à comprendre qu'il faut restaurer le rangement
-- avant l'objet qu'il contenait.

create or replace function public.corbeille_restaurer(p_id uuid)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_kind text;
  v_payload jsonb;
  v_manquant text;
begin
  select kind, payload into v_kind, v_payload from public.corbeille where id = p_id;
  if v_kind is null then
    return 'introuvable';
  end if;

  -- ── LE PARENT DOIT ENCORE EXISTER ───────────────────────────────────
  --
  -- On peut avoir supprimé l'objet, PUIS le meuble qui le contenait. Les deux
  -- sont dans la corbeille, mais l'objet ne peut revenir que dans un meuble
  -- qui est déjà revenu. On refuse plutôt que de le rattacher ailleurs.
  select case
    when v_kind = 'piece' and not exists (
      select 1 from public.habitations h
      where h.id = (v_payload -> 'pieces' -> 0 ->> 'habitation_id')::uuid
    ) then 'habitation'
    when v_kind = 'emplacement' and not exists (
      select 1 from public.pieces p
      where p.id = (v_payload -> 'emplacements' -> 0 ->> 'piece_id')::uuid
    ) then 'piece'
    when v_kind = 'conteneur' and not exists (
      select 1 from public.emplacements e
      where e.id = (v_payload -> 'conteneurs' -> 0 ->> 'parent_emplacement_id')::uuid
      union all
      select 1 from public.conteneurs c
      where c.id = (v_payload -> 'conteneurs' -> 0 ->> 'parent_conteneur_id')::uuid
    ) then 'conteneur'
    when v_kind = 'objet' and not exists (
      select 1 from public.emplacements e
      where e.id = (v_payload -> 'objets' -> 0 ->> 'parent_emplacement_id')::uuid
      union all
      select 1 from public.conteneurs c
      where c.id = (v_payload -> 'objets' -> 0 ->> 'parent_conteneur_id')::uuid
    ) then 'conteneur'
    else null
  end into v_manquant;

  if v_manquant is not null then
    return 'parent_manquant';
  end if;

  -- ── LA RÉINSERTION, PARENT AVANT ENFANT ─────────────────────────────
  --
  -- `on conflict do nothing` : une ligne peut avoir été recréée à la main
  -- entre-temps, et on ne va pas écraser le travail de quelqu'un avec une
  -- photographie plus ancienne.
  insert into public.habitations select * from jsonb_populate_recordset(null::public.habitations, v_payload -> 'habitations')
  on conflict (id) do nothing;

  insert into public.pieces select * from jsonb_populate_recordset(null::public.pieces, v_payload -> 'pieces')
  on conflict (id) do nothing;

  insert into public.emplacements select * from jsonb_populate_recordset(null::public.emplacements, v_payload -> 'emplacements')
  on conflict (id) do nothing;

  -- L'ordre du tableau est celui de la profondeur (voir corbeille_deposer) :
  -- `with ordinality` le préserve jusqu'ici.
  insert into public.conteneurs
  select (rec).*
  from (
    select jsonb_populate_record(null::public.conteneurs, element) as rec
    from jsonb_array_elements(v_payload -> 'conteneurs') with ordinality as t(element, ordre)
    order by ordre
  ) s
  on conflict (id) do nothing;

  insert into public.objets select * from jsonb_populate_recordset(null::public.objets, v_payload -> 'objets')
  on conflict (id) do nothing;

  insert into public.factures select * from jsonb_populate_recordset(null::public.factures, v_payload -> 'factures')
  on conflict (id) do nothing;

  -- Les liaisons EN DERNIER : elles référencent les deux côtés, et seulement
  -- celles dont les deux extrémités sont revenues. Une facture supprimée
  -- séparément peut ne pas être là.
  insert into public.facture_objets
  select fo.*
  from jsonb_populate_recordset(null::public.facture_objets, v_payload -> 'facture_objets') fo
  where exists (select 1 from public.factures f where f.id = fo.facture_id)
    and exists (select 1 from public.objets o where o.id = fo.objet_id)
  on conflict (id) do nothing;

  delete from public.corbeille where id = p_id;
  return 'ok';
end;
$$;

-- === Vider ===========================================================
--
-- La suppression définitive, celle qu'on assume. Elle ne touche qu'à la
-- corbeille : ce qu'elle contient n'existe déjà plus nulle part ailleurs.

create or replace function public.corbeille_vider()
returns void
language sql
security invoker
set search_path = public
as $$
  delete from public.corbeille where user_id = auth.uid();
$$;

-- === Lire ============================================================
--
-- SANS LE `payload`, et c'est délibéré : il contient l'inventaire entier d'une
-- habitation supprimée, soit des centaines de lignes. L'écran n'affiche qu'un
-- nom, une date et des décomptes ; rapatrier le reste à chaque ouverture
-- coûterait cher pour ne rien montrer.

create or replace function public.corbeille_lister()
returns table (
  id uuid,
  kind text,
  label text,
  resume jsonb,
  deleted_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, c.kind, c.label, c.resume, c.deleted_at
  from public.corbeille c
  where c.user_id = auth.uid()
  order by c.deleted_at desc
$$;
