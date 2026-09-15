# Robustesse des déménagements

## Changements de l’étape 5

- Les commandes disposent d’un verrou immédiat par formulaire/écran. Un second appui avant le rendu React ne lance pas une deuxième requête et n’est pas mis en attente.
- Hors ligne, l’envoi est refusé sans requête. Les formulaires restent ouverts avec leur saisie. Une réponse perdue est présentée comme un résultat non confirmé : recharger avant de réessayer.
- Un déménagement absent du cache affiche une explication hors ligne, au lieu d’un indicateur permanent.
- Les règles de concurrence et la traduction des erreurs sont isolées de la présentation dans `commandGuard.ts` et `errors.ts`.
- La commande de sortie d’inventaire sauvegarde dans la corbeille puis retire l’objet dans une seule transaction. L’ancienne fonction ne faisait que la sauvegarde, ce que la simulation de test masquait. Aucun retrait rétroactif des objets déjà traités.

## Vérification

`npm run verify:ci` : 49 tests réussis, TypeScript valide, 32 avertissements ESLint préexistants.

Les tests PostgreSQL isolés exécutent les fonctions réelles de résolution des droits de partage, de corbeille et de déménagement. Ils vérifient notamment le refus des accès étrangers, la confidentialité de la corbeille, la préservation des photos, l’annulation complète d’un lot invalide et la cohérence des métadonnées photo carton/conteneur. Les autres tables et services de l’inventaire restent une fixture minimale.

## Limites et validation téléphone

- Les politiques du stockage Supabase, l’envoi des fichiers, les partages par groupe et une restauration complète avec factures ne sont pas couverts par cette suite. Aucun test n’écrit dans l’inventaire personnel.
- Le verrou protège les appuis concurrents dans une même instance ; les contrôles transactionnels serveur restent nécessaires pour plusieurs appareils.
- Après une réponse réseau perdue, aucune commande n’est rejouée automatiquement. Les identifiants de création restent stables tant que le formulaire reste ouvert ; après fermeture, vérifier la liste avant de recréer.
- Sur téléphone : ouvrir un formulaire puis couper le réseau, vérifier que la saisie reste présente et que l’envoi est désactivé ; rétablir le réseau et enregistrer une seule fois. Un double appui rapide ne doit créer qu’un carton.
- La sortie d’inventaire et la restauration doivent être validées avec un objet de test explicitement créé pour cela. Le comportement natif en perte de réseau n’a pas été vérifié sur appareil connecté.
