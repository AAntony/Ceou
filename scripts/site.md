# Le site public de Céoù

Six pages, une image et quatre fichiers de configuration, générés dans `site/`.
**Ne rien y modifier à la main** — le dossier est réécrit à chaque exécution
du générateur.

| Fichier | Contenu | Ancre |
| --- | --- | --- |
| `index.html` | Accueil, français | |
| `en.html` | Accueil, anglais | |
| `tutoriels.html` | Tutoriels de l'app, français | `#<id du chapitre>` |
| `tutorials.html` | Tutoriels de l'app, anglais | `#<id du chapitre>` |
| `confidentialite.html` | Politique de confidentialité, français | `#suppression-de-compte` |
| `privacy.html` | Politique de confidentialité, anglais | `#account-deletion` |
| `og-image.png` | Vignette de partage et icône de raccourci | |
| `.htaccess` | Redirection de HTTP vers HTTPS (Apache, donc OVH) | |
| `app-ads.txt` | Vendeur Google AdMob autorisé, avec le compte éditeur actuel | |
| `robots.txt` | Autorise l’exploration et indique le sitemap | |
| `sitemap.xml` | Liste les six adresses canoniques | |

Ce document vit ici et non dans `site/` : ce dossier part en ligne tel quel, et
tout ce qu'il contient devient public. Une note de développement n'a rien à
faire sur le domaine d'une politique de confidentialité.

```bash
npm run site
```

## Où vit quoi

Le générateur assemble ; la matière est à côté.

| Fichier | Rôle |
| --- | --- |
| `scripts/build-site.mjs` | Assemble les six pages et les écrit |
| `scripts/site/tutorials.mjs` | Lit les tutoriels dans l'app et vérifie qu'ils sont complets |
| `scripts/site/demos.mjs` | Les mini-écrans des tutoriels, redessinés en HTML |
| `scripts/site/content.mjs` | **Tout le texte**, français et anglais côte à côte |
| `scripts/site/style.mjs` | La feuille de style, écrite dans chaque page |
| `scripts/site/icons.mjs` | Les dessins : logo, favicon, icônes, plan miniature |
| `scripts/site/layout.mjs` | En-tête HTML, navigation, pied de page, script |
| `scripts/site/appColors.mjs` | Les couleurs de pièce, traduites pour le thème sombre |

**Le texte de la politique** ne vit dans aucun de ces fichiers : il est dans
`src/features/legal/privacyPolicy.json`, lu **à la fois** par l'écran de l'app
(`app/privacy-policy.tsx`) et par le générateur. C'est le seul endroit à
modifier, et c'est ce qui empêche l'app et la page publique de se contredire.
Le sommaire de la page se construit tout seul à partir de ses sections.

**Les tutoriels** suivent la même règle : leur texte vient de `fr.json` et
`en.json` (bloc `tutoriels`), leur ordre de `src/features/tutoriels/chapitres.ts`.
Corriger une étape dans l'app la corrige sur le site au prochain `npm run site`
— à redéployer, comme le reste. Seuls les mini-écrans sont redessinés, dans
`demos.mjs`, avec les mêmes mots. **Un chapitre ou un mini-écran ajouté dans
l'app arrête la génération** tant qu'il n'a pas son icône de sommaire
(`tutorials.mjs`) et son dessin (`demos.mjs`) : le message dit quoi ajouter. Une
page qui annoncerait dix chapitres et en montrerait neuf ne se verrait pas.

**Le texte de l'accueil** vit dans `content.mjs` : il n'appartient qu'au site,
l'app n'en connaît pas un mot.

**La frise « Où en est Céoù »** et l'adresse du questionnaire y vivent aussi
(`progress` et `SURVEY`). La frise ne se met pas à jour toute seule : quand
une étape avance, changer son `status` dans les deux langues, réengendrer et
redéployer. Le bandeau d'annonce, en haut de toutes les pages, pointe vers les
deux.

Après toute modification, réengendrer **et redéployer**. Sans ça la version
publique reste en arrière de celle de l'app — et l'écart entre les deux est
exactement ce qu'un examinateur de store relève.

## Relire avant de déposer

```bash
npm run site:serve
```

Puis <http://localhost:4321>. Ouvrir `site/index.html` directement ne suffit
pas : en `file:`, le défilement de la fenêtre et les observateurs de visibilité
ne se comportent pas comme sur un vrai serveur, et on validerait la page dans
des conditions qui n'existent nulle part.

Ce qui mérite un coup d'oeil à chaque fois :

- **Le texte doublé.** `document.documentElement.style.fontSize = '32px'` dans
  la console, sur une fenêtre étroite. Rien ne doit déborder de côté ni se
  tronquer. C'est là que les défauts de grille apparaissent.
- **Les deux thèmes.** Le site suit le réglage du système.
- **Le menu replié**, sous 72 rem : il s'ouvre, se referme à Échap et au clic
  sur un lien.

## Ce qui ne doit rien coûter à personne

Le dossier n'appelle **rien de distant** : ni police, ni feuille de style, ni
script, ni image hébergée ailleurs. Trois raisons — le site s'affiche partout,
y compris là où les requêtes vers un tiers sont bloquées ; il ne peut pas
casser parce que quelqu'un a bougé un fichier ailleurs ; et il n'apprend rien
à personne sur qui le consulte, ce qui serait malvenu sur un site dont une
page promet justement de ne pas faire ça.

Le questionnaire, hébergé chez Google Forms, ne fait pas exception : c'est un
**lien**, pas une ressource. Rien ne part vers Google avant le clic, et la
note sous le bouton dit où il mène.

Le JavaScript de la page ne fait que du confort : menu repliable, apparitions
au défilement, lien de menu souligné pour la section qu'on lit. **Rien de ce
qu'il fait n'est nécessaire pour lire la page.** Bloqué, la page s'affiche
entière du premier coup.

## Déployer

### Mise à jour du 17 septembre 2026

L’accueil présente les fonctionnalités actuelles et les limites Gratuit/Plus
validées pour les tests, sans tarif commercial inventé. Les pages de confidentialité
FR/EN identifient **Antony Monreal** comme responsable et détaillent AdMob,
RevenueCat, Gemini, les compteurs et les demandes de suppression.
La suppression d’un compte ne résilie pas un abonnement Google Play.

Le texte commun de l’application a aussi été actualisé. Une future mise à jour
de l’application doit embarquer ce JSON pour que la version installée soit identique
au site ; reconstruire le site seul ne met pas à jour les téléphones.

Générer les fichiers ou les pousser sur GitHub **ne publie pas le domaine OVH**.
Téléverser les onze fichiers de `site/` dans `www`, y compris `.htaccess`,
en remplaçant leurs anciennes versions. Aucun identifiant FTP n’est enregistré
dans ces sources.

Avant de renseigner AdMob, ouvrir la page publique sans connexion et vérifier
la date **17 septembre 2026**, le nom de l’éditeur et la rubrique
**Publicités à la demande** :

- Politique à coller dans AdMob : `https://ceou.eu/confidentialite.html`
- Variante anglaise : `https://ceou.eu/privacy.html`
- Suppression Google Play : `https://ceou.eu/confidentialite.html#suppression-de-compte`
- Vendeur publicitaire : `https://ceou.eu/app-ads.txt`

Le fichier publicitaire contient le compte `pub-9364843473034868`, fourni le
17 septembre. Il ne remplace pas le formulaire de consentement AdMob.
Associer `https://ceou.eu` comme site du développeur dans la fiche Google Play
permettra à AdMob de le trouver lorsque la fiche sera disponible.

Références utilisées pour la mise à jour :

- [Information des personnes — CNIL](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence)
- [Données du SDK Google Mobile Ads](https://developers.google.com/admob/android/privacy/play-data-disclosure)
- [Conditions Gemini API](https://ai.google.dev/gemini-api/terms)
- [Confidentialité RevenueCat](https://www.revenuecat.com/privacy)
- [Configuration app-ads.txt](https://support.google.com/admob/answer/9363762?hl=fr)

### OVH (l'hébergement inclus avec le domaine)

Par FTP, avec WinSCP :

| Champ | Valeur |
| --- | --- |
| Protocole | FTP |
| Chiffrement | **TLS/SSL explicite** — sans quoi le mot de passe passe en clair |
| Hôte | `ftp.clusterXXX.hosting.ovh.net` (espace client OVH → onglet FTP - SSH) |
| Port | 21 |

Déposer le **contenu** de `site/` à la racine de `www`, pas le dossier
lui-même : `index.html` doit répondre à `https://ceou.eu/`.

**WinSCP masque les fichiers commençant par un point.** `.htaccess` en fait
partie, et sans lui `http://ceou.eu` continue de répondre en clair. Pour le
voir : Options → Préférences → Panneaux → cocher « Afficher les fichiers
cachés » (ou Ctrl+Alt+H).

La redirection se vérifie en une commande — 301 attendu, pas 200 :

```bash
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}" http://ceou.eu/
```

Si elle répond toujours 200, c'est qu'OVH ne transmet pas le protocole
d'origine dans l'en-tête attendu : remplacer `=http` par `!=https` dans la
règle du générateur. La forme positive est le choix par défaut parce qu'un
en-tête absent y coûte la redirection, là où la forme négative coûterait le
site — la page se redirigerait vers elle-même sans fin.

### EAS Hosting (le miroir, `ceou.expo.app`)

```bash
npx eas-cli@latest deploy --export-dir site --prod
```

## Ce que chaque store attend

| Store | Champ | Adresse |
| --- | --- | --- |
| App Store Connect | Privacy Policy URL | `https://ceou.eu/confidentialite.html` |
| Google Play | Politique de confidentialité | `https://ceou.eu/confidentialite.html` |
| Google Play | Suppression de compte (URL web) | `https://ceou.eu/confidentialite.html#suppression-de-compte` |

Google Play demande les deux séparément : la politique, **et** une adresse où
quelqu'un qui n'a pas — ou n'a plus — l'app installée peut demander la
suppression de son compte.

**Les noms de fichiers et les ancres ne doivent plus changer** une fois la
première fiche déposée : une adresse déposée dans un store est recopiée
ailleurs, et on ne peut jamais la corriger partout.

## À ne pas confondre

`docs/` est l'**autre** page publique du projet — atterrissage des e-mails
Supabase et ouverture des invitations, servie par GitHub Pages sur
`aantony.github.io/Ceou/`. Cette adresse est encodée dans les QR d'invitation
déjà partagés : elle ne doit pas bouger.
