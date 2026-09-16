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

## Limites de validation

Les tests locaux et l'export ne remplacent pas un essai Android pour les gestes des plans, le microphone, le mode avion et la reprise de session après fermeture. Aucun test ne modifie l'inventaire réel.
