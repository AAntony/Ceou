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

## EAS

Le projet est lié à `@m-ajestic/ceou`. Profils de build dans `eas.json` (`development`, `preview`, `production`).

```bash
npx eas-cli build --profile development --platform android
```
