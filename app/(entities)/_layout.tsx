import { Stack } from 'expo-router';
import { RequireSession } from '../../src/features/auth/RequireSession';

export default function EntitiesLayout() {
  return (
    <RequireSession>
      <Stack screenOptions={{ headerShown: true, headerBackTitle: '' }} />
    </RequireSession>
  );
}
