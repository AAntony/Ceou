-- Phase 8b — le client ne peut pas fiablement cibler un index unique
-- PARTIEL (habitation_shares_unique_user/_group, voir sharing_tables.sql)
-- via un simple .upsert() PostgREST : la clause ON CONFLICT générée ne
-- reprend pas le WHERE de l'index partiel. Passe donc par une fonction qui
-- écrit le ON CONFLICT ... WHERE ... exact, comme déjà fait dans
-- redeem_share_invite()/respond_to_friendship().
create function public.upsert_habitation_share(
  p_habitation_id uuid,
  p_shared_with_user_id uuid,
  p_shared_with_group_id uuid,
  p_permission text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_id uuid;
begin
  if not public.can_manage_habitation_sharing(p_habitation_id, v_me) then
    raise exception 'not_authorized';
  end if;
  if (p_shared_with_user_id is not null)::int + (p_shared_with_group_id is not null)::int <> 1 then
    raise exception 'exactly_one_target_required';
  end if;

  if p_shared_with_user_id is not null then
    insert into public.habitation_shares (habitation_id, shared_with_user_id, permission, shared_by)
    values (p_habitation_id, p_shared_with_user_id, p_permission, v_me)
    on conflict (habitation_id, shared_with_user_id) where shared_with_user_id is not null
    do update set permission = excluded.permission
    returning id into v_id;
  else
    insert into public.habitation_shares (habitation_id, shared_with_group_id, permission, shared_by)
    values (p_habitation_id, p_shared_with_group_id, p_permission, v_me)
    on conflict (habitation_id, shared_with_group_id) where shared_with_group_id is not null
    do update set permission = excluded.permission
    returning id into v_id;
  end if;

  return v_id;
end;
$$;
