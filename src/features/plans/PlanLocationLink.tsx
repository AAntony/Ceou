import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';
import { Icon } from '../../components/Icon';
import { usePieceLocationOnPlan } from './queries';
import { useThemeColors } from '../../lib/theme';

type PlanLocationLinkProps = {
  pieceId?: string;
  emplacementId?: string;
};

// Rendu vide si la pièce de l'objet n'a jamais été placée sur un plan —
// pas de bouton mort pour une fonctionnalité (Plans) que l'utilisateur n'a
// peut-être pas encore utilisée.
export function PlanLocationLink({ pieceId, emplacementId }: PlanLocationLinkProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { data } = usePieceLocationOnPlan(pieceId ?? '');

  if (!pieceId || !data) return null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push(
          `/plan/${data.planId}?highlightFormeId=${data.formeId}${emplacementId ? `&highlightEmplacementId=${emplacementId}` : ''}`,
        )
      }
      className="mb-6 flex-row items-center justify-center gap-2 rounded-xl border border-coral/30 bg-coral-light px-4 py-3 active:opacity-70"
    >
      <Icon name="plan" size={18} color={colors.accentDark} />
      <Text className="shrink text-label font-semibold text-coral-dark">{t('inventory.objet.view_on_plan')}</Text>
    </Pressable>
  );
}
