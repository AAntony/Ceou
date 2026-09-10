-- Qui a le droit de lire un fichier du stockage — étape 1 sur 2.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS : elle ne ferme pas les buckets. Ils
-- restent `public = true`, l'endpoint public continue de servir, et rien ne
-- change à l'écran. Elle prépare le terrain, et c'est tout.
--
-- POURQUOI EN DEUX TEMPS. Fermer les buckets et apprendre à l'app à demander
-- des adresses signées sont deux changements qui doivent se croiser dans le
-- bon ordre. La policy de lecture doit exister AVANT que l'app ne se mette à
-- signer — sinon un ami à qui une habitation est partagée verrait sa demande
-- refusée. Une fois l'app à jour et publiée, la migration suivante fera
-- passer `public` à false, et ce sera un aller simple d'une seule ligne,
-- réversible d'une seule ligne aussi.
--
-- LE DÉFAUT CORRIGÉ, rappelé pour mémoire : les migrations du 19/08
-- (close_storage_enumeration, restore_owner_storage_read) ont fermé
-- l'énumération anonyme mais ont laissé les buckets publics, en nommant
-- explicitement le reste comme chantier à part — « fermer cela demande des
-- buckets privés + URLs signées ». C'est ce chantier-là.

-- === De quel nœud un fichier est-il la photo ? ==========================
--
-- CETTE FONCTION DÉPEND D'UNE CONVENTION DE NOMMAGE, et il faut le dire
-- fort. Les chemins sont écrits par l'app, à trois endroits :
--
--   <uid>/<id objet>.jpg            AddObjetModal, ObjetFormBody, queries
--   <uid>/<niveau>-<id>.jpg         entityPhoto (habitation/piece/…)
--   <uid>/avatar.jpg                uploadAvatar
--
-- Changer une de ces trois formes sans toucher ici rendrait des photos
-- illisibles à ceux à qui elles sont partagées — jamais au propriétaire,
-- dont le droit ne passe pas par cette résolution. Le défaut serait donc
-- invisible pour celui qui le provoque. À garder ensemble.
--
-- Un identifiant nu fait 36 caractères : c'est ce qui distingue un Objet
-- (`<uuid>.jpg`) d'un autre niveau (`<niveau>-<uuid>.jpg`), sans avoir à
-- deviner où couper une chaîne qui contient déjà des tirets.
create or replace function public.media_habitation(p_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  base text := split_part(split_part(p_name, '/', 2), '.', 1);
  kind text;
  node uuid;
  habitation uuid;
begin
  if length(base) = 36 then
    select public.location_habitation(o.parent_emplacement_id, o.parent_conteneur_id)
      into habitation
      from public.objets o
     where o.id = base::uuid;
    return habitation;
  end if;

  kind := split_part(base, '-', 1);
  node := substring(base from length(kind) + 2)::uuid;

  if kind = 'habitation' then
    return node;
  elsif kind in ('piece', 'emplacement', 'conteneur') then
    return public.habitation_id_for_node(kind, node);
  end if;

  return null;
exception
  -- Un nom de fichier qui ne suit aucune des formes attendues ne doit pas
  -- faire échouer une policy : il ne donne simplement aucun droit dérivé.
  when others then
    return null;
end;
$$;

-- === Deux personnes se voient-elles ? ===================================
--
-- Sert aux AVATARS, qui n'appartiennent à aucune habitation. Le portrait de
-- quelqu'un s'affiche dans les écrans d'amis et de partage : la condition est
-- donc « cette personne et moi sommes en relation », pas « ce fichier est
-- dans une habitation que je vois ».
--
-- Les deux sens de partage comptent. Celui à qui j'ouvre une habitation
-- apparaît dans MES écrans de partage, et moi dans les siens : si le droit
-- n'allait que dans un sens, un des deux verrait une pastille vide en face
-- d'un nom.
create or replace function public.shares_context_with(p_owner uuid, p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = p_owner and f.addressee_id = p_viewer)
        or (f.requester_id = p_viewer and f.addressee_id = p_owner)
      )
  )
  or exists (
    select 1
    from public.habitations h
    where h.user_id = p_owner
      and public.habitation_share_permission(h.id, p_viewer) is not null
  )
  or exists (
    select 1
    from public.habitations h
    where h.user_id = p_viewer
      and public.habitation_share_permission(h.id, p_owner) is not null
  )
$$;

-- === Le droit de lecture, en une seule fonction =========================
--
-- Un seul point de passage, comme `has_habitation_access` l'est pour les
-- tables. La policy ci-dessous n'est qu'une ligne qui l'appelle : la logique
-- se relit, se teste et se corrige à un seul endroit.
--
-- L'ORDRE DES TESTS COMPTE. Le propriétaire est reconnu au premier, sur le
-- seul préfixe du chemin, sans toucher une table — c'est le cas de très loin
-- le plus fréquent, et c'est aussi celui qui doit continuer de marcher même
-- si la résolution par convention de nommage venait à échouer.
--
-- Le propriétaire d'un FICHIER n'est pas forcément celui de l'habitation :
-- un ami autorisé à modifier dépose ses photos sous SON identifiant. D'où
-- les deux branches, qui ne se recouvrent pas.
create or replace function public.can_read_media(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    split_part(p_name, '/', 1) = auth.uid()::text
    or case p_bucket
      when 'objets' then
        public.has_habitation_access(public.media_habitation(p_name), auth.uid(), 'consultation')
      when 'avatars' then
        -- Le `case` et non un `and` : PostgreSQL ne garantit pas l'ordre
        -- d'évaluation d'un `and`, et un chemin dont le préfixe n'est pas un
        -- identifiant ferait alors échouer la conversion — donc la requête
        -- entière, dans une fonction sql qui ne sait pas rattraper. Ici
        -- l'ordre est garanti.
        case
          when split_part(p_name, '/', 1) ~ '^[0-9a-fA-F-]{36}$'
            then public.shares_context_with(split_part(p_name, '/', 1)::uuid, auth.uid())
          else false
        end
      -- Tout bucket qu'on n'a pas prévu est refusé. Un bucket ajouté plus
      -- tard sera donc illisible tant qu'on ne l'a pas déclaré ici — ce qui
      -- se remarque tout de suite, là où l'inverse ne se remarquerait pas.
      else false
    end
$$;

-- === La policy ==========================================================
--
-- Remplace `storage_owner_read`, qui n'autorisait que le propriétaire. Elle
-- suffisait tant que le partage passait par l'endpoint public ; elle
-- refuserait tout le reste dès que ce n'est plus le cas.
--
-- `to authenticated` couvre AUSSI le mode Invité : un invité passe par
-- `supabase.auth.signInAnonymously()`, il a donc une vraie session, et
-- `habitation_share_permission` reconnaît déjà son accès dérivé du code
-- (migration guest_invites du 20/08). Rien de spécial à prévoir pour lui.
drop policy if exists "storage_owner_read" on storage.objects;

create policy "media_read" on storage.objects
  for select to authenticated
  using (public.can_read_media(bucket_id, name));
