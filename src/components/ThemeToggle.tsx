import { useTranslation } from 'react-i18next';
import { Pressable, Switch, Text, View } from 'react-native';
import { useTheme, useThemeColors } from '../lib/theme';

// L'interrupteur de thème.
//
// UN INTERRUPTEUR ET NON TROIS CHOIX (clair / sombre / système) : c'est la
// demande, et c'est le bon réglage par défaut de toute façon — tant que
// personne n'y touche, l'app suit le téléphone, ce que 'system' ferait de
// mieux. Le lien de retour n'apparaît QUE si un choix manuel a été fait :
// avant, il ne proposerait rien d'autre que l'état courant.
//
// Partagé entre le Profil normal et celui d'un visiteur : un visiteur ne
// possède rien dans l'app, mais il a les mêmes yeux et le même écran.
export function ThemeToggle() {
  const { t } = useTranslation();
  const { preference, isDark, setPreference } = useTheme();
  const colors = useThemeColors();

  return (
    <View>
      <Text className="mb-2 text-sm font-medium text-ink-soft">{t('profile.theme.title')}</Text>
      <View className="flex-row items-center justify-between rounded-xl border border-ink/10 bg-surface px-4 py-3">
        <Text className="text-base text-ink">{t('profile.theme.dark_label')}</Text>
        <Switch
          value={isDark}
          onValueChange={(next) => setPreference(next ? 'dark' : 'light')}
          trackColor={{ false: colors.sandDark, true: colors.accent }}
          thumbColor={colors.surface}
          accessibilityLabel={t('profile.theme.dark_label')}
        />
      </View>
      {preference === 'system' ? null : (
        <Pressable onPress={() => setPreference('system')} className="mt-2 self-start py-1" accessibilityRole="button">
          <Text className="text-xs font-semibold text-coral">{t('profile.theme.follow_system')}</Text>
        </Pressable>
      )}
    </View>
  );
}
