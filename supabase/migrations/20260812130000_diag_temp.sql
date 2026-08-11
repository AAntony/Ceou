-- Fonction de diagnostic temporaire, supprimée dans la migration suivante.
create function public.diag_policies()
returns table (policyname text, cmd text, qual text, with_check text)
language sql stable security definer set search_path = public as $$
  select policyname, cmd, qual, with_check
  from pg_policies
  where schemaname = 'public' and tablename = 'conteneurs'
$$;
