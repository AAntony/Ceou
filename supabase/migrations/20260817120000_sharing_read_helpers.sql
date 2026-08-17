-- Phase 8b — fonctions de lecture enrichies pour l'UI Amis. `profiles` a une
-- policy select restreinte à sa propre ligne (profiles_select_own), donc un
-- simple join côté client vers le profil d'un autre utilisateur ne
-- renverrait rien : ces deux fonctions passent en security definer pour
-- résoudre le nom affiché/l'avatar d'AUTRUI dans un cadre précis et borné
-- (uniquement mes propres relations d'amitié / les partages que je gère),
-- sans élargir l'accès général à la table profiles.

create function public.list_friendships()
returns table (
  id uuid,
  status text,
  direction text,
  other_user_id uuid,
  other_display_name text,
  other_friend_code text,
  other_avatar_url text,
  source_invite_id uuid,
  created_at timestamptz,
  responded_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    f.id,
    f.status,
    case when f.requester_id = auth.uid() then 'outgoing' else 'incoming' end,
    case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end,
    p.display_name,
    p.friend_code,
    p.avatar_url,
    f.source_invite_id,
    f.created_at,
    f.responded_at
  from public.friendships f
  join public.profiles p on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where f.requester_id = auth.uid() or f.addressee_id = auth.uid()
  order by f.created_at desc
$$;

-- Sécurité : bien que la fonction bypass la RLS de habitation_shares (elle
-- est security definer), elle reproduit ELLE-MÊME la même condition
-- d'autorisation (can_manage_habitation_sharing) dans son corps — sinon
-- n'importe quel utilisateur authentifié pourrait lire les partages de
-- n'importe quelle Habitation en appelant cette fonction directement.
create function public.list_habitation_shares(p_habitation_id uuid)
returns table (
  id uuid,
  permission text,
  shared_with_user_id uuid,
  shared_with_user_display_name text,
  shared_with_group_id uuid,
  shared_with_group_name text,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select s.id, s.permission, s.shared_with_user_id, p.display_name, s.shared_with_group_id, g.name, s.created_at
  from public.habitation_shares s
  left join public.profiles p on p.id = s.shared_with_user_id
  left join public.friend_groups g on g.id = s.shared_with_group_id
  where s.habitation_id = p_habitation_id
    and public.can_manage_habitation_sharing(p_habitation_id, auth.uid())
$$;

-- Retire un ami : supprime la relation ET les partages directs qu'il tient
-- (dans les deux sens — l'ami peut avoir partagé AVEC moi aussi). Les
-- partages via un groupe ne sont pas touchés (retirer le groupe entier
-- reste une action séparée et explicite).
create function public.remove_friend(p_friend_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.friendships
  where (requester_id = v_me and addressee_id = p_friend_user_id)
     or (requester_id = p_friend_user_id and addressee_id = v_me);

  delete from public.habitation_shares s
  where s.shared_with_user_id = p_friend_user_id
    and (
      s.shared_by = v_me
      or exists (select 1 from public.habitations h where h.id = s.habitation_id and h.user_id = v_me)
    );

  delete from public.habitation_shares s
  where s.shared_with_user_id = v_me
    and (
      s.shared_by = p_friend_user_id
      or exists (select 1 from public.habitations h where h.id = s.habitation_id and h.user_id = p_friend_user_id)
    );
end;
$$;
