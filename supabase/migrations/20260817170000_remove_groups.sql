-- Phase 9a — retrait complet de la fonctionnalité "Groupe d'amis", jugée
-- inutile après usage réel. Retire le partage vers un groupe (une Habitation
-- ne peut plus être partagée qu'avec un ami individuel) puis les tables de
-- groupe elles-mêmes.
--
-- Conséquence assumée : tout partage d'Habitation fait vers un groupe
-- (`shared_with_group_id`) est perdu avec la colonne. Les partages
-- individuels ami-par-ami (`shared_with_user_id`) ne sont pas touchés.

-- === habitation_shares_select : retire la clause groupe =================

drop policy "habitation_shares_select" on public.habitation_shares;

create policy "habitation_shares_select" on public.habitation_shares
  for select using (
    public.can_manage_habitation_sharing(habitation_id, auth.uid())
    or shared_with_user_id = auth.uid()
  );

-- === habitation_share_permission : retire la branche groupe =============

create or replace function public.habitation_share_permission(p_habitation_id uuid, p_user_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select s.permission
  from public.habitation_shares s
  where s.habitation_id = p_habitation_id
    and s.shared_with_user_id = p_user_id
  order by case s.permission when 'proprietaire' then 3 when 'modification' then 2 else 1 end desc
  limit 1
$$;

-- === list_habitation_shares : signature de retour change (DROP+CREATE) =

drop function public.list_habitation_shares(uuid);

create function public.list_habitation_shares(p_habitation_id uuid)
returns table (
  id uuid,
  permission text,
  shared_with_user_id uuid,
  shared_with_user_display_name text,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select s.id, s.permission, s.shared_with_user_id, p.display_name, s.created_at
  from public.habitation_shares s
  left join public.profiles p on p.id = s.shared_with_user_id
  where s.habitation_id = p_habitation_id
    and public.can_manage_habitation_sharing(p_habitation_id, auth.uid())
$$;

-- === upsert_habitation_share : retire le paramètre groupe (DROP+CREATE) =

drop function public.upsert_habitation_share(uuid, uuid, uuid, text);

create function public.upsert_habitation_share(
  p_habitation_id uuid,
  p_shared_with_user_id uuid,
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

  insert into public.habitation_shares (habitation_id, shared_with_user_id, permission, shared_by)
  values (p_habitation_id, p_shared_with_user_id, p_permission, v_me)
  on conflict (habitation_id, shared_with_user_id) where shared_with_user_id is not null
  do update set permission = excluded.permission
  returning id into v_id;

  return v_id;
end;
$$;

-- === habitation_shares : retire la colonne/contrainte/index groupe ======

-- Les lignes qui ciblaient UNIQUEMENT un groupe (shared_with_user_id null)
-- n'ont plus aucune cible valable une fois la colonne groupe retirée —
-- conséquence assumée du retrait de la fonctionnalité (voir commentaire en
-- tête de fichier), pas un oubli.
delete from public.habitation_shares where shared_with_user_id is null;

alter table public.habitation_shares drop constraint habitation_shares_exactly_one_target;
alter table public.habitation_shares drop column shared_with_group_id;
alter table public.habitation_shares alter column shared_with_user_id set not null;

-- === Tables de groupe (leurs policies RLS partent avec elles) ===========

drop table public.friend_group_members;
drop table public.friend_groups cascade;
