-- Les buckets passent en privé — étape 2 sur 2.
--
-- CE QUE ÇA FERME. L'endpoint `/storage/v1/object/public/...` servait les
-- fichiers sans authentification et SANS consulter la RLS. N'importe qui
-- ayant obtenu une adresse gardait donc l'accès au fichier indéfiniment,
-- même après révocation d'un partage, et un vidage de la base livrait des
-- adresses directement ouvrables. À partir d'ici, une adresse stockée ne
-- répond plus : il faut une signature, délivrée seulement à qui la policy
-- `media_read` reconnaît (migration du 2026-09-10).
--
-- CE QUE ÇA NE CHANGE PAS :
--
--  - Les colonnes `photo_url` / `avatar_url` gardent leur forme. Elles
--    portent le chemin ET la version du fichier, ce dont l'app a besoin pour
--    demander une signature et pour garder une clé de cache stable. Les
--    réécrire en chemin nu aurait coûté une reprise de toutes les lignes
--    pour un gain cosmétique — et une fois ici, ces adresses ne répondent de
--    toute façon plus à personne.
--  - L'ENVOI de fichiers. Les policies insert/update/delete ne dépendent pas
--    de `public`, et la branche « propriétaire » de `media_read` couvre le
--    SELECT dont un upsert a besoin. C'est le défaut du 19/08, vérifié à
--    l'usage avant d'en arriver là.
--  - La suppression de compte : `delete-account` passe par le client admin,
--    qui ignore et la RLS et la visibilité du bucket.
--
-- POUR REVENIR EN ARRIÈRE, si l'affichage des photos se révélait cassé :
--
--   update storage.buckets set public = true where id in ('avatars', 'objets');
--
-- Les adresses stockées redeviennent servables à la seconde, sans rien
-- déployer côté application — c'est précisément pour garder cette sortie
-- que la forme des colonnes n'a pas été touchée.

update storage.buckets
set public = false
where id in ('avatars', 'objets');
