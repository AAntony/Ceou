-- Root cause trouvée : `conteneurs_all_own` (FOR ALL) avait USING
-- `conteneur_owner(id) = auth.uid()`, qui fait une recherche
-- auto-référencée sur `conteneurs` (WHERE id = ...). Pendant un INSERT, la
-- nouvelle ligne n'est pas encore visible à une sous-requête sur sa propre
-- table, donc cette recherche ne trouve jamais rien et USING échoue
-- systématiquement — même quand WITH CHECK (testé isolément, correct) est
-- satisfait. Le même piège existait dans la version originale
-- d'`emplacements_all_own` (corrigée par accident dans une migration
-- précédente en changeant simplement quelle colonne était vérifiée).
--
-- Fix propre et définitif : séparer les policies par commande plutôt que
-- FOR ALL, pour ne jamais dépendre de USING pendant un INSERT.

drop policy "conteneurs_all_own" on public.conteneurs;

create policy "conteneurs_select" on public.conteneurs
  for select using (public.conteneur_owner(id) = auth.uid());

create policy "conteneurs_insert" on public.conteneurs
  for insert with check (public.conteneur_parent_owner(parent_emplacement_id, parent_conteneur_id) = auth.uid());

create policy "conteneurs_update" on public.conteneurs
  for update
  using (public.conteneur_owner(id) = auth.uid())
  with check (public.conteneur_parent_owner(parent_emplacement_id, parent_conteneur_id) = auth.uid());

create policy "conteneurs_delete" on public.conteneurs
  for delete using (public.conteneur_owner(id) = auth.uid());

drop function public.diag_policies();
