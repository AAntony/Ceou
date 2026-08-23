import { Stack } from 'expo-router';
import { RequireSession } from '../../src/features/auth/RequireSession';
import { useThemeColors } from '../../src/lib/theme';

export default function EntitiesLayout() {
  const colors = useThemeColors();

  return (
    <RequireSession>
      <Stack
        screenOptions={{
          headerShown: true,
          headerBackTitle: '',
          headerStyle: { backgroundColor: colors.sand },
          headerTintColor: colors.accent,
          headerTitleStyle: { color: colors.ink },
        }}
      />
    </RequireSession>
  );
}
