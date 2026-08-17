-- Phase 8a (partage d'Habitation) — fondations de données, partie 2/3 :
-- bascule de la RLS "propriétaire unique" vers "propriétaire + partages".
--
-- Piège déjà rencontré et corrigé une fois dans ce projet (migrations
-- 20260812110000 à 20260812180000, table conteneurs) : une policy RLS dont
-- le USING/CHECK interroge SA PROPRE table en filtrant sur l'id de la ligne
-- en cours (`where id = <la ligne elle-même>`) échoue pendant un INSERT
-- (RETURNING inclus) car la nouvelle ligne n'y est pas encore visible.
-- Règle strictement respectée ci-dessous : toute fonction appelée depuis la
-- policy d'une table ne doit interroger que d'AUTRES tables, ou la même
-- table mais via une colonne de clé ÉTRANGÈRE de la ligne (jamais sa propre
-- clé primaire).
--   - `habitation_share_permission`/`can_manage_habitation_sharing`
--     interrogent `habitation_shares` par `habitation_id` (FK), jamais par
--     son propre `id` — sûr même utilisé depuis la policy de
--     `habitation_shares` elle-même.
--   - `conteneur_habitation` interroge `conteneurs` par
--     `parent_conteneur_id` (FK vers une AUTRE ligne, forcément déjà
--     existante par contrainte d'intégrité référentielle) — jamais par
--     l'id de la ligne en cours d'écriture.

-- === Fonctions de résolution de droits =================================

-- Meilleur droit qu'un utilisateur tient sur une Habitation via un partage
-- (direct ou via un groupe dont il est membre) — null si aucun partage.
create function public.habitation_share_permission(p_habitation_id uuid, p_user_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select s.permission
  from public.habitation_shares s
  where s.habitation_id = p_habitation_id
    and (
      s.shared_with_user_id = p_user_id
      or s.shared_with_group_id in (select group_id from public.friend_group_members where friend_user_id = p_user_id)
    )
  order by case s.permission when 'proprietaire' then 3 when 'modification' then 2 else 1 end desc
  limit 1
$$;

-- Fonction centrale utilisée par TOUTES les tables SAUF habitations et
-- habitation_shares elles-mêmes (voir habitations_select/update et
-- can_manage_habitation_sharing plus bas, qui évitent volontairement de
-- passer par ici pour ne jamais s'auto-référencer).
create function public.has_habitation_access(p_habitation_id uuid, p_user_id uuid, p_min_permission text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.habitations h where h.id = p_habitation_id and h.user_id = p_user_id)
  or case public.habitation_share_permission(p_habitation_id, p_user_id)
       when 'proprietaire' then true
       when 'modification' then p_min_permission in ('consultation', 'modification')
       when 'consultation' then p_min_permission = 'consultation'
       else false
     end
$$;

-- Utilisée par les policies de habitation_shares elle-même (gérer les
-- partages) : vrai propriétaire, ou droit 'proprietaire' obtenu via partage.
create function public.can_manage_habitation_sharing(p_habitation_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.habitations h where h.id = p_habitation_id and h.user_id = p_user_id)
  or public.habitation_share_permission(p_habitation_id, p_user_id) = 'proprietaire'
$$;

-- Utilisée côté client (RPC) pour savoir quels boutons afficher — jamais
-- utilisée dans une policy RLS, donc aucune contrainte d'auto-référence.
create function public.get_effective_habitation_permission(p_habitation_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.habitations h where h.id = p_habitation_id and h.user_id = auth.uid()) then 'owner'
    else public.habitation_share_permission(p_habitation_id, auth.uid())
  end
$$;

-- Résolveurs "id -> habitation_id" (remplacent emplacement_owner/
-- conteneur_owner/conteneur_parent_owner/objet_owner/piece_owner/
-- habitation_owner, qui retournaient un user_id — même logique de
-- remontée, juste la valeur de retour qui change).
create function public.piece_habitation(p_piece_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select habitation_id from public.pieces where id = p_piece_id
$$;

create function public.emplacement_habitation(p_emplacement_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select p.habitation_id
  from public.emplacements e
  join public.pieces p on p.id = e.piece_id
  where e.id = p_emplacement_id
$$;

create function public.conteneur_habitation(p_conteneur_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  with recursive chain as (
    select id, parent_emplacement_id, parent_conteneur_id
    from public.conteneurs
    where id = p_conteneur_id
    union all
    select c.id, c.parent_emplacement_id, c.parent_conteneur_id
    from public.conteneurs c
    join chain on chain.parent_conteneur_id = c.id
  )
  select public.emplacement_habitation(parent_emplacement_id)
  from chain
  where parent_emplacement_id is not null
  limit 1
$$;

-- Remplace À LA FOIS conteneur_parent_owner et objet_owner (même logique de
-- coalesce, dupliquée dans l'ancien schéma — unifiée ici).
create function public.location_habitation(p_parent_emplacement_id uuid, p_parent_conteneur_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    public.emplacement_habitation(p_parent_emplacement_id),
    public.conteneur_habitation(p_parent_conteneur_id)
  )
$$;

create function public.plan_habitation(p_plan_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select habitation_id from public.plans where id = p_plan_id
$$;

-- === habitations (bespoke : jamais via has_habitation_access, qui
-- s'auto-référencerait ici — voir en-tête) =============================

drop policy "habitations_all_own" on public.habitations;

create policy "habitations_select" on public.habitations
  for select using (
    user_id = auth.uid()
    or public.habitation_share_permission(id, auth.uid()) is not null
  );

-- Créer une Habitation reste strictement un acte du vrai propriétaire —
-- le partage ne s'applique qu'à des Habitations déjà existantes.
create policy "habitations_insert" on public.habitations
  for insert with check (user_id = auth.uid());

create policy "habitations_update" on public.habitations
  for update
  using (user_id = auth.uid() or public.habitation_share_permission(id, auth.uid()) in ('modification', 'proprietaire'))
  with check (user_id = auth.uid() or public.habitation_share_permission(id, auth.uid()) in ('modification', 'proprietaire'));

-- Supprimer l'Habitation elle-même reste réservé au vrai propriétaire, même
-- pour un partage 'proprietaire' — règle explicite du modèle de droits.
create policy "habitations_delete" on public.habitations
  for delete using (user_id = auth.uid());

-- === pieces =============================================================

drop policy "pieces_all_own" on public.pieces;

create policy "pieces_select" on public.pieces
  for select using (public.has_habitation_access(habitation_id, auth.uid(), 'consultation'));

create policy "pieces_write" on public.pieces
  for all
  using (public.has_habitation_access(habitation_id, auth.uid(), 'modification'))
  with check (public.has_habitation_access(habitation_id, auth.uid(), 'modification'));

-- === emplacements ========================================================

drop policy "emplacements_all_own" on public.emplacements;

create policy "emplacements_select" on public.emplacements
  for select using (public.has_habitation_access(public.piece_habitation(piece_id), auth.uid(), 'consultation'));

create policy "emplacements_write" on public.emplacements
  for all
  using (public.has_habitation_access(public.piece_habitation(piece_id), auth.uid(), 'modification'))
  with check (public.has_habitation_access(public.piece_habitation(piece_id), auth.uid(), 'modification'));

-- === conteneurs (le plus sensible historiquement) =======================

drop policy "conteneurs_select" on public.conteneurs;
drop policy "conteneurs_insert" on public.conteneurs;
drop policy "conteneurs_update" on public.conteneurs;
drop policy "conteneurs_delete" on public.conteneurs;

create policy "conteneurs_select" on public.conteneurs
  for select using (public.has_habitation_access(public.location_habitation(parent_emplacement_id, parent_conteneur_id), auth.uid(), 'consultation'));

create policy "conteneurs_write" on public.conteneurs
  for all
  using (public.has_habitation_access(public.location_habitation(parent_emplacement_id, parent_conteneur_id), auth.uid(), 'modification'))
  with check (public.has_habitation_access(public.location_habitation(parent_emplacement_id, parent_conteneur_id), auth.uid(), 'modification'));

-- === objets ===============================================================

drop policy "objets_all_own" on public.objets;

create policy "objets_select" on public.objets
  for select using (public.has_habitation_access(public.location_habitation(parent_emplacement_id, parent_conteneur_id), auth.uid(), 'consultation'));

create policy "objets_write" on public.objets
  for all
  using (public.has_habitation_access(public.location_habitation(parent_emplacement_id, parent_conteneur_id), auth.uid(), 'modification'))
  with check (public.has_habitation_access(public.location_habitation(parent_emplacement_id, parent_conteneur_id), auth.uid(), 'modification'));

-- === objet_deplacements ===================================================

drop policy "objet_deplacements_all_own" on public.objet_deplacements;

create policy "objet_deplacements_select" on public.objet_deplacements
  for select using (
    exists (
      select 1 from public.objets o
      where o.id = objet_id
        and public.has_habitation_access(public.location_habitation(o.parent_emplacement_id, o.parent_conteneur_id), auth.uid(), 'consultation')
    )
  );

create policy "objet_deplacements_write" on public.objet_deplacements
  for all
  using (
    exists (
      select 1 from public.objets o
      where o.id = objet_id
        and public.has_habitation_access(public.location_habitation(o.parent_emplacement_id, o.parent_conteneur_id), auth.uid(), 'modification')
    )
  )
  with check (
    exists (
      select 1 from public.objets o
      where o.id = objet_id
        and public.has_habitation_access(public.location_habitation(o.parent_emplacement_id, o.parent_conteneur_id), auth.uid(), 'modification')
    )
  );

-- === plans / plan_formes / plan_pins =====================================

drop policy "plans_all_own" on public.plans;

create policy "plans_select" on public.plans
  for select using (public.has_habitation_access(habitation_id, auth.uid(), 'consultation'));

create policy "plans_write" on public.plans
  for all
  using (public.has_habitation_access(habitation_id, auth.uid(), 'modification'))
  with check (public.has_habitation_access(habitation_id, auth.uid(), 'modification'));

drop policy "plan_formes_all_own" on public.plan_formes;

create policy "plan_formes_select" on public.plan_formes
  for select using (public.has_habitation_access(public.plan_habitation(plan_id), auth.uid(), 'consultation'));

create policy "plan_formes_write" on public.plan_formes
  for all
  using (public.has_habitation_access(public.plan_habitation(plan_id), auth.uid(), 'modification'))
  with check (public.has_habitation_access(public.plan_habitation(plan_id), auth.uid(), 'modification'));

drop policy "plan_pins_all_own" on public.plan_pins;

create policy "plan_pins_select" on public.plan_pins
  for select using (public.has_habitation_access(public.plan_habitation(plan_id), auth.uid(), 'consultation'));

create policy "plan_pins_write" on public.plan_pins
  for all
  using (public.has_habitation_access(public.plan_habitation(plan_id), auth.uid(), 'modification'))
  with check (public.has_habitation_access(public.plan_habitation(plan_id), auth.uid(), 'modification'));

-- === nettoyage des anciennes fonctions "*_owner" (plus référencées par
-- aucune policy à partir d'ici) — ordre de dépendance : les fonctions qui
-- en appellent d'autres sont supprimées en premier. =====================

drop function public.conteneur_parent_owner(uuid, uuid);
drop function public.objet_owner(uuid, uuid);
drop function public.conteneur_owner(uuid);
drop function public.emplacement_owner(uuid);
drop function public.piece_owner(uuid);
drop function public.habitation_owner(uuid);
