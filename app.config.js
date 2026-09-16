const { execSync } = require('child_process');

// Identifiant précis de version affiché en bas de l'écran Profil — le
// numéro "1.0.0" seul ne bouge jamais assez souvent pour savoir quelle
// build/mise à jour OTA est réellement en train de tourner sur un
// appareil. EAS_BUILD_GIT_COMMIT_HASH est fourni automatiquement par les
// builds cloud EAS ; en local (dev-client via Metro, `eas update`), on le
// lit directement depuis git puisque le dépôt est disponible sur la
// machine qui bundle.
function resolveGitCommit() {
  if (process.env.EAS_BUILD_GIT_COMMIT_HASH) return process.env.EAS_BUILD_GIT_COMMIT_HASH.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

// UN SEUL TEXTE POUR NSCameraUsageDescription, ET C'EST VOULU.
//
// expo-camera et expo-image-picker ecrivent tous les deux cette cle. Le
// helper d'Expo resout en `valeur fournie || valeur deja posee || defaut`
// (config-plugins/ios/Permissions.js) : le premier plugin qui la pose gagne,
// et celui qui n'a rien recu se rabat sur son defaut ANGLAIS si personne ne
// l'a devance. S'en remettre a l'ordre du tableau marcherait aujourd'hui et
// casserait le jour ou quelqu'un le reordonne — d'ou la valeur passee
// explicitement aux deux, depuis une seule constante.
const CAMERA_PERMISSION =
  "Ceou a besoin de l'appareil photo pour scanner les codes-barres et photographier tes objets.";

// MEME PIEGE POUR LE MICRO, entre expo-speech-recognition (l'assistant
// simple) et react-native-audio-api (la conversation) : une seule constante,
// passee aux deux. Le texte parle de conversation, puisque c'est desormais
// l'usage principal du micro.
const MICROPHONE_PERMISSION = 'Ceou a besoin du microphone pour que tu puisses parler à son assistant vocal.';

module.exports = {
  expo: {
    name: 'Ceou',
    slug: 'ceou',
    version: '1.2.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    // 'automatic' et non 'light' depuis l'ajout du theme sombre : c'est ce
    // qui autorise l'app a suivre le reglage du telephone. Cote Android la
    // valeur n'a d'effet qu'avec expo-system-ui (exigence documentee), donc
    // seulement a partir du prochain build natif ; l'interrupteur du Profil,
    // lui, passe par Appearance.setColorScheme et fonctionne des l'OTA.
    userInterfaceStyle: 'automatic',
    scheme: 'ceou',
    ios: {
      // FAUX, ET C'EST UN CHOIX DE FICHE AUTANT QUE DE CODE.
      //
      // A `true`, Apple exige un jeu complet de captures d'ecran iPad dans la
      // fiche App Store — et refuse la soumission sans elles. Or rien n'a
      // jamais ete dessine ni verifie pour cette largeur : le plan 2D, les
      // feuilles du bas et les grilles sont regles pour un telephone. Une
      // fiche iPad promettrait un ecran qu'on n'a pas travaille.
      //
      // A `false`, l'app reste installable sur iPad, en mode compatibilite
      // iPhone. Rien n'est ferme : le jour ou la tablette est visee pour de
      // bon, on remet `true` ET on fait le travail de mise en page qui va
      // avec. Decide pour la premiere version, le 2026-09-10.
      supportsTablet: false,
      bundleIdentifier: 'com.aantony.ceou',
      infoPlist: {
        // DECLARATION D'EXPORT, ET CE N'EST PAS UNE FORMALITE VIDE.
        //
        // Sans cette cle, App Store Connect repose la question de conformite
        // a l'exportation a CHAQUE televersement de build, et le build reste
        // en attente tant qu'on n'a pas repondu.
        //
        // CE QUE L'APP CHIFFRE VRAIMENT, puisque la reponse en depend :
        //  - HTTPS vers Supabase et les API tierces — chiffrement standard
        //    fourni par le systeme, exempte sans discussion ;
        //  - le trousseau iOS via expo-secure-store — systeme, exempte ;
        //  - la session Supabase, chiffree en AES-256-CTR avec aes-js avant
        //    d'aller dans AsyncStorage (voir src/lib/supabase/secureStorage.ts,
        //    SecureStore plafonnant a 2048 octets). Celui-la n'est PAS
        //    fourni par le systeme, et c'est lui qui rend la question reelle.
        //
        // Declare exempte : AES est un algorithme publie et non un procede
        // maison, et il ne sert ici qu'a proteger le jeton d'authentification
        // de l'utilisateur sur son propre appareil — ce que le questionnaire
        // d'Apple couvre par l'exemption du chiffrement limite a
        // l'authentification. Choix pris par l'editeur le 2026-09-10.
        //
        // A REEXAMINER si l'app se met un jour a chiffrer le CONTENU des
        // utilisateurs, ou embarque un algorithme qui ne soit pas un standard
        // publie. La declaration ne suivrait plus.
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.aantony.ceou',
      // Identifiants Firebase de l'app Android — indispensables à FCM, donc
      // aux notifications push. Le fichier EST versionné : il part de toute
      // façon en clair dans chaque APK, il n'a rien d'un secret. La vraie
      // clé sensible (compte de service FCM V1) est déposée chez EAS et
      // n'existe nulle part dans ce dépôt.
      googleServicesFile: './google-services.json',
      adaptiveIcon: {
        backgroundColor: '#1591EA',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      // Google Mobile Ads 25.4 uses Kotlin 2.3 metadata; Expo's default 2.1 compiler cannot read it.
      ['expo-build-properties', { android: { kotlinVersion: '2.3.21' } }],
      ['react-native-google-mobile-ads', {
        androidAppId: 'ca-app-pub-6809656178417507~5535422302',
        // iOS is not commercially configured yet; use Google's sample app ID.
        iosAppId: 'ca-app-pub-3940256099942544~1458002511',
        delayAppMeasurementInit: true,
      }],
      'expo-router',
      'expo-image',
      'expo-secure-store',
      'expo-localization',
      // DECLARES POUR ANDROID, PAS POUR IOS. Depuis Android 11, une
      // application ne voit plus les autres : elle doit annoncer a l'avance
      // les intentions qu'elle compte lancer, dans un bloc <queries> du
      // manifeste. Sans ces deux plugins, `Sharing.isAvailableAsync()` et
      // `MailComposer.isAvailableAsync()` repondent faussement non — l'export
      // d'un dossier de factures se terminerait par « aucune application ne
      // peut recevoir ce fichier », sur un telephone qui en a cinq.
      //
      // Ils ne posent aucune permission ni aucun texte a traduire : ils ne
      // font qu'ouvrir la vue.
      'expo-sharing',
      'expo-mail-composer',
      [
        'expo-camera',
        {
          cameraPermission: CAMERA_PERMISSION,
        },
      ],
      [
        // DECLARE POUR LE TEXTE, PAS POUR LE MODULE : expo-image-picker
        // fonctionnait deja sans entree ici, mais son plugin posait alors ses
        // libelles par defaut, en anglais. Un ecran d'autorisation iOS en
        // anglais au milieu d'une app en francais, c'est ce qu'un
        // examinateur releve — et surtout ce que l'utilisateur lit au moment
        // precis ou on lui demande l'acces a ses photos.
        //
        // microphonePermission est laisse de cote VOLONTAIREMENT : le mettre
        // a false bloquerait android.permission.RECORD_AUDIO, dont
        // expo-speech-recognition a besoin pour l'assistant vocal. Le texte
        // francais du micro vient deja de ce plugin-la.
        'expo-image-picker',
        {
          photosPermission:
            'Ceou a besoin de tes photos pour illustrer un objet ou un rangement, et pour en reconnaître plusieurs sur une même photo.',
          cameraPermission: CAMERA_PERMISSION,
        },
      ],
      [
        'expo-notifications',
        {
          // Android n'utilise QUE le canal alpha de cette image : la forme
          // est repeinte en blanc par le système. D'où une silhouette (la
          // loupe seule, sans le mot « Céoù » illisible à 24 dp) et non
          // l'icône d'app, qui donnerait un carré blanc plein.
          icon: './assets/notification-icon.png',
          color: '#1591EA',
        },
      ],
      [
        'expo-splash-screen',
        {
          // Aplat bleu NU, volontairement : c'est exactement la première
          // image de l'animation (AnimatedSplash), qui démarre sur un fond
          // vide avant que la loupe n'entre. Le passage du splash système au
          // nôtre est donc invisible — y mettre le logo le ferait au
          // contraire sauter au moment de la bascule.
          //
          // L'image est une PNG 96x96 ENTIEREMENT TRANSPARENTE, et ce n'est
          // pas une coquetterie : omettre `image` produit un thème Android
          // qui référence quand même @drawable/splashscreen_logo, jamais
          // généré — le build échoue alors sur « resource not found ». Une
          // image invisible satisfait la référence sans rien afficher.
          image: './assets/splash-transparent.png',
          imageWidth: 96,
          backgroundColor: '#1591EA',
          dark: { image: './assets/splash-transparent.png', backgroundColor: '#1591EA' },
        },
      ],
      [
        'expo-speech-recognition',
        {
          microphonePermission: MICROPHONE_PERMISSION,
          speechRecognitionPermission: 'Ceou a besoin de la reconnaissance vocale pour rechercher un objet à la voix.',
        },
      ],
      [
        // LE MICRO ET LE HAUT-PARLEUR DE LA CONVERSATION TEMPS REEL (voir
        // src/features/assistant/live/audio.ts). Module natif : il n'arrive
        // qu'avec un build, jamais par OTA — l'app retombe sur l'assistant
        // simple tant qu'il manque.
        //
        // Tout ce qui sert a jouer de la musique en arriere-plan est coupe :
        // une conversation s'arrete quand l'app passe en arriere-plan, et un
        // service de premier plan ou un mode audio d'arriere-plan declares
        // sans usage sont exactement ce qu'un examinateur de store refuse.
        // FFmpeg aussi : on ne decode aucun fichier, seulement du PCM brut.
        'react-native-audio-api',
        {
          iosMicrophonePermission: MICROPHONE_PERMISSION,
          iosBackgroundMode: false,
          androidForegroundService: false,
          androidPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS'],
          disableFFmpeg: true,
        },
      ],
    ],
    extra: {
      billing: {
        mode: process.env.EXPO_PUBLIC_BILLING_MODE === 'live' ? 'live' : 'test',
        revenueCatKey: process.env.EXPO_PUBLIC_BILLING_MODE === 'live'
          ? (process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '')
          : 'test_kdAWkKfnPoHDUbxFHDPVuopebrZ',
      },
      router: {},
      eas: {
        projectId: 'e6e7590c-fe95-4ec3-93c4-5da5ee7e9b94',
      },
      gitCommit: resolveGitCommit(),
    },
    owner: 'm-ajestic',
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/e6e7590c-fe95-4ec3-93c4-5da5ee7e9b94',
    },
  },
};
