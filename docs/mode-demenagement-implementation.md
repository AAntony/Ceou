# Mode Déménagement

## Parcours

Accès uniquement depuis **Lieux**, sous la liste des lieux : une entrée neutre ouvre directement la création sans projet actif, reprend le projet s'il est unique, ou affiche les projets s'il y en a plusieurs. Un lien distinct donne accès aux archives. La destination peut être créée pendant le parcours ou choisie plus tard.

Le tableau de bord regroupe les cartons, les étapes, les filtres et la progression. Chaque carton propose l'ajout multiple d'objets existants, l'analyse photo avec validation des correspondances, un QR, l'impression et la création du carton suivant avec les mêmes préférences. Le déballage réaffecte les objets aux emplacements de destination. Un carton peut devenir un rangement permanent. Les sorties (perdu, donné, vendu, jeté) utilisent la corbeille existante.

## Données et droits

Migration : `20260913010000_moving_mode.sql`. Les cartons sont des conteneurs réels et les objets gardent leur identité. Trois tables ajoutent les projets, cartons et historiques de participation. Les commandes passent par une transaction PostgreSQL ; un lot invalide est intégralement annulé. Les UUID des créations permettent de reprendre une requête sans doubler les objets.

Les droits de consultation ou modification sont vérifiés sur les deux logements. Le QR contient uniquement `ceou://moving-box/<uuid>` et ne donne aucun droit. Le complément de recherche retrouve les cartons et leur contenu direct pendant un déménagement, même hors des lieux favoris. Les déplacements d'objets effectués par les fonctions existantes actualisent aussi le suivi.

Terminer conserve les métadonnées et retire uniquement les cartons temporaires vides. Un logement lié à un projet actif ne peut pas être supprimé. La suppression du compte reste possible ; un projet terminé survit à la suppression du logement dans les archives de son créateur.

## Limites de cette version

- Les écritures de déménagement nécessitent une connexion ; les écrans déjà consultés peuvent être conservés par le cache habituel. Aucun lot hors ligne n'est présenté comme enregistré.
- Les lots sont limités à 500 objets par commande.
- Le suivi d'un carton porte sur ses objets directs. Les sous-conteneurs imbriqués ne sont pas suivis comme des cartons imbriqués ; ils empêchent la suppression automatique d'un carton non vide à la clôture.
- L'impression utilise le service d'impression Expo du système. La caméra, l'IA, l'impression et le confort avec lecteur d'écran doivent encore être validés sur téléphone.
- Un échec après téléversement photo peut laisser un fichier sans objet associé ; la reprise conserve les mêmes identifiants et ne duplique pas l'inventaire.

## Vérification

PGlite est une dépendance de développement installée par `npm ci`, indépendante du dossier d’export `dist`. `npm run test:moving` exécute la migration réelle avec un schéma de référence isolé et la fonction existante `move_objet`. Les 14 tests couvrent droits, révocation, QR, atomicité, idempotence, archivage, suppression de compte, lots de 500 objets, déplacements usuels et traductions. La corbeille et les permissions du schéma de référence sont des substituts : ces tests ne remplacent pas un essai intégré Supabase sur téléphone.

Vérifications complémentaires : TypeScript, ESLint ciblé, tests de refonte et export Android Expo.
