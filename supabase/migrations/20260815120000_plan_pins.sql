-- Phase 7 (rendu isométrique) : une pastille représente un Emplacement
-- (Armoire, Commode...) positionné précisément dans une pièce du plan.
-- rel_x/rel_y sont normalisées 0..1 dans le repère LOCAL de la pièce (pas en
-- pixels canvas) pour rester correctes si la pièce est redimensionnée.
-- unique(emplacement_id) : un Emplacement n'a qu'une seule pastille au
-- maximum, cohérent avec le principe "un objet a un seul emplacement" déjà
-- appliqué ailleurs dans l'app.
create table public.plan_pins (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  forme_id uuid not null references public.plan_formes (id) on delete cascade,
  emplacement_id uuid not null references public.emplacements (id) on delete cascade,
  rel_x real not null default 0.5,
  rel_y real not null default 0.5,
  created_at timestamptz not null default now(),
  unique (emplacement_id)
);

create index plan_pins_plan_id_idx on public.plan_pins (plan_id);
create index plan_pins_forme_id_idx on public.plan_pins (forme_id);

alter table public.plan_pins enable row level security;

-- Même style que plan_formes_all_own : jointure directe via des colonnes
-- déjà présentes sur la ligne, pas de fonction security definer nécessaire
-- pour un seul hop de jointure.
create policy "plan_pins_all_own" on public.plan_pins
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
