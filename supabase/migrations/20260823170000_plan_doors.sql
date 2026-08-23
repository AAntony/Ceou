-- Les portes, deuxième tentative.
--
-- La première (15/08) a été retirée le jour même, sur ce motif : « ça
-- rajoute de l'information visuelle inutile ». Le modèle de données n'y
-- était pour rien — c'était le RENDU, une pastille ronde à icône posée sur
-- le mur, qui chargeait le plan. Cette fois la porte est une INTERRUPTION du
-- trait de mur, la convention des plans d'architecte : elle retire de
-- l'encre au lieu d'en ajouter. Le schéma, lui, est repris tel quel, il
-- décrivait déjà correctement ce qu'est une porte.
--
-- `edge` + `position` plutôt qu'un point x/y libre : une porte est par
-- définition une ouverture DANS un mur. La contrainte est portée par le
-- modèle, pas par le code qui l'affiche — impossible de poser une porte au
-- milieu d'une pièce, même par erreur de calcul côté client.
--
-- La LARGEUR n'est pas stockée : toutes les portes ont la même (décision
-- produit du 23/08). Le jour où elle deviendrait réglable, une colonne
-- `width` avec un défaut suffira, sans rien casser.
--
-- Aucune conséquence fonctionnelle ailleurs : pas de recherche de chemin,
-- aucune contrainte de connectivité entre pièces. C'est une annotation.
create table public.plan_doors (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  -- La porte appartient à UNE pièce, celle sur le mur de laquelle elle est
  -- posée. Deux pièces accolées partagent visuellement le mur, mais la
  -- porte reste rattachée à une seule : rien à synchroniser, et supprimer
  -- une pièce emporte ses portes sans laisser d'orpheline.
  forme_id uuid not null references public.plan_formes (id) on delete cascade,
  edge text not null default 's' check (edge in ('n', 'e', 's', 'w')),
  -- Centre de l'ouverture, 0..1 le long du bord. Relatif et non absolu :
  -- redimensionner la pièce déplace la porte avec son mur.
  position real not null default 0.5 check (position >= 0 and position <= 1),
  created_at timestamptz not null default now()
);

create index plan_doors_plan_id_idx on public.plan_doors (plan_id);
create index plan_doors_forme_id_idx on public.plan_doors (forme_id);

alter table public.plan_doors enable row level security;

-- Copie conforme des policies de plan_pins depuis le passage au partage
-- (20260817100000) : consultation pour lire, modification pour écrire. Un
-- ami en Consultation voit les portes du plan qu'on lui a ouvert, il n'en
-- pose pas.
create policy "plan_doors_select" on public.plan_doors
  for select using (public.has_habitation_access(public.plan_habitation(plan_id), auth.uid(), 'consultation'));

create policy "plan_doors_write" on public.plan_doors
  for all
  using (public.has_habitation_access(public.plan_habitation(plan_id), auth.uid(), 'modification'))
  with check (public.has_habitation_access(public.plan_habitation(plan_id), auth.uid(), 'modification'));
