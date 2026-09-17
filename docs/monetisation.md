# Céoù Gratuit / Plus — intégration et mise en service

## État de cette livraison

Les SDK RevenueCat et AdMob sont intégrés dans le build Android 1.2.0. L'écran est accessible dans **Profil → Forfait et bonus IA**. La version web affiche les compteurs ; achats et publicités sont réservés à Android.

Le serveur reste en **observation** (`billing_settings.enforce=false`). Les annonces réelles sont désactivées (`ads_enabled=false`). L'inventaire existant reste accessible, même au-dessus des quotas. Aucun paiement réel n'est activé par cette livraison. Le build preview emploie RevenueCat Test Store et les annonces Google de démonstration. Seuls les comptes ajoutés par l'administrateur dans `billing_testers` reçoivent des droits Plus sandbox et des crédits publicitaires simulés.

| Forfait | Lieux possédés | Objets | Analyses photo/mois | Conversation/mois |
|---|---:|---:|---:|---:|
| Gratuit | 2 | 150 | 5 | 5 minutes |
| Plus | 10 | 3 000 | 50 | 30 minutes |

Valeurs approuvées pour les tests. Lieux et objets sont des plafonds de stock, pas des quotas renouvelés. Les objets sont imputés au propriétaire du lieu, y compris ceux ajoutés par un ami disposant du droit de modification. Les lieux reçus en partage ne consomment pas les quotas du destinataire. Un transfert vers un autre propriétaire vérifie également sa capacité. La consultation, les suppressions et les déplacements au sein du même inventaire restent disponibles après dépassement.

Les analyses et minutes se renouvellent au premier du mois UTC. Les publicités sont entièrement volontaires : **2 analyses par publicité, au maximum 5 publicités par jour UTC**. Les crédits expirent à la fin du mois et sont utilisés après l'allocation incluse. Une annonce interrompue ou indisponible ne donne pas de crédit. Les demandes publicitaires en cours réservent une place pendant une heure ; un échec libère cette place.

## Dernières opérations RevenueCat

1. Ouvrir le projet Céoù dans [RevenueCat](https://app.revenuecat.com/).
2. Dans Product catalog, conserver l'entitlement existant **`céoù_pro`** (accents compris). Son nom affiché peut devenir **Céoù Plus**. Vérifier parmi ses trois produits les abonnements mensuel et annuel du Test Store, puis les placer dans une offering marquée **Current**. Ne pas ajouter d'offre à vie : le serveur attend un abonnement avec une date d'expiration. Les tarifs affichés viennent de la boutique, sans prix codé dans l'app.
3. Dans les clés API du projet, créer une **clé secrète API v1** pour le serveur. Ne pas employer la clé publique `test_…` à cet endroit.
4. Ouvrir [les secrets des fonctions Supabase](https://supabase.com/dashboard/project/neessqtornvankriouwd/functions/secrets). `REVENUECAT_SECRET_KEY` a été ajouté ; sa présence est vérifiée, la connexion complète reste à valider avec un achat de test. `REVENUECAT_ENTITLEMENT=céoù_pro` est également configuré et vérifié pour correspondre à l'identifiant existant. Le nom `ceou_plus` reste uniquement la valeur de repli du code pour un serveur non configuré. Ne jamais mettre la clé secrète dans Git, EAS public ou le chat.
5. Pour la synchronisation automatique, créer un secret aléatoire distinct nommé `REVENUECAT_WEBHOOK_SECRET` dans Supabase. Dans RevenueCat → Integrations → Webhooks, utiliser l'URL ci-dessous et le header Authorization `Bearer <ce secret>`. Envoyer le test RevenueCat, puis vérifier une simulation d'achat, une restauration et une expiration.

Webhook : `https://neessqtornvankriouwd.supabase.co/functions/v1/revenuecat-webhook`

L'application consulte l'état du serveur avant de charger les offres. Tant que sa clé RevenueCat n'est pas configurée, elle affiche que la boutique est en préparation. Aucun résultat d'achat envoyé par le client ne suffit à attribuer Plus : le serveur interroge RevenueCat. Les notifications répétées ou retardées relisent l'état courant ; une synchronisation ancienne ne remplace pas une plus récente.

## Dernières opérations AdMob

- L'application Android et le bloc « Bonus IA » sont enregistrés dans la configuration native. Les options Séries d'annonces et Interactive restent celles choisies dans AdMob.
- Le bloc conserve **1 `credit_ia`** comme récompense AdMob : le serveur transforme ce crédit en **2 analyses**. Ne pas changer ce libellé sans adapter la validation serveur.
- Dans les paramètres avancés du bloc, activer la validation côté serveur (SSV) vers :

  `https://neessqtornvankriouwd.supabase.co/functions/v1/admob-reward`

- Créer et publier le message de consentement dans AdMob → Confidentialité et messages. L'app demande le consentement avec UMP avant d'initialiser les annonces et permet de revoir les choix depuis l'écran Forfait.
- Relier l'application à sa fiche Google Play lorsqu'elle sera disponible et terminer les demandes de validation/app-ads.txt affichées dans AdMob avant toute diffusion réelle.

La signature Google, l'identité, le bloc, la récompense, le challenge serveur et l'unicité de la transaction sont vérifiés. En production, le callback client n'attribue jamais de crédit. Une confirmation SSV tardive apparaît lors de l'actualisation de l'écran. L'endpoint de simulation ne fonctionne que pour un challenge de test appartenant à un compte explicitement autorisé côté serveur.

## Google Play puis passage commercial

Le paiement et la vérification du compte développeur ne créent pas les produits de Céoù. Il reste à créer l'app Android **`com.aantony.ceou`**, déposer un AAB sur une piste de test interne, créer l'abonnement avec ses offres mensuelle/annuelle et relier Google Play à RevenueCat. Importer ces produits, les associer à `céoù_pro` et à l'offering Current.

Définir ensuite `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` avec la **clé publique Google Play `goog_…`** et `EXPO_PUBLIC_BILLING_MODE=live` dans l'environnement EAS production. Le profil de build production précise également ce mode ; la variable d'environnement EAS est nécessaire pour les futures mises à jour OTA. La clé secrète reste exclusivement dans Supabase.

Avant d'activer la vente : valider les prix dans Play, l'achat sandbox Play, la restauration sur un autre appareil, les annulations/expirations, les transferts de compte et le consentement publicitaire sur Android. Compléter les déclarations Play (achats, annonces, données collectées) et publier la politique de confidentialité mise à jour. La suppression du compte Céoù ne résilie pas un abonnement Play : il doit être géré dans Play.

**Limite actuelle du compteur vocal :** la réservation et les plafonds sont vérifiés côté serveur, mais la restitution des secondes inutilisées repose encore sur la durée annoncée par le client existant. Ce compteur convient aux essais ; il faut une mesure fiable côté fournisseur ou un relais vocal contrôlé avant de traiter ces minutes comme une protection de facturation contre un client modifié. Le plafond journalier existant de 10 minutes reste également en place. L'assistant simple de secours conserve ses protections actuelles et n'est pas compris dans les minutes Gemini Live.

La bascule de `enforce` et `ads_enabled` est une opération d'administration séparée, à faire après ces validations. Ne jamais déduire des droits Plus d'un booléen local. Ne pas activer les annonces réelles dans le profil preview.

## Vérifications à réaliser sur le téléphone

1. Installer le nouveau build 1.2.0 : l'ancienne application 1.1.0 ne contient pas les modules natifs nécessaires.
2. Ouvrir Profil → Forfait et bonus IA. Vérifier les quantités, le thème clair/sombre et la taille du texte. Le bandeau d'observation doit être présent.
3. Avec le compte de test autorisé, regarder une annonce de démonstration jusqu'à la récompense : +2 analyses. La fermer avant la récompense : aucun crédit. Vérifier l'absence de double crédit et le maximum de cinq annonces.
4. Après configuration RevenueCat, simuler un achat, restaurer, puis contrôler le forfait et l'expiration. Aucune carte bancaire ne doit être demandée par le Test Store.
5. Se déconnecter puis utiliser un autre compte : ses compteurs et droits doivent être distincts.
6. Les annonces peuvent être indisponibles si le formulaire UMP AdMob n'est pas encore publié : terminer cette configuration puis réessayer, sans désactiver le consentement.

## Maintenance

- La compilation Android utilise Kotlin 2.3.20 via `expo-build-properties`, nécessaire pour lire les métadonnées Kotlin 2.3 de Google Mobile Ads 25.4. Cette version dispose également de l'artefact Pika 0.3.2 requis par Expo 57 (contrairement à Kotlin 2.3.21). Le plugin local `withAndroidKotlinCompiler` aligne aussi le compilateur Gradle, en contournement du [problème Expo 57 nº 49668](https://github.com/expo/expo/issues/49668). Toute modification de ce réglage exige un nouveau build natif.
- Migration `20260917120000_billing.sql` : règles, compteurs, réservations et protections d'accès.
- Fonctions `billing-sync`, `revenuecat-webhook`, `billing-ad`, `admob-reward`, `detect-objects`.
- Les fonctions publiques de callback vérifient leur signature fournisseur ; les endpoints applicatifs vérifient l'utilisateur avec `auth.getUser`.
- Les tables de facturation n'ont aucune écriture client. `billing_snapshot()` ne renvoie que les compteurs de l'appelant.
- Les tests PostgreSQL exécutent les vraies fonctions SQL et couvrent accès, quotas, transferts, remboursement, répétition et expiration des crédits. Le vérificateur SSV est testé avec des signatures ECDSA réelles et des callbacks altérés.
- `npm run verify:ci` et `npx deno check supabase/functions/{...}/index.ts` vérifient respectivement l'app et les fonctions serveur.
- Les données de consommation sont supprimées en cascade avec le compte Supabase. Prévoir la suppression des données de client chez RevenueCat dans le traitement des demandes de suppression ; les transactions et leur conservation réglementaire relèvent aussi des boutiques.

Références : [Expo 57](https://docs.expo.dev/versions/v57.0.0/), [RevenueCat avec Expo](https://www.revenuecat.com/docs/getting-started/installation/expo), [Test Store](https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store), [consentement AdMob](https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent), [vérification SSV Google](https://developers.google.com/admob/android/ssv).
