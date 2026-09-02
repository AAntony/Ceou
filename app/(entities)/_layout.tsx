import { Stack } from 'expo-router';
import { RequireSession } from '../../src/features/auth/RequireSession';
import { useHeaderOptions } from '../../src/lib/headerOptions';

export default function EntitiesLayout() {
  // Fond, teinte et titre viennent de src/lib/headerOptions : les mêmes
  // valeurs servent au Stack racine et au navigateur d'onglets.
  const header = useHeaderOptions();

  return (
    <RequireSession>
      <Stack
        screenOptions={{
          headerShown: true,
          headerBackTitle: '',
          ...header,
        }}
      />
    </RequireSession>
  );
}
