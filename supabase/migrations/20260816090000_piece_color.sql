-- Couleur choisie par l'utilisateur pour une Pièce (distincte de la couleur
-- automatique par hash déjà utilisée sur le Plan quand aucune n'est
-- attribuée) — visible à la fois sur le Plan et dans la liste des Pièces
-- d'une Habitation. Nullable : aucune couleur par défaut, on retombe sur le
-- comportement existant tant que rien n'est choisi.
alter table public.pieces add column color text;
