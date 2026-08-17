-- Phase 8b — génération d'invitation côté serveur, pour deux raisons :
-- 1) un code unique généré côté client risquerait une collision (même
--    improbable) sans visibilité sur les codes déjà pris ;
-- 2) SURTOUT : la policy RLS "share_invites_insert" (created_by = auth.uid())
--    ne vérifie PAS que le créateur a réellement le droit de partager les
--    Habitations listées — un insert direct depuis le client pourrait sinon
--    créer une invitation référençant des Habitations qu'il ne possède pas,
--    et redeem_share_invite() ferait alors confiance à ce contenu en
--    créant un vrai accès. Cette fonction est donc le SEUL chemin
--    recommandé pour créer une invitation.
create function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..10 loop
      code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.share_invites where code = code);
  end loop;
  return code;
end;
$$;

create function public.create_share_invite(p_habitation_ids uuid[], p_permission text, p_target_type text)
returns public.share_invites
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_row public.share_invites;
  v_hid uuid;
begin
  if v_me is null then
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

  insert into public.share_invites (code, created_by, habitation_ids, permission, target_type)
  values (public.generate_invite_code(), v_me, p_habitation_ids, p_permission, p_target_type)
  returning * into v_row;

  return v_row;
end;
$$;
