-- Jetons de notification push (Expo Push).
--
-- La CLE PRIMAIRE est le JETON, pas (user_id, token) : un jeton Expo
-- identifie une INSTALLATION de l'app sur un appareil, pas une personne. En
-- faisant du jeton la clé, la connexion d'un autre compte sur le même
-- téléphone ECRASE la ligne (upsert) au lieu d'en ajouter une seconde — le
-- compte précédent cesse donc de recevoir les notifications de cet appareil.
-- C'est la base qui porte cette règle, pas un nettoyage applicatif qu'on
-- pourrait oublier d'appeler.
--
-- Pas de suppression en cascade à écrire pour la suppression de compte :
-- `on delete cascade` sur auth.users suffit, la fonction delete-account
-- supprime bien l'utilisateur auth en dernière étape.

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- Chacun ne voit et n'écrit que ses propres jetons. La fonction send-push,
-- elle, lit les jetons du DESTINATAIRE (donc de quelqu'un d'autre) : elle
-- passe par la clé service_role, seule voie qui contourne cette policy,
-- exactement comme les autres fonctions Edge du projet.
create policy "push_tokens_all_own" on public.push_tokens
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.push_tokens is
  'Un jeton Expo Push par installation de l''app. Ecrase par le dernier compte connecte sur l''appareil.';

-- Le compteur de débit générique (user_id, kind) accueille un troisième
-- usage : l'envoi de notifications. Rien à modifier structurellement, juste
-- le commentaire qui documentait les deux valeurs existantes.
comment on column public.ai_scan_rate_limit.kind is
  'Usage limite : ''scan'' (detection photo), ''voice'' (assistant vocal) ou ''push'' (envoi de notification).';
