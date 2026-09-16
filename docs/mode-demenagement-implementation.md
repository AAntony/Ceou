# Mode Déménagement

## Parcours

Accès uniquement depuis **Lieux**, onglet de ses propres lieux. Sans déménagement en cours, rien n'est affiché : on le lance par **+ Ajouter → Déménager**, qui ouvre directement la création s'il n'existe encore aucun projet, et la liste des déménagements sinon (projets en cours, création, archives). Pendant un déménagement, une barre compacte reste posée au-dessus des onglets : elle reprend le projet s'il est unique, ou affiche les projets s'il y en a plusieurs, et montre le pourcentage traité du tableau de bord quand un seul projet a déjà des objets en cartons. Elle disparaît dans « Partagées » et dès que le déménagement est terminé. La destination peut être créée pendant le parcours ou choisie plus tard.

Le tableau de bord regroupe les cartons, les étapes, les filtres et la progression. Chaque carton propose l'ajout multiple d'objets existants, l'analyse photo avec validation des correspondances, un QR, l'impression et la création du carton suivant avec les mêmes préférences. Le déballage réaffecte les objets aux emplacements de destination. Un carton peut devenir un rangement permanent. Les sorties (perdu, donné, vendu, jeté) utilisent la corbeille existante.

## Données et droits

Migration : `20260913010000_moving_mode.sql`. Les cartons sont des conteneurs réels et les objets gardent leur identité. Trois tables ajoutent les projets, cartons et historiques de participation. Les commandes passent par une transaction PostgreSQL ; un lot invalide est intégralement annulé. Les UUID des créations permettent de reprendre une requête sans doubler les objets.

Les droits de consultation ou modification sont vérifiés sur les deux logements. Le QR contient uniquement `ceou://moving-box/<uuid>` et ne donne aucun droit. Le complément de recherche retrouve les cartons et leur contenu direct pendant un déménagement, même hors des lieux favoris. Les déplacements d'objets effectués par les fonctions existantes actualisent aussi le suivi.

Terminer conserve les métadonnées et retire uniquement les cartons temporaires vides. Un logement lié à un projet actif ne peut pas être supprimé. La suppression du compte reste possible ; un projet terminé survit à la suppression du logement dans les archives de son créateur.

### Supprimer un carton rempli

La migration `20260916120000_moving_box_contents.sql` ajoute un choix explicite à la suppression d’un carton temporaire :

- **Garder les objets** : les objets encore présents retrouvent leur premier emplacement connu, même après un transfert entre cartons. Si l’emplacement a disparu, est inaccessible ou appartient à un carton temporaire, ils sont conservés dans **Objets à ranger**, au lieu de départ. Les objets créés directement dans le carton et les rangements imbriqués sans historique utilisent aussi cet emplacement. La hiérarchie des rangements imbriqués est conservée.
- **Supprimer aussi le contenu** : après une seconde confirmation, une copie complète du carton, des rangements imbriqués, des objets, des photos et des liens de factures est déposée dans la corbeille avant suppression. La restauration habituelle reste soumise à l’existence du parent du carton.

Les objets déjà sortis du carton ne changent pas. Un carton stocké est uniquement retiré du suivi : son rangement permanent et son contenu restent dans l’inventaire. Un carton contenant un autre carton de déménagement doit d’abord être séparé de celui-ci pour préserver les deux suivis. La suppression d’un projet entier reste limitée aux cartons vides.

Les droits de modification sont vérifiés côté serveur. Les parents, descendants et objets sont verrouillés pendant l’opération ; une erreur annule toute la suppression. Les anciens clients qui ne transmettent pas de choix continuent à recevoir un refus pour un carton rempli. Les emplacements de récupération survivent à la suppression du suivi.

## Limites de cette version

- Les écritures de déménagement nécessitent une connexion ; les écrans déjà consultés peuvent être conservés par le cache habituel. Aucun lot hors ligne n'est présenté comme enregistré.
- Les lots sont limités à 500 objets par commande.
- Le suivi d'un carton porte sur ses objets directs. Les sous-conteneurs imbriqués ne sont pas suivis comme des cartons imbriqués ; ils empêchent la suppression automatique d'un carton non vide à la clôture.
- L'impression utilise le service d'impression Expo du système. La caméra, l'IA, l'impression et le confort avec lecteur d'écran doivent encore être validés sur téléphone.
- Un échec après téléversement photo peut laisser un fichier sans objet associé ; la reprise conserve les mêmes identifiants et ne duplique pas l'inventaire.

## Vérification

PGlite est une dépendance de développement installée par `npm ci`, indépendante du dossier d’export `dist`. `npm run test:moving` exécute les migrations réelles avec un schéma d’inventaire isolé et les fonctions existantes de déplacement, de corbeille et de résolution des permissions. Les tests couvrent droits, révocation, QR, atomicité, idempotence, archivage, suppression de compte, lots de 500 objets, déplacements usuels, traductions et suppression des cartons remplis. Les échecs tardifs sont simulés pour vérifier l’annulation des déplacements, des emplacements de récupération et des copies en corbeille. Ces tests ne remplacent pas un essai intégré Supabase sur téléphone.

Vérifications complémentaires : TypeScript, ESLint ciblé, tests de refonte et export Android Expo.
