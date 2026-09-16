# Céoù — tableau de bord financier local

## Accès et stockage

Depuis la racine du projet : `npm run finance`, puis ouvrir **http://127.0.0.1:8094/**.
Ce tableau est distinct de l'application Expo et du site public. Aucune OTA n'est nécessaire.
Le serveur écoute uniquement sur `127.0.0.1`, avec liste blanche de fichiers et contrôle du Host.
Les imports sont traités dans le navigateur ; aucun endpoint ne reçoit de données.

Les données sont conservées dans `localStorage`, clé `ceou-finance-v1`, sur cette origine exacte.
Utiliser toujours la même adresse et le même navigateur. Elles ne sont ni synchronisées, ni
chiffrées par cet outil, ni enregistrées dans Git. Sauvegarder en JSON via le bouton en haut,
puis restaurer depuis « Où trouver mes exports ? » si nécessaire. Ne pas versionner les sauvegardes.
Un stockage indisponible affiche un avertissement ; les modifications restent en mémoire et exportables.

## Ce qui fonctionne

- Dépenses mensuelles par catégorie, fixes et variables, coût global par actif renseigné, historique.
- Saisie manuelle, import du CSV normalisé Céoù, validation atomique et dédoublonnage par référence.
- Montants hors taxes après crédits, avoirs négatifs, EUR/USD/GBP avec taux explicitement saisi.
- Usages mensuels saisis : actifs, abonnés actifs, minutes vocales déclarées, analyses photo.
- Simulateur : mix abonnement mensuel/annuel, conversion, TVA, commission, charges fixes et coûts
  variables par gratuit/abonné. Sensibilité à 2/5/10 %, seuil d'équilibre, recette annuelle mensualisée.
- Sauvegarde/restauration JSON validée, guide d'exports et requête SQL vocale en lecture seule.

## Limites explicites

Ce n'est pas une connexion automatique aux fournisseurs, un outil comptable ou une mesure par compte.
Les coûts manquants restent inconnus, jamais zéro. Les totaux sont partiels jusqu'au rapprochement
manuel avec les factures. Les PDF et CSV bruts des fournisseurs ne sont pas analysés automatiquement :
reporter leurs postes dans le formulaire ou le modèle. Le CSV vocal est un justificatif d'usage, pas
un CSV de dépenses à importer dans le journal.

Les factures seules ne permettent pas de distinguer gratuit/abonné, P95 ou coût par conversation.
Cette attribution exigera une instrumentation dédiée reliée aux consommations des fournisseurs.
Les limites vocales actuelles sont des compteurs de quota, pas des preuves de facturation.
Les erreurs, tentatives échouées et sessions non soldées peuvent contribuer à des écarts.
Il n'y a pas d'alerte de dépassement envoyée en arrière-plan. Régler les budgets chez les fournisseurs.

## Exports à demander (dernier mois complet + période en cours, séparément)

1. **Google Cloud / Gemini** : Facturation → compte → Tableau des coûts (Cost table).
   Choisir période et projet Céoù ; télécharger le CSV détaillé. Conserver projet, service,
   SKU, coût, crédits/remises, devise, période. Ajouter le PDF/relevé récapitulatif pour rapprochement,
   sans le compter une deuxième fois. Les recharges d'un compte prépayé ne sont pas la consommation.
   AI Studio → Dashboard → Usage : relever les métriques par modèle disponibles, avec dates et unité ;
   si aucun export n'est disponible, noter les valeurs. Ne pas confondre facture mensuelle et période
   calendaire de consommation, ni coûts du projet et coûts de tout le compte Google Cloud.
2. **Supabase** : organisation → Billing → factures : PDF du dernier cycle et relevé de facture à venir.
   Organisation → Usage : MAU, stockage, transferts, fonctions Edge et dates exactes du cycle.
   Répartir une facture regroupant plusieurs projets ; documenter la règle de répartition des forfaits.
   Le MAU Supabase est une activité authentifiée facturée, pas une métrique exacte d'engagement produit.
3. **Sessions vocales** : Supabase → projet → SQL Editor, exécuter `voice-usage.sql`, dates ajustables,
   puis export CSV des résultats. Aucun identifiant personnel n'est exporté. Les réservations non
   soldées restent séparées des secondes déclarées ; ne jamais les additionner comme usage réel.
4. **Autres** : factures EAS/Expo si payant, domaine, hébergement, outils dédiés. Mensualiser les frais
   annuels. Plus tard, relevés des magasins : ventes, frais, taxes, remboursements, devise et période.

Sources officielles consultées le 16 septembre 2026 :
- https://docs.cloud.google.com/billing/docs/how-to/cost-table
- https://ai.google.dev/gemini-api/docs/billing?hl=fr
- https://supabase.com/docs/guides/platform/your-monthly-invoice
- https://supabase.com/docs/guides/troubleshooting/understanding-the-usage-summary-on-the-dashboard-D7Gnle

## Format d'import

En-tête exact (ordre des colonnes libre), UTF-8, virgule ou point-virgule :

```csv
id;month;provider;category;kind;amount;currency;eur_rate;note
```

- `id` : unique et stable, par exemple fournisseur-numero-facture-ligne-mois.
- `month` : AAAA-MM, mois d'affectation choisi, même base que les autres saisies.
- `provider` : nom lisible.
- `category` : voice / photo / ai / hosting / storage / network / tools / other.
- `kind` : fixed / variable. Une dépense ne compte qu'une fois, dans une seule nature.
- `amount` : HT après remises, négatif pour un avoir. Pas de total ajouté en plus des détails.
- `currency` : EUR / USD / GBP.
- `eur_rate` : euros pour une unité de devise ; exactement 1 pour EUR. Documenter le taux employé.
- `note` : référence au relevé, période, estimation d'affectation éventuelle.

Une référence identique avec les mêmes valeurs est ignorée. Un conflit annule tout l'import.
Deux références différentes peuvent malgré tout représenter un même coût : vérifier avant import.
Pour corriger une ligne, la retirer puis la saisir/importer à nouveau.

## Calculs du simulateur

Les valeurs préremplies sont des hypothèses, pas des tarifs fournisseurs vérifiés.
Les trois coûts restent vides initialement et doivent être renseignés pour obtenir une projection.

```text
R = ((1 - part_annuelle) × prix_mensuel + part_annuelle × prix_annuel / 12)
    / (1 + taux_TVA) × (1 - taux_commission)
P = utilisateurs_actifs × conversion
G = utilisateurs_actifs - P
solde = P × R - charges_fixes - G × coût_gratuit - P × coût_abonné
conversion_équilibre = (charges_fixes / utilisateurs_actifs + coût_gratuit)
                      / (R - coût_abonné + coût_gratuit)
```

Le seuil est signalé inatteignable si le dénominateur est non positif ou si plus de 100 %
de conversion sont nécessaires. Les effectifs projetés sont des moyennes, pas arrondis au calcul.
Les charges fixes sont constantes : cette simulation ne modélise pas les paliers d'infrastructure.
Les dépenses non saisies, l'acquisition, les remboursements, la rémunération et les impôts ne sont pas
déduits implicitement. Le solde ne doit pas être présenté comme un bénéfice net.

## Validation

`npm run test:finance` : huit tests de CSV, données invalides, conflits atomiques, avoirs/devises,
usages manquants, calcul financier, équilibre et restauration. Inclus dans `npm test`.
Aucune dépendance supplémentaire, aucun changement au schéma Supabase ni au client mobile.
