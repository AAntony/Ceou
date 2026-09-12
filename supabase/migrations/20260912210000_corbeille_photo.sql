-- La corbeille montre la photo de ce qu'on a supprimé.
--
-- POURQUOI : la liste n'affichait que l'icône du TYPE — la même pour les
-- quarante objets d'une cave. « Objet » ne dit pas QUEL objet, et c'est
-- précisément ce qu'on vient chercher ici. Signalé à l'usage dès le premier
-- essai.
--
-- LA PHOTO EST COPIÉE DANS LA CORBEILLE, pas relue du `payload`. Deux raisons
-- qui se cumulent : `corbeille_lister` ne rend délibérément pas le payload
-- (il contient l'inventaire entier d'une habitation supprimée), et le
-- rapatrier à chaque ouverture pour n'en tirer qu'une adresse coûterait des
-- centaines de lignes pour une vignette.
--
-- ELLE RESTE LISIBLE APRÈS LA SUPPRESSION, et ce n'est pas un hasard : le
-- fichier du bucket survit à la suppression de la ligne (c'est déjà le cas
-- pour les photos d'objets et les documents de factures), et la première
-- clause de `can_read_media` autorise le propriétaire sur son propre préfixe
-- SANS consulter la table. Un objet supprimé garde donc sa vignette.
--
-- L'exception connue : quelqu'un qui supprime dans l'habitation d'un autre.
-- Le fichier est rangé sous le préfixe du PROPRIÉTAIRE, et la seconde clause
-- de `can_read_media` remonte à l'habitation par l'identifiant de l'objet —
-- lequel n'existe plus. La vignette ne se chargera pas, et l'écran retombe
-- alors sur l'icône du type. Dégradé, jamais cassé.

alter table public.corbeille add column if not exists photo_url text;

-- Le dépôt copie l'adresse au passage. Reste identique par ailleurs : voir la
-- migration de la corbeille pour le raisonnement d'ensemble.
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
  v_photo text;
  v_payload jsonb;
  v_id uuid;
begin
  if p_kind = 'habitation' then
    select coalesce(array_agg(id), '{}') into v_pieces from public.pieces where habitation_id = p_id;
  elsif p_kind = 'piece' then
    v_pieces := array[p_id];
  end if;

  if p_kind = 'emplacement' then
    v_emplacements := array[p_id];
  elsif array_length(v_pieces, 1) is not null then
    select coalesce(array_agg(id), '{}') into v_emplacements
    from public.emplacements where piece_id = any(v_pieces);
  end if;

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

  if p_kind = 'objet' then
    v_objets := array[p_id];
  else
    select coalesce(array_agg(id), '{}') into v_objets
    from public.objets
    where parent_emplacement_id = any(v_emplacements) or parent_conteneur_id = any(v_conteneurs);
  end if;

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

  v_label := case p_kind
    when 'habitation' then (select name from public.habitations where id = p_id)
    when 'piece' then (select name from public.pieces where id = p_id)
    when 'emplacement' then (select name from public.emplacements where id = p_id)
    when 'conteneur' then (select name from public.conteneurs where id = p_id)
    when 'objet' then (select name from public.objets where id = p_id)
    when 'facture' then (select coalesce(vendor, '') from public.factures where id = p_id)
  end;

  -- LA PHOTO D'UNE FACTURE EST SON DOCUMENT, et seulement quand c'est une
  -- image : un PDF n'a pas de vignette, et pointer dessus donnerait un cadre
  -- vide là où l'icône dit au moins « facture ».
  v_photo := case p_kind
    when 'habitation' then (select photo_url from public.habitations where id = p_id)
    when 'piece' then (select photo_url from public.pieces where id = p_id)
    when 'emplacement' then (select photo_url from public.emplacements where id = p_id)
    when 'conteneur' then (select photo_url from public.conteneurs where id = p_id)
    when 'objet' then (select photo_url from public.objets where id = p_id)
    when 'facture' then (select case when document_kind = 'image' then document_url end
                         from public.factures where id = p_id)
  end;

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

  insert into public.corbeille (user_id, kind, label, photo_url, resume, payload)
  values (
    auth.uid(),
    p_kind,
    v_label,
    v_photo,
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

-- Le type de retour change, donc `drop` puis `create`.
drop function if exists public.corbeille_lister();

create function public.corbeille_lister()
returns table (
  id uuid,
  kind text,
  label text,
  photo_url text,
  resume jsonb,
  deleted_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, c.kind, c.label, c.photo_url, c.resume, c.deleted_at
  from public.corbeille c
  where c.user_id = auth.uid()
  order by c.deleted_at desc
$$;
