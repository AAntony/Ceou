# Assistant vocal — la conversation temps réel

## Correctifs du 15 septembre 2026

### Clôture de conversation

Les formules de fin (« merci », « ça sera tout », « au revoir », et leurs
équivalents) déclenchent un bref au revoir et l'outil de fermeture. Une phrase
qui contient encore une demande doit être traitée avant de fermer.
L'application ferme aussi après 20 secondes d'attente sans activité vocale,
hors connexion, génération et lecture. L'activité est mesurée sur les trames
micro autorisées (seuil RMS 0,015) et actualisée par la transcription. Un bruit
ambiant dépassant ce seuil peut retarder la fermeture ; ce n'est pas un VAD
natif spécialisé. Le contrôle s'effectue au tick d'une seconde.

### Protection après essai sur téléphone

L'essai utilisateur a confirmé une auto-interruption en boucle : le traitement
audio natif actuel ne suffit pas à supprimer l'écho. Le mode de secours est
donc **half duplex** : pendant toute la réponse (y compris les creux entre
morceaux), puis 400 ms après sa lecture, les trames micro envoyées sont
remplacées par du silence. « Reprendre la parole » coupe la lecture et rend
le micro à l'utilisateur après ce délai acoustique. Cela ne constitue pas
une annulation d'écho ni une interruption naturelle à la voix.

La capture démarre désormais dès l'ouverture autorisée, en parallèle de la
connexion. La première phrase est conservée en mémoire uniquement, au maximum
15 secondes, puis transmise dans l'ordre après le handshake. Une annulation
efface cette mémoire. Le statut distingue écoute locale et connexion prête :
la réponse du service ne peut pas être instantanée sur tout réseau.

Les descriptions full duplex ci-dessous concernent l'architecture initiale ;
elles sont remplacées par cette protection tant que la chaîne native d'écho
n'est pas validée sur appareil.

- Silence identifié : dans react-native-audio-api 0.13.3, `start()` utilise
  un offset par défaut de -1 que sa validation rejette. Le lecteur appelle
  désormais `start(0, 0)` et réactive explicitement le contexte audio.
- La lecture suit chaque buffer sans effacer les nouveaux morceaux lorsqu'un
  ancien événement « dernier buffer » arrive tard. Les décodages interrompus
  ne repartent pas après fermeture. Les erreurs de lecture sont journalisées
  et proposent l'assistant simple au lieu de laisser une interface muette.
- La connexion attend au maximum 15 secondes le setup WebSocket. Les doubles
  ouvertures et fermetures pendant le démarrage sont protégées.
- Les événements Gemini contenant outils, audio et transcription ensemble
  sont traités intégralement. L'audio d'un tour interrompu est écarté.
- Un simple merci ne raccroche plus. La fin attend la fin du tour et de la
  lecture, avec le délai de secours existant. La détection de parole utilise
  une sensibilité basse et 700 ms de silence pour tolérer les pauses.
- Les instructions imposent la langue de l'application, sans traduction,
  et demandent de reformuler si la voix est indistincte. Cela ne garantit
  pas la langue de la transcription automatique de Gemini.
- Les tests audio utilisent la méthode `start` de la bibliothèque installée
  et un moteur natif simulé. Ils ne valident pas l'annulation d'écho réelle.

Le module et son patch natif nécessitent le build 1.1.0. Ces correctifs JS
peuvent ensuite être distribués par OTA pour ce runtime. Aucun téléphone
n'était connecté pendant la vérification : haut-parleur, casque, Bluetooth
et interruptions à voix haute restent à valider sur appareil.

L'assistant vocal tient désormais une vraie conversation avec **Gemini Live** :
il entend, comprend, cherche et range dans l'inventaire par ses outils, et répond
avec sa propre voix. L'assistant d'avant reste en place et prend le relais quand
la conversation n'est pas disponible.

**Ce qu'on vit** : on ouvre, on parle, on lui coupe la parole en parlant. Un seul
bouton, « Terminer ». Ni minuteur ni durée par conversation : seul le plafond du
jour (10 minutes) compte, sans être affiché. Quand il s'épuise en pleine
conversation, Céoù l'annonce avec sa voix et l'assistant simple prend la suite.

## Comment ça marche

```
Téléphone ──(1) start──▶ fonction voice-session ──▶ accord ? plafond ? ──▶ jeton Gemini verrouillé
Téléphone ◀══(2) WebSocket audio══▶ Gemini Live
            (3) outils exécutés DANS l'app, sur l'index filtré par la RLS
Téléphone ──(4) end──▶ voice-session : rend la durée non utilisée
```

| Fichier | Rôle |
| --- | --- |
| `supabase/functions/voice-session` | Vérifie l'accord et le plafond, délivre le jeton éphémère (modèle, voix, consignes et outils verrouillés), solde la session |
| `supabase/migrations/20260914120000_voice_live.sql` | Accord `ai_voice_live_consent_at`, table des sessions, réservation et solde |
| `src/features/assistant/live/audio.ts` | Micro en PCM 16 kHz, lecture de la voix en 24 kHz (`react-native-audio-api`) |
| `src/features/assistant/live/connection.ts` | Le protocole WebSocket de Gemini Live |
| `src/features/assistant/live/tools.ts` | Les outils : chercher, lister un lieu, ranger, annuler, prêts, terminer |
| `src/features/assistant/live/useLiveAssistant.ts` | La conversation : micro, voix, transcriptions, outils, fin du plafond |
| `src/features/assistant/live/LiveAssistantSheet.tsx` | La feuille : pastille animée, transcription, bouton « Terminer » |
| `patches/react-native-audio-api+0.13.3.patch` | Micro Android en mode « communication vocale » : l'annulation d'écho |

**Ce que Gemini reçoit** : la voix, et le résultat de chaque outil — des noms
d'objets, de pièces, de rangements, des chemins, l'état d'un prêt, et des
références de session (`r3`). Jamais l'inventaire entier, jamais un identifiant
de base. Ranger ne devine jamais : plusieurs candidats, ou un seul mal reconnu,
et l'outil répond `ambiguous` — c'est l'utilisateur qui tranche à voix haute.

**Le repli sur l'assistant simple** se fait sur un build sans le module audio,
pour un invité, en cas de plafond atteint ou de service indisponible. À
l'ouverture, les deux derniers cas le proposent d'abord dans une boîte de
dialogue ; en pleine conversation, il démarre de lui-même après l'annonce.

**L'interruption à la voix** repose sur l'annulation d'écho du téléphone : le
micro reste ouvert pendant que Céoù parle, le serveur entend qu'on parle
par-dessus et abandonne sa réponse. `react-native-audio-api` 0.13.3 ouvre le
micro Android en mode « reconnaissance vocale », sans annulation d'écho, et sur
le chemin basse latence qui contourne les traitements du système. Le patch
reprend les deux lignes de la version 1.0 à venir de la bibliothèque (mode
« communication vocale », performance `None`). `patch-package` le réapplique à
chaque `npm install`, EAS compris. **À retirer en passant à la 1.0**, en
utilisant son option `androidInputPreset: 'voiceCommunication'`.

**La fin du plafond** : une conversation réserve tout ce qui reste du jour. À
15 secondes de la fin, l'app envoie `[daily_time_up]` en texte dès que Céoù ne
parle plus ; les consignes lui font dire que le temps est écoulé, puis appeler
`end_conversation`. S'il ne raccroche pas, l'app coupe 20 secondes après la fin
(le jeton garde une minute de marge).

**La durée utilisée est notée sur le téléphone** toutes les 10 secondes. Si la
conversation n'a pas pu rendre compte (app tuée, réseau perdu en raccrochant),
la note part avec l'ouverture suivante, qui la solde avant de calculer le reste
du jour. Sans elle, un plantage retiendrait tout le plafond du jour.

## Mise en service

1. Appliquer la migration, puis régénérer les types (les colonnes du profil ont
   été ajoutées à la main en attendant ; la table des sessions n'y est pas) :

   ```bash
   npx supabase db push
   ```

2. Déployer la fonction. `GEMINI_API_KEY` est déjà dans les secrets du projet :

   ```bash
   npx supabase functions deploy voice-session
   ```

3. Faire un **build natif local** : `react-native-audio-api` et son patch ne
   peuvent pas arriver par OTA. Monter `version` à `1.1.0` dans
   `app.config.js` au moment du build, pas avant (voir la mémoire sur les OTA).

## Réglages sans mise à jour de l'app

```bash
npx supabase secrets set VOICE_LIVE_DAILY_SECONDS=600
```

| Secret | Défaut | Rôle |
| --- | --- | --- |
| `VOICE_LIVE_DAILY_SECONDS` | 600 (10 min) | Plafond par compte, par jour UTC — et donc durée maximale d'une conversation |
| `VOICE_LIVE_MODEL` | `gemini-3.1-flash-live-preview` | Modèle |
| `VOICE_LIVE_VOICE` | `Aoede` | Voix (Puck, Charon, Kore, Fenrir, Aoede…) |

`VOICE_LIVE_SESSION_SECONDS` n'existe plus : s'il a été posé, il est ignoré.

Ordre de grandeur relevé en septembre 2026 : environ 0,005 $ la minute d'écoute
et 0,018 $ la minute de parole sur l'offre payante.

## Limites connues

- **L'annulation d'écho dépend du téléphone.** Si Céoù se coupe tout seul ou se
  répond à lui-même, c'est qu'elle laisse passer sa voix : il faudra une
  bibliothèque audio qui embarque la sienne (WebRTC). Chantier à présenter
  avant de le commencer.
- iOS n'a pas été construit : `voiceChat` y active le traitement de voix du
  système, sans essai réel.
- Gemini limite une connexion à une dizaine de minutes : avec un plafond de
  10 minutes, la limite ne se voit pas. Monter le plafond demandera la reprise
  de session (`sessionResumption`).
- Le jeton verrouille toute la configuration ; le message d'ouverture ne rappelle
  que le modèle.
- L'index de recherche ne couvre que les logements favoris, comme la recherche.

## À tester sur téléphone

1. Premier appui : l'accord « Parler avec Céoù », puis la conversation s'ouvre.
2. « Où sont mes clés ? » — réponse vocale et carte cliquable.
3. « J'ai rangé la perceuse dans l'établi » — rangement, carte « ✓ ».
4. Une destination ambiguë — Céoù demande laquelle, on répond à voix haute.
5. « Annule » juste après un rangement.
6. « Qu'est-ce que j'ai prêté ? » et « Qu'y a-t-il dans le garage ? ».
7. « Merci, c'est tout » — au revoir puis fermeture.
8. **Couper la parole** : pendant une longue réponse, parler par-dessus — Céoù
   s'arrête et répond à la nouvelle phrase.
9. **Écho** : volume haut, laisser Céoù parler sans rien dire — il va au bout de
   sa phrase sans se couper ni se répondre.
10. Passer l'app en arrière-plan : la conversation se ferme.
11. **Fin du plafond** : `VOICE_LIVE_DAILY_SECONDS=60`, parler une minute — Céoù
    annonce la fin, puis l'assistant simple s'ouvre. Remettre 600 ensuite.
