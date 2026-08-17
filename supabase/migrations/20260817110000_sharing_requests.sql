-- Phase 8a (partage d'Habitation) — fondations de données, partie 3/3 :
-- RLS des tables de partage elles-mêmes + les 3 opérations qui doivent
-- rester atomiques (demande d'ami, redemption d'invitation, réponse à une
-- demande) passent par des fonctions security definer plutôt que des
-- inserts/updates client directs — chacune touche potentiellement deux
-- tables dans le même mouvement (ex: accepter une demande ET appliquer le
-- partage pré-configuré qui l'accompagnait), même raisonnement que
-- move_objet() déjà en place pour les déplacements d'objet.

-- === habitation_shares ==================================================

alter table public.habitation_shares enable row level security;

create policy "habitation_shares_select" on public.habitation_shares
  for select using (
    public.can_manage_habitation_sharing(habitation_id, auth.uid())
    or shared_with_user_id = auth.uid()
    or shared_with_group_id in (select group_id from public.friend_group_members where friend_user_id = auth.uid())
  );

create policy "habitation_shares_write" on public.habitation_shares
  for all
  using (public.can_manage_habitation_sharing(habitation_id, auth.uid()))
  with check (public.can_manage_habitation_sharing(habitation_id, auth.uid()));

-- === friendships =========================================================

alter table public.friendships enable row level security;

create policy "friendships_select" on public.friendships
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Garde-fou RLS pour un insert direct — en pratique, send_friend_request()/
-- redeem_share_invite() ci-dessous sont le chemin normal (ils valident en
-- plus l'existence du destinataire, l'auto-ajout, etc.).
create policy "friendships_insert" on public.friendships
  for insert with check (auth.uid() = requester_id);

create policy "friendships_update" on public.friendships
  for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id)
  with check (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "friendships_delete" on public.friendships
  for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- === friend_groups / friend_group_members ===============================

alter table public.friend_groups enable row level security;

create policy "friend_groups_all_own" on public.friend_groups
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table public.friend_group_members enable row level security;

create policy "friend_group_members_all_own" on public.friend_group_members
  for all using (
    exists (select 1 from public.friend_groups g where g.id = group_id and g.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.friend_groups g where g.id = group_id and g.owner_id = auth.uid())
  );

-- === share_invites ========================================================
-- Volontairement PAS de policy select ouverte par code : n'importe qui
-- pourrait alors lister/deviner les invitations des autres. La redemption
-- passe exclusivement par redeem_share_invite() (security definer,
-- bypass RLS), le créateur garde juste la visibilité sur SES propres
-- invitations générées (pour les révoquer/suivre leur statut).

alter table public.share_invites enable row level security;

create policy "share_invites_select" on public.share_invites
  for select using (created_by = auth.uid());

create policy "share_invites_insert" on public.share_invites
  for insert with check (created_by = auth.uid());

create policy "share_invites_delete" on public.share_invites
  for delete using (created_by = auth.uid());

-- === Ajout d'ami manuel (code permanent tapé à la main, sans partage
-- pré-configuré) ==========================================================

create function public.send_friend_request(p_friend_code text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_target uuid;
  v_me uuid := auth.uid();
  v_id uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  select id into v_target from public.profiles where friend_code = upper(p_friend_code);
  if v_target is null then
    raise exception 'friend_code_not_found';
  end if;
  if v_target = v_me then
    raise exception 'cannot_add_self';
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (v_me, v_target, 'pending')
  on conflict (least(requester_id, addressee_id), greatest(requester_id, addressee_id)) do nothing
  returning id into v_id;

  if v_id is null then
    raise exception 'friendship_already_exists';
  end if;

  return v_id;
end;
$$;

-- === Redemption d'une invitation "Partager mon code" / "Inviter un
-- invité" (share_invites — habitations + droit déjà configurés par le
-- créateur) ===============================================================

create function public.redeem_share_invite(p_code text)
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

  select * into v_invite from public.share_invites where code = p_code;
  if not found then
    raise exception 'invite_not_found';
  end if;
  if v_invite.redeemed_at is not null then
    raise exception 'invite_already_redeemed';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'invite_expired';
  end if;
  if v_invite.created_by = v_me then
    raise exception 'cannot_redeem_own_invite';
  end if;

  update public.share_invites set redeemed_by = v_me, redeemed_at = now() where id = v_invite.id;

  if v_invite.target_type = 'guest' then
    -- Effet immédiat, pas de friendship — un invité n'a pas de compte au
    -- moment de la redemption, rien à lui faire "accepter".
    insert into public.habitation_shares (habitation_id, shared_with_user_id, permission, shared_by)
    select h_id, v_me, v_invite.permission, v_invite.created_by
    from unnest(v_invite.habitation_ids) as h_id
    on conflict (habitation_id, shared_with_user_id) where shared_with_user_id is not null
    do update set permission = excluded.permission;

    return jsonb_build_object('type', 'guest', 'granted', true);
  else
    -- Mode ami : le partage n'est appliqué qu'à l'acceptation (voir
    -- respond_to_friendship) — requester = celui qui redeem le code,
    -- addressee = celui qui a généré l'invitation (doit approuver).
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

-- === Réponse à une demande d'ami reçue ===================================

create function public.respond_to_friendship(p_friendship_id uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_friendship record;
  v_invite record;
  v_me uuid := auth.uid();
begin
  select * into v_friendship from public.friendships where id = p_friendship_id;
  if not found then
    raise exception 'friendship_not_found';
  end if;
  if v_friendship.addressee_id <> v_me then
    raise exception 'not_addressee';
  end if;
  if v_friendship.status <> 'pending' then
    raise exception 'already_responded';
  end if;

  update public.friendships
  set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where id = p_friendship_id;

  -- N'applique le partage pré-configuré qu'à l'acceptation d'une demande
  -- issue d'une invitation (source_invite_id) — un ajout manuel par code
  -- n'a rien à appliquer, il ne fait que créer le contact.
  if p_accept and v_friendship.source_invite_id is not null then
    select * into v_invite from public.share_invites where id = v_friendship.source_invite_id;
    if found then
      insert into public.habitation_shares (habitation_id, shared_with_user_id, permission, shared_by)
      select h_id, v_friendship.requester_id, v_invite.permission, v_friendship.addressee_id
      from unnest(v_invite.habitation_ids) as h_id
      on conflict (habitation_id, shared_with_user_id) where shared_with_user_id is not null
      do update set permission = excluded.permission;
    end if;
  end if;
end;
$$;
