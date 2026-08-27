import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useThemeColors } from '../../lib/theme';
import { isOverdue, usePrets } from './queries';

// La porte d'entrée des prêts, posée sur l'onglet Amis — c'est là qu'on pense
// aux gens, pas dans le Profil où elle serait enterrée sous les réglages.
//
// ELLE PARLE SEULEMENT QUAND ELLE A QUELQUE CHOSE À DIRE. Tant que rien ne
// circule, elle reste une ligne discrète ; dès qu'une échéance est passée,
// elle prend le rouge et compte les retards. C'est tout l'intérêt de la
// fonctionnalité : que l'app rappelle à ta place, sans qu'on ait à ouvrir un
// écran pour le découvrir.
export function LoansEntryCard() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { data } = usePrets(false);

  const open = data ?? [];
  const late = open.filter(isOverdue).length;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/prets')}
      className={`mb-6 flex-row items-center gap-3 rounded-2xl border px-4 py-3 active:opacity-70 ${
        late > 0 ? 'border-red-500/40 bg-red-500/10' : 'border-ink/10 bg-surface'
      }`}
    >
      <Icon name="pret" size={22} color={late > 0 ? colors.danger : colors.accentDark} />
      <View className="flex-1">
        <Text className="text-label font-semibold text-ink">{t('loans.title')}</Text>
        <Text numberOfLines={1} className={`mt-0.5 text-caption ${late > 0 ? 'font-semibold text-danger' : 'text-ink-soft'}`}>
          {late > 0
            ? t('loans.card.late', { count: late })
            : open.length === 0
              ? t('loans.card.none')
              : t('loans.card.open', { count: open.length })}
        </Text>
      </View>
      <Icon name="chevron" size={20} color={colors.inkFaint} />
    </Pressable>
  );
}
