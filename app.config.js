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

module.exports = {
  expo: {
    name: 'Ceou',
    slug: 'ceou',
    version: '1.0.0',
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
      supportsTablet: true,
      bundleIdentifier: 'com.aantony.ceou',
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
      'expo-router',
      'expo-image',
      'expo-secure-store',
      'expo-localization',
      [
        'expo-camera',
        {
          cameraPermission: "Ceou a besoin de l'appareil photo pour scanner les codes-barres et photographier tes objets.",
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
          microphonePermission: 'Ceou a besoin du microphone pour rechercher un objet à la voix.',
          speechRecognitionPermission: 'Ceou a besoin de la reconnaissance vocale pour rechercher un objet à la voix.',
        },
      ],
    ],
    extra: {
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
