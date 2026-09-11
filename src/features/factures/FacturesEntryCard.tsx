import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useThemeColors } from '../../lib/theme';
import { useFacturesForHabitation, useObjetsSansFacture } from './queries';

// LA PORTE D'ENTRÉE DU DOSSIER, POSÉE SUR L'HABITATION.
//
// Pourquoi là : on déclare un sinistre PAR LOGEMENT. La portée est donc
// naturelle, et il n'y a aucun filtre à construire ni à comprendre.
//
// ELLE APPARAÎT DÈS QU'IL Y A QUELQUE CHOSE À DIRE — et depuis que le dossier
// montre aussi ce qui MANQUE, « quelque chose à dire » veut dire : des
// factures, ou des objets qui n'en ont pas.
//
// Elle ne s'affichait auparavant qu'à partir de la première facture, ce qui
// rendait le second onglet inatteignable exactement pour qui en a le plus
// besoin : quelqu'un qui a rempli son inventaire et n'a encore photographié
// aucun ticket. Seul un logement réellement vide la fait disparaître — là,
// elle ne mènerait nulle part tout en prenant sa place en haut de l'écran
// d'inventaire, qui est la surface la plus parcourue de l'app.
//
// LE SOUS-TITRE DIT LES DEUX CHIFFRES quand les deux existent. Celui qui
// compte est le second : « 34 objets sans preuve » est la seule information
// qui appelle une action, et elle n'a aucune raison d'attendre qu'on ouvre
// l'écran pour se montrer.

type FacturesEntryCardProps = {
  habitationId: string;
  /** Les factures sont privées : rien à montrer à qui n'est pas chez lui. */
  isOwner: boolean;
};

export function FacturesEntryCard({ habitationId, isOwner }: FacturesEntryCardProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { data: factures } = useFacturesForHabitation(isOwner ? habitationId : undefined);
  const { data: sansFacture } = useObjetsSansFacture(isOwner ? habitationId : undefined);

  const nbFactures = factures?.length ?? 0;
  const nbManquants = sansFacture?.length ?? 0;
  if (!isOwner || nbFactures + nbManquants === 0) return null;

  const details = [
    nbFactures > 0 ? t('factures.entry.count', { count: nbFactures }) : null,
    nbManquants > 0 ? t('factures.entry.missing', { count: nbManquants }) : null,
  ].filter(Boolean);

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
        <Text className="text-caption text-ink-soft">{details.join(' · ')}</Text>
      </View>
      <Icon name="chevron" size={18} color={colors.inkFaint} />
    </Pressable>
  );
}
