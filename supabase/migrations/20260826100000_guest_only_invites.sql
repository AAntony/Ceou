-- Un code généré ne peut plus servir à devenir ami.
--
-- LE DÉFAUT CORRIGÉ. « Partager mon code » proposait « Un ami », et rendait
-- alors un code de 10 caractères tiré par generate_invite_code() — donc PAS
-- le friend_code permanent du profil, qui en fait 8. Le destinataire qui
-- tapait ce code dans « Ajouter un ami » tombait sur send_friend_request(),
-- qui ne cherche que dans profiles.friend_code : « Aucun compte ne correspond
-- à ce code ». Seul le scan du QR fonctionnait, parce que lui seul portait le
-- préfixe qui oriente vers redeem_share_invite(). Deux codes d'apparence
-- identique pour deux opérations différentes, l'une des deux inatteignable au
-- clavier : le seul correctif solide est qu'il n'en reste qu'un.
--
-- LE MODÈLE RETENU. Devenir ami passe exclusivement par le friend_code
-- permanent, tapé ou scanné. Un code généré ne sert plus qu'à l'accès invité
-- sans compte, façon location. Les Habitations et les droits d'un ami se
-- règlent APRÈS l'acceptation, depuis sa fiche — et non à l'aveugle avant de
-- savoir qui scannera.
--
-- redeem_share_invite() N'EST PAS TOUCHÉE : sa branche 'friend' reste vivante
-- pour les codes déjà envoyés, qui ont jusqu'à 7 jours de validité devant eux.
-- Ils s'éteindront d'eux-mêmes. Rien ici ne supprime de ligne existante.

create or replace function public.create_share_invite(
  p_habitation_ids uuid[],
  p_permission text,
  p_target_type text,
  p_max_uses int default 1,
  p_expires_at timestamptz default null,
  p_label text default null,
  p_remind_days_before int default null
)
returns public.share_invites
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_row public.share_invites;
  v_hid uuid;
  v_max_uses int := p_max_uses;
  v_expires_at timestamptz := p_expires_at;
  v_remind int;
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

  -- Refusé, et non silencieusement rabattu sur 'guest' : un client resté sur
  -- l'ancien écran croirait avoir accordé un droit de Modification à un ami,
  -- alors qu'il aurait fabriqué un accès invité en consultation. Une erreur
  -- visible vaut mieux qu'un partage qui ne dit pas son nom.
  if p_target_type is distinct from 'guest' then
    raise exception 'friend_invites_removed';
  end if;

  foreach v_hid in array p_habitation_ids loop
    if not public.can_manage_habitation_sharing(v_hid, v_me) then
      raise exception 'not_authorized_for_habitation';
    end if;
  end loop;

  -- Un invité n'a jamais que la consultation : forcé ici plutôt que de faire
  -- confiance au client, qui pourrait envoyer autre chose.
  p_permission := 'consultation';

  if v_max_uses is not null and v_max_uses < 1 then
    raise exception 'invalid_max_uses';
  end if;
  if v_expires_at is not null and v_expires_at <= now() then
    raise exception 'invalid_expiry';
  end if;

  -- Un code permanent n'expire pas : il n'y a rien à rappeler.
  if v_expires_at is null then
    v_remind := null;
  else
    v_remind := greatest(1, least(3650, coalesce(p_remind_days_before, 1)));
  end if;

  insert into public.share_invites (
    code, created_by, habitation_ids, permission, target_type, max_uses, expires_at, label,
    remind_days_before
  )
  values (
    public.generate_invite_code(), v_me, p_habitation_ids, p_permission, 'guest',
    v_max_uses, v_expires_at, nullif(btrim(coalesce(p_label, '')), ''),
    v_remind
  )
  returning * into v_row;

  return v_row;
end;
$$;
