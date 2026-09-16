# Refactorisation — septembre 2026

## Contrat

Conserver les parcours, textes, droits, règles métier, clés du cache et formats des écritures hors ligne. Aucun changement de schéma SQL ni dépendance native. Les modifications sans gain démontrable ne font pas partie de ce passage.

## Plan de travail

1. **Performances** : préparer la recherche une fois par inventaire, conserver strictement le classement, paralléliser ses lectures indépendantes, éviter les allocations et recherches répétées.
2. **Modularité** : isoler les calculs purs des plans et de l'arborescence de leurs composants et accès réseau ; supprimer les dépendances circulaires identifiées.
3. **Robustesse et sécurité** : examiner le cycle de vie des abonnements, les lectures asynchrones, les réponses externes et le stockage local de session ; couvrir les cas limites par des tests.
4. **Validation** : vérification complète, export Android, bilan mesuré, commits séparés, publication de l'OTA preview.

## État initial

- Environ 280 fichiers sous `src`, `app`, `supabase/functions` et `scripts`.
- TypeScript strict et imports inutilisés déjà bloquants. La dernière vérification complète passe avec des avertissements React connus.
- Principales zones volumineuses : canevas de plans, mutations d'inventaire/factures, guide et assistants vocaux.
- Les traitements hors ligne utilisent des requêtes filtrées et une file sérialisée : ces garanties sont à préserver.
- Les règles de droits restent appliquées côté serveur. Aucun assouplissement de RLS ni redéploiement de fonction serveur prévu.

## Étape 1 — performances

- Recherche : normalisation et tri naturel déplacés dans un index mémorisé. Les recherches suivantes utilisent quatre groupes de pertinence en un passage, sans nouveau tri. Coût par saisie : O(n × termes × longueur de texte), contre ce même balayage accompagné d'une normalisation complète et d'un tri O(r log r).
- Les deux index serveur indépendants sont chargés simultanément ; fusion et priorité du déménagement inchangées.
- Retrait des objets facturés : Set d'identifiants, O(n + m) au lieu de O(n × m).
- Les sources d'images ne sont plus reconstruites à chaque rendu pour une URL inchangée.
- Comparaison automatique avec l'ancien classement conservé comme référence de test : accents, types d'entité, filtres croisés, noms identiques et requêtes vides.

## Étape 2 — modularité

- L'arborescence des rangements est isolée de React Query et du préchargement hors ligne. Les mutations n'importent plus le module complet de préchargement ; l'accès au cache est un adaptateur séparé.
- La géométrie des poignées et du zoom du plan est désormais pure et testable sans téléphone.
- Les murs et ouvertures sont calculés séparément des couleurs, textes et sélections. Une sélection ou un changement de thème ne relance plus directement tout le calcul des murs.
- Tests ajoutés : ancêtres manquants, cycles de rangements, ordre du chemin, pièces mono-espace, huit poignées, tailles limites, cadrage, murs mitoyens et portes.

## Étape 3 — robustesse, sécurité et nettoyage

- Abonnements réseau : les événements récents priment sur les lectures asynchrones anciennes ; les callbacks sont neutralisés après démontage et les abonnements partiels sont nettoyés. La règle `isConnected` et le repli « en ligne » sont conservés.
- Session : une lecture initiale tardive ne peut plus rétablir un compte déconnecté ou remplacer une nouvelle connexion. Une erreur de lecture libère le chargement. Les renouvellements sans réseau conservent la dernière session, et seul `SIGNED_OUT` déclenche la déconnexion explicite.
- Stockage natif : compteur AES aléatoire par écriture, clé toujours dans SecureStore, opérations sérialisées par clé. Lecture rétrocompatible des anciens enregistrements ; format v2 écrit au prochain renouvellement. Décodage UTF-8 standard pour préserver les emojis. Les données de session restent locales.
- Limite cryptographique conservée : AES-CTR ne fournit pas d'authentification du contenu. Cette correction supprime la réutilisation du compteur ; elle ne prétend pas protéger un appareil compromis. Un retour à un ancien binaire ne sachant lire que le format historique peut demander une reconnexion après migration.
- Scan de code-barres : validation des données tierces, URL d'image HTTP(S), délai maximal de dix secondes, annulation à la fermeture du formulaire et à un nouveau scan. Le repli vers la saisie manuelle reste identique.
- Taille du texte : un choix récent ne peut plus être écrasé par la lecture initiale des préférences ; les écritures suivent leur ordre.
- Plan : recherches de pièces et numéros des marqueurs par Map ; une mesure conservée par pièce au lieu d'accumuler chaque ancien libellé/taille de texte.
- Suppression de l'ancien `AssistantFab`, sans import ni appel restant (vérification des dépendances TypeScript et recherche textuelle). Le bouton actuel « Demande à Céoù » dans l'accueil est conservé.

## Étape 4 — dépendances et validation

- Audit npm des dépendances de production : 22 signalements au départ (dont 7 élevés), **0 après corrections** au 16 septembre 2026. Ce résultat est celui du registre npm, pas une garantie d'absence de toute vulnérabilité.
- Correctifs compatibles : `@xmldom/xmldom` 0.8.15 / 0.9.12 et `js-yaml` 4.3.2.
- Résolutions ciblées de l'outillage : Metro utilise `image-size` 2.0.3 ; Xcode utilise `uuid` 11.1.1. Tests de l'import effectif par Metro, des dimensions d'une image du projet et du format des identifiants Xcode.
- Expo Router : `decode-uri-component` 0.5.0 corrige le déni de service par entrée malformée ([avis de sécurité](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)). Le patch de `query-string` adapte son import CommonJS à l'export par défaut ESM. Tests des accents, emojis, paramètres répétés, signes `+`, et d'une longue séquence invalide. `postinstall` échoue désormais explicitement si un patch ne s'applique plus.
- Expo SDK et modules natifs inchangés. Les résolutions ciblées sont documentées pour pouvoir les retirer quand les dépendances parentes intègrent ces corrections.
- **87 tests**, TypeScript et lint passent. Les avertissements React connus passent de 30 à 28 ; seuil CI abaissé à 28, sans désactiver de règle supplémentaire.
- Comparaison reproductible : `node scripts/benchmark-search.mjs`, 10 000 objets synthétiques, cinq requêtes, dix répétitions après échauffement. Sur cette machine : préparation 28,03 ms ; médiane par recherche 182,20 ms avant / 0,44 ms après. Ce gain porte sur le calcul local de recherche, pas sur toute l'application ni sur un appareil Android.
- Aperçu local en 390 × 844 : fiche objet, hiérarchie du rangement, repérage dans le plan, recadrage, recherche exacte/partielle, filtre Salon puis remise à zéro. Aucune donnée réelle modifiée.

## Périmètre et suites raisonnables

Ce passage cible les coûts répétés et les défauts vérifiables. Les modules d'écriture d'inventaire/factures, la file hors ligne, le moteur vocal et les migrations métier ont été examinés mais ne sont pas réécrits en bloc. Leurs responsabilités et tests existants restent en place. Une réécriture totale de composants fonctionnels ou une migration native ne serait pas justifiée par les mesures de ce passage.

Les 28 avertissements restants concernent principalement la synchronisation d'état d'éditeurs/modales et l'analyse du compilateur React sur le canevas. Leur suppression nécessite des tests d'interaction Android ; aucun avertissement n'a été masqué pour présenter un résultat artificiellement propre.

## Limites de validation

Les tests locaux et l'export ne remplacent pas un essai Android pour les gestes des plans, le microphone, le mode avion et la reprise de session après fermeture. Aucun test ne modifie l'inventaire réel.
