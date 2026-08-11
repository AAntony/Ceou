create function public.diag_policies2()
returns table (policyname text, cmd text, permissive text, roles text, qual text, with_check text)
language sql stable security definer set search_path = public as $$
  select policyname, cmd, permissive, roles::text, qual, with_check
  from pg_policies
  where schemaname = 'public' and tablename = 'conteneurs'
$$;

create function public.diag_check_owner(p_emplacement_id uuid)
returns table (computed_owner uuid, current_uid uuid, matches boolean)
language sql stable security definer set search_path = public as $$
  select public.emplacement_owner(p_emplacement_id), auth.uid(), public.emplacement_owner(p_emplacement_id) = auth.uid()
$$;
