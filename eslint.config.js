// Config ESLint (flat, ESLint 9) — ajoutée lors de l'audit du 2026-08-19.
// Motivation : `tsc` seul ne signalait PAS les imports/variables inutilisés,
// donc le code mort était invisible pour l'outillage et ne pouvait être traqué
// qu'à l'œil. Deux garde-fous complémentaires depuis :
//   - tsconfig (noUnusedLocals / noUnusedParameters) = variables et imports
//     morts, en ERREUR bloquante dès `tsc --noEmit` ;
//   - ESLint = règles React et conventions que le compilateur ne voit pas.
const expoConfig = require('eslint-config-expo/flat');
const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: [
      'dist/*',
      'node_modules/*',
      'expo-env.d.ts',
      // Généré par `supabase gen types` — le linter n'a rien à y dire, le
      // fichier est réécrit intégralement au prochain gen.
      'src/types/supabase.ts',
      // Code Deno (specifiers `npm:`, API Deno globale) : ni le résolveur de
      // modules Node ni les globals navigateur d'Expo ne s'y appliquent.
      // Déjà exclu de tsconfig.json pour la même raison.
      'supabase/functions/*',
    ],
  },
  {
    // Outillage Node lance a la main (jamais bundle dans l'app) : il utilise
    // les globales Node, absentes des globals navigateur/React Native que
    // pose eslint-config-expo. Sans cette declaration, require/module/Buffer
    // y sont signales comme non definis.
    files: ['scripts/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        exports: 'writable',
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@typescript-eslint': typescriptEslint },
    rules: {
      // Expo ne la pose qu'en `warn` : passée en `error` pour que
      // `npm run lint` échoue vraiment plutôt que de laisser filer. Les noms
      // préfixés d'un `_` restent tolérés — convention pour un paramètre
      // imposé par une signature mais délibérément ignoré (ex. le
      // `(_error, _input, context)` des onError de React Query).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      // FAUX POSITIF ASSUMÉ dans ce projet : les 13 occurrences signalées sont
      // toutes des `ref.current` lus/écrits DANS un callback de geste
      // (`Gesture.Pan().onStart/onUpdate`, `Gesture.Pinch()`), pas pendant le
      // rendu — c'est précisément l'usage canonique d'un ref avec
      // react-native-gesture-handler. La règle ne sait pas distinguer les deux
      // contextes. Vérifié fichier par fichier (PlanCanvas, PlanPinLayer) avant
      // désactivation : ne pas la réactiver sans refaire cette vérification.
      'react-hooks/refs': 'off',

      // Rétrogradée en avertissement, pas corrigée : les 16 occurrences sont
      // toutes le motif « remettre l'état à zéro quand la modale s'ouvre »
      // (`useEffect(() => { if (visible) setX(...) }, [visible])`), délibéré et
      // documenté dans ces composants. La règle est un conseil de performance
      // (rendus en cascade), pas un signalement de bug : le comportement actuel
      // est correct. À traiter comme un chantier à part si on veut s'en
      // débarrasser — ça touche l'état de modales qui fonctionnent aujourd'hui.
      'react-hooks/set-state-in-effect': 'warn',

      // Rétrogradée le 26/08, comme les deux ci-dessus, et pour une raison
      // qu'il faut connaître avant de la remonter : cette règle ne signale PAS
      // un bug. Elle dit « si tu activais le React Compiler, il renoncerait à
      // optimiser ce composant ». Or il n'est pas activé — c'est une option
      // d'`experiments` en SDK 57, absente d'app.config.js, et le bundle
      // exporté ne contient aucun composant compilé (zéro site `_c(n)`,
      // vérifié). Elle n'a donc aucun effet à l'exécution aujourd'hui.
      //
      // Graduée en ERREUR, elle rendait `npm run verify` rouge en permanence :
      // un garde-fou toujours rouge ne distingue plus une faute nouvelle d'une
      // faute connue, donc on cesse de le lire. C'était son seul coût réel, et
      // il dépassait son bénéfice.
      //
      // Les occurrences sont toutes dans PlanCanvas, et elles NE SONT PAS
      // corrigeables en retouchant les mémoïsations signalées : vérifié en
      // réécrivant doorSpansByForme sans aucune mutation (`reduce` pur) — le
      // compilateur renonce toujours. La cause est ailleurs dans ce composant
      // de 1370 lignes. À reprendre le jour où activer le compilateur devient
      // un objectif : ce sera un chantier, pas un réglage.
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
]);
