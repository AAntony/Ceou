-- Bug trouvé en test manuel : l'ajout d'un Emplacement échouait avec
-- "new row violates row-level security policy for table emplacements"
-- (42501) même quand la Pièce appartenait bien à l'utilisateur (vérifié
-- directement via l'API REST). Cause : `pieces_all_own`/`emplacements_all_own`
-- vérifiaient la propriété via des EXISTS/JOIN bruts sur des tables
-- elles-mêmes protégées par RLS (jusqu'à deux niveaux pour emplacements),
-- contrairement à `conteneurs`/`objets` qui utilisent déjà des fonctions
-- security definer (`emplacement_owner`, `conteneur_owner`, `objet_owner`)
-- pour éviter exactement ce genre de sous-requête RLS imbriquée pendant un
-- WITH CHECK. On aligne pieces/emplacements sur le même pattern.

create function public.habitation_owner(p_habitation_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select user_id from public.habitations where id = p_habitation_id
$$;

create function public.piece_owner(p_piece_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select h.user_id
  from public.pieces p
  join public.habitations h on h.id = p.habitation_id
  where p.id = p_piece_id
$$;

drop policy "pieces_all_own" on public.pieces;
create policy "pieces_all_own" on public.pieces
  for all
  using (public.habitation_owner(habitation_id) = auth.uid())
  with check (public.habitation_owner(habitation_id) = auth.uid());

drop policy "emplacements_all_own" on public.emplacements;
create policy "emplacements_all_own" on public.emplacements
  for all
  using (public.piece_owner(piece_id) = auth.uid())
  with check (public.piece_owner(piece_id) = auth.uid());
