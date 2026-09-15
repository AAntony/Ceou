# Plan d’amélioration de Céoù

Chaque étape produit un commit sur main et un OTA Android preview. La suivante attend la validation de l’utilisateur. Aucun changement de schéma ou de dépendance native n’est implicite dans une étape visuelle.

## 1 — Fiabilité technique

- Automatiser TypeScript, ESLint et les 23 tests existants sur GitHub pour les push et pull requests.
- Installation reproductible par npm ci, Node 24, aucune clé Supabase ou Expo nécessaire aux tests isolés.
- Plafonner les avertissements ESLint à 32 après correction du nom d’import QR. Ne pas masquer les avertissements existants ; réduire ce plafond à chaque correction.
- Avant chaque OTA : exécuter npm run verify:ci, vérifier le commit et l’état Git, puis publier ce commit sur preview.
- Validation téléphone : ouverture, recherche, navigation Lieux, déménagement, lecture d’un QR. Cette étape ne refond pas l’apparence.

## 2 — Charte graphique

- Formaliser les rôles de couleurs clair/sombre et leur contraste, la hiérarchie de texte, les espacements et les arrondis.
- Unifier boutons, actions avec icônes, cartes et états sélectionnés via des composants partagés.
- Vérifier sur petit écran et grandes polices ; conserver les libellés des actions.
- Validation : cohérence de l’accueil, des Lieux et du déménagement.

## 3 — Ergonomie des parcours

- Réduire les actions simultanées ; adapter le déménagement à son étape.
- Simplifier les formulaires en reportant les informations facultatives.
- Séparer les actions occasionnelles des gestes fréquents et conserver l’assistant vocal à portée du pouce.
- Validation : création, remplissage, scan et déballage d’un carton sans ambiguïté.

## 4 — Accessibilité mobile

- Examiner les rôles et libellés, l’ordre de lecture, le focus des modales et les états désactivés.
- Vérifier grandes polices, contrastes, réduction des animations et cibles tactiles.
- Essais TalkBack/VoiceOver sur appareil ou émulateur accessible ; demander l’aide utilisateur uniquement pour les vérifications indisponibles.
- Validation : parcours de recherche et déménagement avec grande police et lecteur d’écran.

## 5 — Robustesse et maintenance

- Séparer les commandes, modales et présentation des écrans complexes sans modifier leurs contrats.
- Clarifier les états réseau, les erreurs et les reprises sans doublon.
- Étendre les tests sur les droits réels, la corbeille et les photos dans un environnement de test isolé, jamais en fabriquant des données dans l’inventaire personnel.
- Validation : pertes réseau et reprise des actions ; bilan des limites restantes.

## Suivi

- Étape 1 : validée par l’utilisateur ; commit 47659a1, OTA publié.
- Étape 2 : validée par l’utilisateur ; commit 6d50ea2, OTA publié.
- Étape 3 : terminée, commit 4c04cde et OTA publié ; poursuite demandée par l’utilisateur.
- Étape 4 : rôles bouton/radio/case à cocher corrigés dans les parcours déménagement, états occupé/désactivé préservés, geste de fermeture VoiceOver des modales et progression verticale en grande police. `npm run verify:ci` réussi (44 tests, 32 avertissements ESLint existants). Validation native TalkBack/VoiceOver et grandes polices encore nécessaire sur téléphone : aucun appareil connecté. OTA prévu pour cette validation.
- Étape 5 : en attente de validation de l’étape 4.
