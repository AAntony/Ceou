# Céoù — version de refonte mobile

Branche : `codex/ceou-refonte-accessible`. Date : 12 septembre 2026.

Cette version applique la direction de l’audit à l’application React Native. Elle privilégie la recherche, la lisibilité et les gestes de rangement du quotidien. Le document d’audit décrit aussi des évolutions futures ; il ne constitue pas la liste des fonctionnalités livrées dans ce commit.

## Changements réalisés

- Identité commune : fonds sable, surfaces claires, bleu profond, typographie plus lisible ; adaptation du thème sombre. Contrastes des principales couleurs de texte testés à 4,5:1 minimum.
- Navigation : Retrouver, Lieux, Partages, Profil ; onglet actif plus visible et libellés explicites.
- Accueil : recherche persistante en haut, ajout et assistant vocal accessibles, filtres par lieu et pièce, résultats en liste par défaut et grille optionnelle. Le grand texte impose une colonne.
- Recherche : priorité au nom exact puis aux correspondances de plusieurs mots, prise en compte du contexte de rangement, accents ignorés, distinction des pièces homonymes par identifiant. Le périmètre existant des lieux favoris est annoncé.
- Résultats et listes : photos réelles ou icônes, noms et localisations sans troncature ; commandes de favori, édition et réordonnancement séparées de la zone de navigation.
- Fiche objet : lecture séparée de l’édition, destination mise en avant, historique réduit aux trois dernières entrées avec accès à la suite. Le brouillon d’édition n’est plus remplacé lors d’un rafraîchissement ; confirmation avant abandon et détection d’une modification concurrente déjà reçue.
- Ajout : étapes explicites, respect des zones de sécurité du téléphone et raccourcis vers les cinq dernières destinations présentes dans l’index autorisé. Depuis un rangement, possibilité d’enregistrer puis d’ajouter un autre objet au même endroit.
- Partage : explication de chaque droit dans des cartes de sélection ; accueil plus explicite pour les invités.
- Accessibilité : cibles tactiles agrandies, champs nommés pour les lecteurs d’écran, icônes décoratives masquées, états de sélection, annonces de résultats et confirmation de sauvegarde locale. Réduction des animations des feuilles, de l’ajout, du déplacement et du repère de plan selon le réglage système.
- Assistant : correction du comptage des mots qui séparait auparavant les commandes sur la lettre « s ».
- Textes de la refonte disponibles en français et en anglais.

## Périmètre conservé

Les parcours de photo, scan, détection, voix, prêts, factures, plans, déplacement et partage réutilisent leurs services existants. Aucune migration Supabase, modification des politiques RLS ou nouvelle permission n’est introduite. Le fonctionnement local et la file de synchronisation existants sont conservés ; un enregistrement local ne signifie pas que le serveur l’a déjà reçu.

L’historique des destinations est propre au compte sur l’appareil et utilise le cache persistant existant, purgé à la déconnexion. Les raccourcis sont résolus dans l’index actuel et soumis au droit de modification. Un lieu absent de cet index ne figure pas dans ces raccourcis.

La recherche sur tous les lieux non favoris, les accès Airbnb limités à certaines pièces, les rôles professionnels détaillés et les workflows de maintenance restent des évolutions produit distinctes. La réduction des animations n’est pas encore exhaustive dans toute l’application. Cette version n’a pas reçu de certification d’accessibilité.

## Vérifications

- `npm run typecheck` : réussi.
- `npm run test:redesign` : 9 tests réussis (recherche, commandes vocales, contrastes clair/sombre, parité des traductions).
- `npm run lint` : aucune erreur, 33 avertissements contre 34 sur la base auditée.
- `npx expo export --platform android --output-dir dist/android-refonte` : bundle Android généré avec succès. Il ne s’agit ni d’un APK installé ni d’une publication OTA.
- `git diff --check` : réussi.

Le script de tests utilise la prise en charge TypeScript native de Node 24, présent sur cette machine. Node peut émettre un avertissement de détection ESM ; le type global du package n’a pas été changé pour préserver les configurations CommonJS.

## Recette native à effectuer

Aucun appareil n’était connecté lors des vérifications. La compilation ne prouve pas le rendu natif ni l’absence de régression à l’exécution. Les anomalies propres à l’aperçu web ne sont pas traitées comme des défauts mobiles.

1. Sur téléphone, parcourir Retrouver → fiche objet → rangement → modification, en thèmes clair et sombre et à la plus grande taille de texte ; vérifier les commandes accessibles au-dessus de la navigation et du clavier.
2. Avec TalkBack puis VoiceOver, vérifier l’ordre de lecture, les sélections, le focus à l’ouverture et à la fermeture des feuilles et les annonces de validation.
3. Ajouter un objet avec photo et code-barres, utiliser la détection photo, puis enchaîner des ajouts depuis un rangement ; vérifier les destinations récentes après déconnexion/reconnexion.
4. En mode avion, créer et déplacer un objet puis rétablir le réseau ; contrôler la synchronisation, les erreurs et l’absence de doublons.
5. Avec deux comptes de test, vérifier lecture seule, modification, révocation d’accès et édition concurrente ; contrôler prêts, factures et navigation depuis le plan.
6. Tester la reconnaissance vocale, son consentement et l’annulation du dernier déplacement sur appareil.

Aucun envoi Git distant ni aucune publication OTA n’a été effectué pour cette refonte.
