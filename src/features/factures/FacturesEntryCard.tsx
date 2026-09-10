import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useThemeColors } from '../../lib/theme';
import { useFacturesForHabitation } from './queries';

// LA PORTE D'ENTRÉE DU DOSSIER, POSÉE SUR L'HABITATION.
//
// Pourquoi là : on déclare un sinistre PAR LOGEMENT. La portée est donc
// naturelle, et il n'y a aucun filtre à construire ni à comprendre.
//
// ELLE N'APPARAÎT QUE QUAND IL Y A QUELQUE CHOSE DEDANS, et ce n'est pas de
// la timidité. On n'ajoute pas une facture depuis cette liste — ça se fait
// depuis la fiche d'un objet, là où naît l'intention. Cette entrée-ci ne sert
// qu'à RELIRE : vide, elle ne mènerait nulle part tout en prenant sa place en
// haut de l'écran d'inventaire, qui est la surface la plus parcourue de
// l'app. Même principe que la carte des prêts sur l'onglet Amis.

type FacturesEntryCardProps = {
  habitationId: string;
  /** Les factures sont privées : rien à montrer à qui n'est pas chez lui. */
  isOwner: boolean;
};

export function FacturesEntryCard({ habitationId, isOwner }: FacturesEntryCardProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { data } = useFacturesForHabitation(isOwner ? habitationId : undefined);

  const factures = data ?? [];
  if (!isOwner || factures.length === 0) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('factures.entry.title')}
      onPress={() => router.push({ pathname: '/factures', params: { habitationId } })}
      className="mb-3 flex-row items-center gap-3 rounded-2xl border border-ink/10 bg-surface px-4 py-3 active:opacity-70"
    >
      <Icon name="facture" size={20} color={colors.accentDark} />
      <View className="flex-1">
        <Text className="text-body text-ink">{t('factures.entry.title')}</Text>
        <Text className="text-caption text-ink-soft">{t('factures.entry.count', { count: factures.length })}</Text>
      </View>
      <Icon name="chevron" size={18} color={colors.inkFaint} />
    </Pressable>
  );
}
