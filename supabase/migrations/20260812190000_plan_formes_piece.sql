-- Correction de conception (Phase 4) : une forme du plan représente une
-- Pièce entière (vue architecte), pas un Emplacement (niveau meuble à
-- l'intérieur d'une pièce) — cf. l'objectif énoncé du plan : "voir
-- rapidement dans quelle pièce se trouve un objet". Fonctionnalité jamais
-- construite, aucune ligne à migrer.
--
-- Policy `plan_formes_all_own` non touchée : elle résout déjà la propriété
-- via `plan_id` (colonne présente sur la ligne, pas une recherche
-- auto-référencée sur plan_formes elle-même), donc pas concernée par le
-- bug RLS des migrations précédentes.

alter table public.plan_formes drop column emplacement_id;
alter table public.plan_formes add column piece_id uuid references public.pieces (id) on delete set null;
