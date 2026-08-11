-- Suite de la migration précédente : même après avoir séparé les policies
-- par commande, l'INSERT (avec RETURNING, ce que fait PostgREST par défaut)
-- échouait encore. Cause : Postgres vérifie aussi la policy SELECT sur la
-- ligne qui vient d'être insérée quand RETURNING est utilisé, et
-- `conteneurs_select` utilisait `conteneur_owner(id)` — auto-référencé sur
-- `conteneurs` — exactement le même piège que la migration précédente,
-- caché cette fois derrière RETURNING plutôt que directement dans le CHECK.
--
-- Fix : les policies propres à `conteneurs` (select/update/delete) peuvent
-- résoudre le propriétaire directement depuis les colonnes de la ligne
-- (parent_emplacement_id / parent_conteneur_id, déjà présentes) sans jamais
-- avoir besoin de se relire elle-même. `conteneur_owner(id)` reste utile
-- ailleurs (résoudre la propriété d'un conteneur PARENT déjà existant,
-- p.ex. depuis `objet_owner`), juste plus comme policy de `conteneurs` sur
-- sa propre ligne.

drop policy "conteneurs_select" on public.conteneurs;
create policy "conteneurs_select" on public.conteneurs
  for select using (public.conteneur_parent_owner(parent_emplacement_id, parent_conteneur_id) = auth.uid());

drop policy "conteneurs_update" on public.conteneurs;
create policy "conteneurs_update" on public.conteneurs
  for update
  using (public.conteneur_parent_owner(parent_emplacement_id, parent_conteneur_id) = auth.uid())
  with check (public.conteneur_parent_owner(parent_emplacement_id, parent_conteneur_id) = auth.uid());

drop policy "conteneurs_delete" on public.conteneurs;
create policy "conteneurs_delete" on public.conteneurs
  for delete using (public.conteneur_parent_owner(parent_emplacement_id, parent_conteneur_id) = auth.uid());

drop function public.diag_policies2();
drop function public.diag_check_owner(uuid);
drop function public.diag_try_insert(uuid);
drop function public.diag_check_invoker(uuid);
drop function public.diag_current_role();
