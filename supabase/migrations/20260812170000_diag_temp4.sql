create function public.diag_check_invoker(p_emplacement_id uuid)
returns table (computed_owner uuid, current_uid uuid, matches boolean)
language sql stable security invoker set search_path = public as $$
  select public.conteneur_parent_owner(p_emplacement_id, null), auth.uid(), public.conteneur_parent_owner(p_emplacement_id, null) = auth.uid()
$$;

create function public.diag_current_role()
returns table (cur_role text, cur_user text, jwt_claims text)
language sql stable as $$
  select current_role::text, current_user::text, current_setting('request.jwt.claims', true)
$$;
