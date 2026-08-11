create function public.diag_try_insert(p_emplacement_id uuid)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_new_id uuid;
begin
  insert into public.conteneurs (name, parent_emplacement_id)
  values ('Diag Via Function', p_emplacement_id)
  returning id into v_new_id;
  return 'OK: ' || v_new_id::text;
exception when others then
  return 'ERROR: ' || SQLSTATE || ' - ' || SQLERRM;
end;
$$;
