import { Stack } from 'expo-router';
import { RequireSession } from '../../src/features/auth/RequireSession';

export default function EntitiesLayout() {
  return (
    <RequireSession>
      <Stack
        screenOptions={{
          headerShown: true,
          headerBackTitle: '',
          headerStyle: { backgroundColor: '#FFFBF8' },
          headerTintColor: '#1591EA',
          headerTitleStyle: { color: '#2D2A26' },
        }}
      />
    </RequireSession>
  );
}
