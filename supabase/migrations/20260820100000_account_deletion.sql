-- Suppression de compte : lève le dernier verrou qui l'empêcherait.
--
-- Toutes les tables qui référencent auth.users le font déjà en
-- `on delete cascade` (profiles, habitations, ai_scan_rate_limit,
-- friendships, habitation_shares, habitation_favorites, share_invites.
-- created_by) ou en `on delete set null` (client_errors.user_id) — SAUF
-- une : share_invites.redeemed_by, déclarée en Phase 8 sans clause
-- `on delete` du tout (20260817090000_sharing_tables.sql:119), donc en
-- NO ACTION implicite.
--
-- Conséquence concrète : tout utilisateur ayant déjà utilisé un code
-- d'invitation aurait vu sa suppression échouer sur une violation de clé
-- étrangère, avec un message Postgres illisible remonté jusqu'à l'app.
-- Ce n'est pas un cas marginal — c'est le chemin normal de toute personne
-- entrée dans l'app par une invitation d'ami.
--
-- `set null` plutôt que `cascade` : l'invitation elle-même appartient à
-- CELUI QUI L'A ÉMISE (created_by, déjà en cascade), pas à celui qui l'a
-- consommée. Supprimer le compte de l'invité ne doit pas effacer une ligne
-- d'historique qui appartient à quelqu'un d'autre — juste oublier qui
-- était l'invité.

alter table public.share_invites
  drop constraint share_invites_redeemed_by_fkey;

alter table public.share_invites
  add constraint share_invites_redeemed_by_fkey
  foreign key (redeemed_by) references auth.users (id) on delete set null;
