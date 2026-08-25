import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { RequireSession } from '../../src/features/auth/RequireSession';
import { useChromeScale } from '../../src/lib/textScale';
import { useThemeColors } from '../../src/lib/theme';

// Taille par defaut du titre dans l'en-tete natif, par plateforme. Elle n'est
// REDECLAREE que si la personne a demande plus grand : a taille normale on
// laisse le systeme decider, plutot que de figer aujourd'hui une valeur qui
// pourrait changer avec la prochaine version de React Navigation.
const HEADER_TITLE_SIZE = Platform.OS === 'ios' ? 17 : 20;

export default function EntitiesLayout() {
  const colors = useThemeColors();
  // La HAUTEUR de l'en-tete natif n'est pas reglable (c'est une barre
  // systeme) : seul le titre grandit, et jusqu'au plafond du mobilier —
  // au-dela il serait rogne par le haut et par le bas.
  const chrome = useChromeScale();

  return (
    <RequireSession>
      <Stack
        screenOptions={{
          headerShown: true,
          headerBackTitle: '',
          headerStyle: { backgroundColor: colors.sand },
          headerTintColor: colors.accent,
          headerTitleStyle: {
            color: colors.ink,
            ...(chrome > 1 ? { fontSize: Math.round(HEADER_TITLE_SIZE * chrome) } : {}),
          },
        }}
      />
    </RequireSession>
  );
}
