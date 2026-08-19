-- Correctif de la migration 20260819100000 (fermeture de l'énumération).
--
-- CE QUE J'AI CASSÉ : en supprimant les policies SELECT de storage.objects,
-- j'ai ferme l'enumeration anonyme (le but, atteint et verifie) mais aussi
-- l'envoi de photos. `uploadImage` (src/lib/images/pickAndUploadImage.ts)
-- appelle toujours `.upload(..., { upsert: true })` ; un upsert doit
-- determiner si le fichier existe deja, ce qui exige un SELECT sur
-- storage.objects. Sans aucune policy SELECT, l'upload echoue, l'objet est
-- enregistre avec photo_url a null, et l'app affiche l'icone generique a la
-- place de la photo — sur TOUS les ecrans, puisque c'est la donnee qui
-- manque et non le fichier.
--
-- POURQUOI MON CONTROLE NE L'A PAS VU : j'avais verifie la LECTURE (une URL
-- publique sert toujours son JPEG, ce qui reste vrai — l'endpoint public ne
-- consulte pas la RLS). Je n'avais pas verifie l'ECRITURE, alors que c'est
-- l'autre moitie du cycle de vie d'une photo. Lecon a retenir : une policy
-- SELECT ne sert pas qu'a lire.
--
-- LA BONNE FRONTIERE : rendre a chaque utilisateur la lecture de SES
-- PROPRES fichiers, et rien d'autre. C'est strictement meilleur que les deux
-- etats precedents :
--   - avant le 19/08 : `using (bucket_id = 'objets')` — n'importe qui,
--     meme non connecte, listait et telechargeait tout ;
--   - depuis le 19/08 : plus aucun SELECT — enumeration fermee, mais envoi
--     de photos casse ;
--   - ici : `to authenticated` + prefixe de dossier = l'uid de l'appelant.
--     L'upsert retrouve ses propres fichiers, un utilisateur connecte ne
--     voit que son dossier, un visiteur anonyme ne voit toujours rien.
--
-- Le prefixe de dossier est deja la convention d'ecriture du projet (voir
-- les policies insert/update/delete d'origine, inchangees) : tout chemin est
-- de la forme <uid>/<id objet>.jpg. On reutilise donc exactement le meme
-- test, cote lecture cette fois.
--
-- Rappel inchange : les buckets restent `public = true`, donc les URLs
-- stockees dans objets.photo_url / profiles.avatar_url continuent d'etre
-- servies sans authentification. Fermer cela demande des buckets prives +
-- URLs signees — chantier a part, toujours pas entrepris.

create policy "storage_owner_read" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('objets', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
