/*
 * Prépare le projet natif `android/` pour un build LOCAL, après `expo prebuild`.
 *
 * POURQUOI CE SCRIPT : un APK construit à la main sort différent de celui
 * d'EAS sur deux points invisibles jusqu'à ce qu'ils fassent mal.
 *
 *   1. LA SIGNATURE. Le gabarit d'Expo signe la variante `release` avec la
 *      clé de DEBUG. Android refuse d'installer par-dessus une application
 *      signée autrement : il faudrait désinstaller, donc se reconnecter, et
 *      repasser ensuite à un build EAS imposerait de désinstaller à nouveau.
 *      On rebranche donc la vraie clé, celle qu'EAS conserve.
 *
 *   2. LE CANAL DE MISE À JOUR. C'est EAS Build qui inscrit `channel` dans le
 *      manifeste, d'après eas.json. Un prebuild local ne le fait pas : l'APK
 *      connaît l'URL des mises à jour mais aucun canal, et ne recevrait donc
 *      jamais d'OTA — figé sur son bundle jusqu'au prochain APK.
 *
 * Tout est écrit dans `android/`, qui est ignoré par git ET regénéré à chaque
 * prebuild. Ce script est donc à relancer après chaque `expo prebuild`, et
 * rien de ce qu'il écrit ne peut contaminer un build EAS — c'était la raison
 * de patcher le projet généré plutôt que app.config.js, où un canal en dur
 * aurait aussi bien pu se retrouver dans un build de production.
 *
 * PREREQUIS : `credentials.json` + le magasin de clés, récupérés depuis EAS
 * avec `npx eas-cli credentials` (Android > credentials.json > Download).
 * Ces deux fichiers portent la clé de signature et son mot de passe en clair,
 * ils sont ignorés par git — ne jamais les versionner.
 *
 * LANCEMENT : node scripts/prepare-local-android.js [canal]
 *             (canal par défaut : preview)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CHANNEL = process.argv[2] || 'preview';

const CREDENTIALS = path.join(ROOT, 'credentials.json');
const GRADLE_PROPS = path.join(ROOT, 'android', 'gradle.properties');
const APP_GRADLE = path.join(ROOT, 'android', 'app', 'build.gradle');
const MANIFEST = path.join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

const MARKER = '# --- signature locale (prepare-local-android.js) ---';

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, 'android'))) {
  fail("Le dossier android/ n'existe pas. Lance d'abord : npx expo prebuild --platform android");
}
if (!fs.existsSync(CREDENTIALS)) {
  fail('credentials.json est absent. Recupere-le avec : npx eas-cli credentials');
}

const keystore = (JSON.parse(fs.readFileSync(CREDENTIALS, 'utf8')).android || {}).keystore;
if (!keystore || !keystore.keystorePath) fail('credentials.json ne contient pas de bloc android.keystore.');

const storePath = path.resolve(ROOT, keystore.keystorePath);
if (!fs.existsSync(storePath)) fail(`Magasin de cles introuvable : ${keystore.keystorePath}`);

// === 1. Les secrets dans gradle.properties ===============================
// Plutôt qu'en arguments de ligne de commande : ils y apparaîtraient dans
// l'historique du terminal et dans la liste des processus. gradle.properties
// vit dans android/, donc hors du dépôt.
let props = fs.readFileSync(GRADLE_PROPS, 'utf8');
const markerAt = props.indexOf(MARKER);
if (markerAt !== -1) props = props.slice(0, markerAt); // relance : on remplace

props =
  props.trimEnd() +
  '\n\n' +
  MARKER +
  '\n' +
  // Chemin en barres obliques : un fichier .properties traite l'antislash
  // comme un caractère d'échappement, un chemin Windows brut y est illisible.
  `CEOU_STORE_FILE=${storePath.replace(/\\/g, '/')}\n` +
  `CEOU_STORE_PASSWORD=${keystore.keystorePassword}\n` +
  `CEOU_KEY_ALIAS=${keystore.keyAlias}\n` +
  `CEOU_KEY_PASSWORD=${keystore.keyPassword}\n`;
fs.writeFileSync(GRADLE_PROPS, props);

// === 2. La configuration de signature dans app/build.gradle ==============
let gradle = fs.readFileSync(APP_GRADLE, 'utf8');

if (!gradle.includes('ceouRelease')) {
  const anchor = `    signingConfigs {
        debug {`;
  if (!gradle.includes(anchor)) fail("Bloc signingConfigs introuvable dans app/build.gradle — le gabarit a change.");
  gradle = gradle.replace(
    anchor,
    `    signingConfigs {
        ceouRelease {
            storeFile file(CEOU_STORE_FILE)
            storePassword CEOU_STORE_PASSWORD
            keyAlias CEOU_KEY_ALIAS
            keyPassword CEOU_KEY_PASSWORD
        }
        debug {`,
  );
}

// Le gabarit d'Expo signe `release` avec la clé de debug, en le signalant
// lui-même par un commentaire d'avertissement. C'est cette ligne-là qu'on
// remplace, et une seule fois : `debug` doit garder sa propre clé.
const releaseSigning = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;
if (gradle.includes(releaseSigning)) {
  gradle = gradle.replace(
    releaseSigning,
    `        release {
            signingConfig signingConfigs.ceouRelease`,
  );
}
fs.writeFileSync(APP_GRADLE, gradle);

// === 3. Lint désactivé sur les variantes release =========================
// `lintVital` casse ici sur react-native-screens, et c'est de l'analyse
// statique : elle ne dit rien de la validité de l'APK. L'exclure en ligne de
// commande ne marche pas — retirer la tâche qui PRODUIT le rapport laisse
// celle qui le CONSOMME réclamer des fichiers absents. On coupe la chaîne
// entière par la configuration prévue pour ça.
if (!gradle.includes('checkReleaseBuilds false')) {
  const lintAnchor = '    packagingOptions {';
  if (!gradle.includes(lintAnchor)) fail('Bloc packagingOptions introuvable dans app/build.gradle.');
  gradle = gradle.replace(
    lintAnchor,
    `    lint {
        checkReleaseBuilds false
        abortOnError false
    }
${lintAnchor}`,
  );
  fs.writeFileSync(APP_GRADLE, gradle);
}

// === 4. Le canal de mise à jour dans le manifeste ========================
// expo-updates lit une carte d'en-têtes HTTP sérialisée en JSON sous cette
// clé, et transmet le canal via l'en-tête `expo-channel-name` (voir
// UpdatesConfiguration.kt dans expo-updates).
let manifest = fs.readFileSync(MANIFEST, 'utf8');
const HEADERS_KEY = 'expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY';
const headersTag =
  `    <meta-data android:name="${HEADERS_KEY}" ` +
  `android:value="{&quot;expo-channel-name&quot;:&quot;${CHANNEL}&quot;}"/>\n`;

manifest = manifest.replace(new RegExp(`^\\s*<meta-data android:name="${HEADERS_KEY.replace(/\./g, '\\.')}".*\\n`, 'm'), '');
const urlTagAt = manifest.indexOf('<meta-data android:name="expo.modules.updates.EXPO_UPDATE_URL"');
if (urlTagAt === -1) fail("Le manifeste ne declare pas EXPO_UPDATE_URL — expo-updates n'est pas configure.");
const lineEnd = manifest.indexOf('\n', urlTagAt) + 1;
manifest = manifest.slice(0, lineEnd) + headersTag + manifest.slice(lineEnd);
fs.writeFileSync(MANIFEST, manifest);

console.log(`  Signature   : cle EAS, alias ${keystore.keyAlias}`);
console.log(`  Canal OTA   : ${CHANNEL}`);
console.log('  Pret. Construis avec : cd android && ./gradlew assembleRelease');
