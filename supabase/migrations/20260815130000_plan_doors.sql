-- Phase 7-bis (retour au 2D top-down) : une porte est une annotation
-- purement visuelle sur le périmètre d'une pièce — "edge" + "position" (0..1
-- le long de ce bord) plutôt qu'un point libre x/y, une porte étant par
-- définition une ouverture DANS un mur, pas un point flottant dans la
-- pièce. Aucune conséquence fonctionnelle ailleurs dans l'app (pas de
-- pathfinding, pas de contrainte de connectivité entre pièces).
create table public.plan_doors (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  forme_id uuid not null references public.plan_formes (id) on delete cascade,
  edge text not null default 's' check (edge in ('n', 'e', 's', 'w')),
  position real not null default 0.5,
  created_at timestamptz not null default now()
);

create index plan_doors_plan_id_idx on public.plan_doors (plan_id);
create index plan_doors_forme_id_idx on public.plan_doors (forme_id);

alter table public.plan_doors enable row level security;

-- Même style que plan_pins_all_own : jointure directe via des colonnes déjà
-- présentes sur la ligne.
create policy "plan_doors_all_own" on public.plan_doors
  for all using (
    exists (
      select 1 from public.plans pl
      join public.habitations h on h.id = pl.habitation_id
      where pl.id = plan_id and h.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.plans pl
      join public.habitations h on h.id = pl.habitation_id
      where pl.id = plan_id and h.user_id = auth.uid()
    )
  );
