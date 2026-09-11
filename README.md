# Ceou

Application mobile (Android, React Native/Expo) pour lister et localiser tous les objets d'une habitation : habitations → pièces → emplacements → conteneurs → objets, avec historique de déplacement et plan 2D par étage.

## Stack

- [Expo](https://expo.dev) (Expo Router, TypeScript) + [NativeWind](https://www.nativewind.dev)
- [Supabase](https://supabase.com) (Auth, Postgres, Storage, RLS)
- [TanStack Query](https://tanstack.com/query) + [Zustand](https://zustand-demo.pmnd.rs)
- i18next (FR/EN)
- EAS Build/Submit

## Mise en route

```bash
npm install
cp .env.example .env   # renseigner EXPO_PUBLIC_SUPABASE_ANON_KEY
npx expo start
```

## Supabase

Le schéma est géré par migrations versionnées dans `supabase/migrations/`.

```bash
npx supabase login
npx supabase link --project-ref neessqtornvankriouwd
npx supabase db push              # applique les migrations
npx supabase gen types typescript --project-id neessqtornvankriouwd > src/types/supabase.ts
```

## Build Android

**En local, par défaut.** Un build sur les serveurs EAS est réservé à la
production.

```bash
npx expo prebuild --platform android --clean
node scripts/prepare-local-android.js
cd android && ./gradlew assembleRelease
```

L'APK sort dans `android/app/build/outputs/apk/release/`.

`android/` est ignoré par git et entièrement regénéré par `prebuild` : le
script est donc à relancer **après chaque prebuild**. Il rebranche trois
choses que le gabarit d'Expo ne connaît pas et dont l'absence ne se voit pas
tout de suite — le chemin du SDK, la vraie clé de signature (sans elle, l'APK
est signé avec la clé de debug et refuse de s'installer par-dessus un build
EAS), et le canal de mise à jour (sans lui, l'APK ne reçoit jamais d'OTA).
Les raisons sont écrites en tête du script.

Prérequis, une fois : JDK 17, le SDK Android, et les identifiants de signature
récupérés depuis EAS.

```bash
npx eas-cli credentials
```

*Android > credentials.json > Download*. Ça dépose `credentials.json` et le
magasin de clés, qui portent le mot de passe en clair — les deux sont ignorés
par git, ne jamais les versionner.

Un autre canal que `preview` se passe en argument :
`node scripts/prepare-local-android.js production`.

## EAS

Le projet est lié à `@m-ajestic/ceou`. Profils de build dans `eas.json`
(`development`, `preview`, `production`). À réserver à la production.

```bash
npx eas-cli build --profile production --platform android
```

Les mises à jour OTA, elles, passent toujours par EAS Update.

```bash
npx eas-cli update --branch preview --environment preview --message "..."
```
