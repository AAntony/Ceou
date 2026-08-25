import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { IconBadge } from '../../components/IconBadge';
import { getEmplacementIcon } from '../inventory/constants';
import { useEmplacements } from '../inventory/queries';
import type { PlanPin } from '../../types/database';
import { useThemeColors } from '../../lib/theme';

type UnplacedEmplacementsBarProps = {
  pieceId: string;
  pins: PlanPin[];
  onPlace: (emplacementId: string) => void;
};

// Carte flottante posée sur le plan, juste au-dessus de la barre d'outils,
// et non plus un bloc dans le flux de l'écran : elle apparaît/disparaît selon
// la pièce sélectionnée, et dans le flux ce va-et-vient faisait sauter le
// plan vers le bas à chaque sélection. Sur le plan, elle ne coûte plus aucune
// hauteur.
//
// Rangée horizontale (pas une grille) : une seule ligne compacte, qui défile
// s'il y a plus d'Emplacements que de place visible.
export function UnplacedEmplacementsBar({ pieceId, pins, onPlace }: UnplacedEmplacementsBarProps) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { data: emplacements } = useEmplacements(pieceId);

  const placedIds = new Set(pins.map((p) => p.emplacement_id));
  const unplaced = (emplacements ?? []).filter((e) => !placedIds.has(e.id));

  if (unplaced.length === 0) return null;

  return (
    <View className="rounded-2xl border border-ink/10 bg-surface/95 px-3 py-2">
      <Text className="mb-1.5 text-caption font-medium text-ink-soft">{t('plans.unplaced_title')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {unplaced.map((e) => (
          <Pressable
            accessibilityRole="button"
            key={e.id}
            onPress={() => onPlace(e.id)}
            className="flex-row items-center gap-2 self-start rounded-full border border-ink/10 bg-sand px-3 py-1.5 active:opacity-70"
          >
            <IconBadge icon={getEmplacementIcon(e.preset_key)} fill={colors.sandDark} size={26} />
            <Text numberOfLines={1} className="text-label font-medium text-ink">
              {e.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
