-- Même famille de bug que la migration précédente : `conteneurs_all_own`
-- appelait `emplacement_owner`/`conteneur_owner` directement dans un CASE
-- au niveau de la policy plutôt que via une fonction security definer
-- englobante (comme le fait déjà `objet_owner` pour la table `objets`,
-- qui fonctionne). Reproduit exactement ce pattern.

create function public.conteneur_parent_owner(p_parent_emplacement_id uuid, p_parent_conteneur_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    public.emplacement_owner(p_parent_emplacement_id),
    public.conteneur_owner(p_parent_conteneur_id)
  )
$$;

drop policy "conteneurs_all_own" on public.conteneurs;
create policy "conteneurs_all_own" on public.conteneurs
  for all
  using (public.conteneur_owner(id) = auth.uid())
  with check (public.conteneur_parent_owner(parent_emplacement_id, parent_conteneur_id) = auth.uid());
