-- Codes invités : multi-usage, durée paramétrable, accès dérivé du code.
--
-- MODÈLE RETENU (décidé avec l'utilisateur) : « l'accès suit le code ».
-- Un code permanent donne un accès permanent ; un code valable 3 jours donne
-- 3 jours d'accès à tous ceux qui l'ont utilisé, puis l'accès s'éteint seul.
-- Supprimer le code coupe immédiatement tout le monde. C'est le modèle d'une
-- location : le locataire part, l'accès expire sans aucune action.
--
-- CONSÉQUENCE DE CONCEPTION, la plus importante de ce fichier : un accès
-- invité n'est JAMAIS matérialisé en ligne de habitation_shares. Il est
-- dérivé à la lecture, du code lui-même. C'est ce qui rend l'expiration et
-- la suppression instantanées et sans nettoyage : il n'existe aucune ligne
-- d'accès à aller retirer quelque part. Matérialiser le partage aurait
-- demandé un travail périodique de purge, ou une date de fin recopiée sur
-- chaque ligne et à maintenir synchronisée avec le code.
--
-- Épuiser le nombre d'utilisations n'expulse PERSONNE : cela empêche
-- seulement de NOUVEAUX visiteurs d'entrer. Un code « 2 utilisations » qui
-- éjecterait ses deux visiteurs au moment où le second entre serait absurde.
-- Seules l'expiration et la suppression coupent l'accès.

-- === 1. Sessions anonymes ==============================================
-- Un visiteur entre par une session anonyme Supabase : un vrai auth.uid(),
-- mais sans e-mail ni mot de passe. Il n'a aucune donnée à créer dans l'app
-- (il ne fait que consulter), donc on lui ferme l'écriture plutôt que de
-- laisser traîner la possibilité de créer des habitations fantômes qu'il
-- perdrait de toute façon à la désinstallation.
create function public.is_anonymous()
returns boolean
language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;

drop policy "habitations_insert" on public.habitations;

-- Inchangé sauf le garde-fou anonyme : créer une Habitation reste un acte du
-- vrai propriétaire, et un visiteur n'est propriétaire de rien.
create policy "habitations_insert" on public.habitations
  for insert with check (user_id = auth.uid() and not public.is_anonymous());

-- === 2. share_invites : multi-usage et durée libre =====================

alter table public.share_invites
  add column max_uses int,
  add column use_count int not null default 0,
  add column label text;

-- null = ne s'épuise jamais / n'expire jamais. Le défaut de 7 jours est
-- conservé pour les invitations d'AMI, qui restent à usage unique et de
-- courte durée ; une invitation invité passe explicitement ses valeurs.
alter table public.share_invites alter column expires_at drop not null;

comment on column public.share_invites.max_uses is
  'Nombre maximum d''utilisations. NULL = illimite (code permanent).';
comment on column public.share_invites.expires_at is
  'Date d''expiration. NULL = n''expire jamais. Gouverne AUSSI l''acces deja accorde aux invites.';

-- Tout ce qui existait était à usage unique.
update public.share_invites
set max_uses = 1,
    use_count = case when redeemed_at is not null then 1 else 0 end;

alter table public.share_invites
  add constraint share_invites_max_uses_positive check (max_uses is null or max_uses >= 1);

-- === 3. Journal des utilisations =======================================
-- Remplace les colonnes redeemed_by/redeemed_at, qui ne pouvaient décrire
-- qu'UNE utilisation. Elles n'étaient lues nulle part côté application
-- (vérifié : seulement présentes dans les types générés), la bascule est
-- donc sans impact client.

create table public.share_invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.share_invites (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  -- Rescanner le même code ne consomme pas une deuxième utilisation : sans
  -- ça, un visiteur qui réinstalle l'app grillerait un usage du code de son
  -- hôte à chaque fois.
  unique (invite_id, user_id)
);

-- Lu à CHAQUE vérification de droit (voir habitation_share_permission plus
-- bas) : cet index n'est pas optionnel.
create index share_invite_redemptions_user_idx on public.share_invite_redemptions (user_id);
create index share_invite_redemptions_invite_idx on public.share_invite_redemptions (invite_id);
create index share_invites_habitation_ids_idx on public.share_invites using gin (habitation_ids);

alter table public.share_invite_redemptions enable row level security;

-- Lecture : la personne concernée, ou le propriétaire du code (écran de
-- gestion des codes). Aucune policy d'écriture : les lignes ne sont créées
-- que par redeem_share_invite (security definer), jamais directement par un
-- client — sinon n'importe qui pourrait se forger un accès en insérant une
-- ligne pointant sur le code d'un autre.
create policy "share_invite_redemptions_select" on public.share_invite_redemptions
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.share_invites i
      where i.id = invite_id and i.created_by = auth.uid()
    )
  );

insert into public.share_invite_redemptions (invite_id, user_id, redeemed_at)
select id, redeemed_by, coalesce(redeemed_at, now())
from public.share_invites
where redeemed_by is not null;

-- La migration 20260820100000 avait corrigé la clause `on delete` manquante
-- de redeemed_by (elle bloquait la suppression de compte). La colonne
-- disparaît ici, ce qui règle le même problème par la racine —
-- share_invite_redemptions.user_id porte bien un `on delete cascade`.
alter table public.share_invites drop column redeemed_by;
alter table public.share_invites drop column redeemed_at;

-- === 4. Droit effectif : le point de passage unique de toute la RLS =====
-- Toutes les policies de toutes les tables, search_index() et les écrans
-- passent par cette fonction. L'étendre ICI suffit à ce que l'accès invité
-- soit reconnu partout, sans toucher à une seule policy.
create or replace function public.habitation_share_permission(p_habitation_id uuid, p_user_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select permission from (
    -- Partage nominatif (mode Ami) : ligne explicite, durée illimitée.
    select s.permission as permission,
           case s.permission when 'proprietaire' then 3 when 'modification' then 2 else 1 end as rank
    from public.habitation_shares s
    where s.habitation_id = p_habitation_id
      and s.shared_with_user_id = p_user_id

    union all

    -- Accès invité : dérivé du code, jamais stocké comme partage. Toujours
    -- 'consultation'. L'expiration est évaluée à la lecture, donc un code
    -- périmé cesse de donner accès à la seconde près, et un code supprimé
    -- emporte ses utilisations en cascade.
    select 'consultation' as permission, 1 as rank
    from public.share_invite_redemptions r
    join public.share_invites i on i.id = r.invite_id
    where r.user_id = p_user_id
      and i.target_type = 'guest'
      and p_habitation_id = any (i.habitation_ids)
      and (i.expires_at is null or i.expires_at > now())
  ) candidates
  order by rank desc
  limit 1
$$;

-- === 5. Création d'un code =============================================
-- DROP + CREATE obligatoire : on ajoute des paramètres, et
-- `create or replace function` ne sait pas changer une liste d'arguments.
drop function public.create_share_invite(uuid[], text, text);

create function public.create_share_invite(
  p_habitation_ids uuid[],
  p_permission text,
  p_target_type text,
  p_max_uses int default 1,
  p_expires_at timestamptz default null,
  p_label text default null
)
returns public.share_invites
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_row public.share_invites;
  v_hid uuid;
  v_max_uses int := p_max_uses;
  v_expires_at timestamptz := p_expires_at;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if public.is_anonymous() then
    raise exception 'not_authenticated';
  end if;
  if array_length(p_habitation_ids, 1) is null or array_length(p_habitation_ids, 1) = 0 then
    raise exception 'no_habitations_selected';
  end if;

  foreach v_hid in array p_habitation_ids loop
    if not public.can_manage_habitation_sharing(v_hid, v_me) then
      raise exception 'not_authorized_for_habitation';
    end if;
  end loop;

  if p_target_type = 'guest' then
    -- Un invité n'a jamais que la consultation : forcé ici plutôt que de
    -- faire confiance au client, qui pourrait envoyer autre chose.
    p_permission := 'consultation';
  else
    -- Une invitation d'ami désigne UNE personne : ni multi-usage, ni
    -- permanente. Valeurs forcées pour que l'écran d'invité ne puisse pas
    -- fabriquer par erreur un code d'ami illimité.
    v_max_uses := 1;
    v_expires_at := coalesce(p_expires_at, now() + interval '7 days');
  end if;

  if v_max_uses is not null and v_max_uses < 1 then
    raise exception 'invalid_max_uses';
  end if;
  if v_expires_at is not null and v_expires_at <= now() then
    raise exception 'invalid_expiry';
  end if;

  insert into public.share_invites (
    code, created_by, habitation_ids, permission, target_type, max_uses, expires_at, label
  )
  values (
    public.generate_invite_code(), v_me, p_habitation_ids, p_permission, p_target_type,
    v_max_uses, v_expires_at, nullif(btrim(coalesce(p_label, '')), '')
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- === 6. Utilisation d'un code ==========================================
create or replace function public.redeem_share_invite(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_invite record;
  v_me uuid := auth.uid();
  v_friendship_id uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  -- `for update` verrouille la ligne pour toute la transaction : sans ça,
  -- deux visiteurs scannant un code « 1 utilisation » au même instant
  -- liraient tous les deux use_count = 0 et entreraient tous les deux.
  select * into v_invite from public.share_invites where code = p_code for update;
  if not found then
    raise exception 'invite_not_found';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'invite_expired';
  end if;
  if v_invite.created_by = v_me then
    raise exception 'cannot_redeem_own_invite';
  end if;

  -- Déjà utilisé PAR CETTE PERSONNE : on ne relance pas d'erreur et on ne
  -- consomme pas d'usage supplémentaire. Rescanner le QR affiché au mur
  -- d'un logement doit simplement ramener le visiteur chez lui.
  if exists (
    select 1 from public.share_invite_redemptions
    where invite_id = v_invite.id and user_id = v_me
  ) then
    if v_invite.target_type = 'guest' then
      return jsonb_build_object(
        'type', 'guest', 'granted', true, 'already', true,
        'habitation_ids', to_jsonb(v_invite.habitation_ids)
      );
    end if;
    raise exception 'invite_already_redeemed';
  end if;

  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    raise exception 'invite_exhausted';
  end if;

  insert into public.share_invite_redemptions (invite_id, user_id) values (v_invite.id, v_me);
  update public.share_invites set use_count = use_count + 1 where id = v_invite.id;

  if v_invite.target_type = 'guest' then
    -- AUCUNE ligne de habitation_shares n'est créée : l'accès est dérivé du
    -- code (voir habitation_share_permission). En revanche il faut poser les
    -- favoris, sinon l'écran d'accueil du visiteur serait vide — search_index
    -- ne remonte que les habitations favorites, et le déclencheur de favori
    -- automatique ne couvre que ses PROPRES habitations, qu'un invité n'a pas.
    insert into public.habitation_favorites (habitation_id, user_id)
    select h_id, v_me from unnest(v_invite.habitation_ids) as h_id
    on conflict (habitation_id, user_id) do nothing;

    return jsonb_build_object(
      'type', 'guest', 'granted', true, 'already', false,
      'habitation_ids', to_jsonb(v_invite.habitation_ids)
    );
  else
    insert into public.friendships (requester_id, addressee_id, status, source_invite_id)
    values (v_me, v_invite.created_by, 'pending', v_invite.id)
    on conflict (least(requester_id, addressee_id), greatest(requester_id, addressee_id)) do nothing
    returning id into v_friendship_id;

    if v_friendship_id is null then
      raise exception 'friendship_already_exists';
    end if;

    return jsonb_build_object('type', 'friend', 'friendship_id', v_friendship_id);
  end if;
end;
$$;

-- === 7. Gestion des codes par le propriétaire ==========================
-- Une fonction plutôt qu'un select direct : le client a besoin du NOM des
-- habitations, que la RLS de habitations lui donnerait de toute façon, mais
-- au prix d'une requête par code. Autant résoudre côté serveur.
create function public.list_my_share_invites()
returns table (
  id uuid,
  code text,
  label text,
  target_type text,
  permission text,
  habitation_ids uuid[],
  habitation_names text[],
  max_uses int,
  use_count int,
  expires_at timestamptz,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    i.id, i.code, i.label, i.target_type, i.permission, i.habitation_ids,
    array(
      select h.name from public.habitations h
      where h.id = any (i.habitation_ids)
      order by h.name
    ) as habitation_names,
    i.max_uses, i.use_count, i.expires_at, i.created_at
  from public.share_invites i
  where i.created_by = auth.uid()
  order by i.created_at desc
$$;

-- Renouveler / modifier un code existant. Passe par une fonction et non une
-- policy UPDATE : il faut valider les bornes, et surtout empêcher de
-- modifier code/created_by/target_type, qu'une policy UPDATE laisserait
-- réécrire librement.
create function public.update_share_invite(
  p_invite_id uuid,
  p_max_uses int,
  p_expires_at timestamptz,
  p_reset_uses boolean default false,
  p_label text default null
)
returns public.share_invites
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_row public.share_invites;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if p_max_uses is not null and p_max_uses < 1 then
    raise exception 'invalid_max_uses';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'invalid_expiry';
  end if;

  update public.share_invites
  set max_uses = p_max_uses,
      expires_at = p_expires_at,
      label = nullif(btrim(coalesce(p_label, '')), ''),
      -- Remettre le compteur à zéro rouvre le code à de nouveaux visiteurs
      -- SANS toucher aux utilisations déjà enregistrées : ceux qui sont
      -- déjà entrés gardent leur accès, ils ne comptent simplement plus
      -- dans le quota. C'est le sens de « renouveler » pour une location
      -- qui accueille les occupants suivants.
      use_count = case when p_reset_uses then 0 else use_count end
  where id = p_invite_id and created_by = v_me
  returning * into v_row;

  if not found then
    raise exception 'invite_not_found';
  end if;

  return v_row;
end;
$$;
