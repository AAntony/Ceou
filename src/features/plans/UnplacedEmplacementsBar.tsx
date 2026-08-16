import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { IconBadge } from '../../components/IconBadge';
import { getEmplacementIcon } from '../inventory/constants';
import { useEmplacements } from '../inventory/queries';
import type { PlanPin } from '../../types/database';

type UnplacedEmplacementsBarProps = {
  pieceId: string;
  pins: PlanPin[];
  onPlace: (emplacementId: string) => void;
};

// Bloc dans le flux normal de l'écran (au-dessus du plan, sous le rappel des
// gestes — voir plan/[id].tsx), plus une superposition flottante sur le plan
// comme dans les versions précédentes : ne mange plus d'espace de
// visualisation du plan lui-même, et la pleine largeur d'écran laisse enfin
// la place pour le nom de chaque Emplacement, pas seulement son icône.
// Rangée horizontale (pas une grille) : une seule ligne compacte, qui
// défile s'il y a plus d'Emplacements que de place visible, plutôt que de
// repousser le plan vers le bas à chaque fois qu'elle s'agrandirait.
export function UnplacedEmplacementsBar({ pieceId, pins, onPlace }: UnplacedEmplacementsBarProps) {
  const { t } = useTranslation();
  const { data: emplacements } = useEmplacements(pieceId);

  const placedIds = new Set(pins.map((p) => p.emplacement_id));
  const unplaced = (emplacements ?? []).filter((e) => !placedIds.has(e.id));

  if (unplaced.length === 0) return null;

  return (
    <View className="px-6 pb-3">
      <Text className="mb-2 text-xs font-medium text-ink-soft">{t('plans.unplaced_title')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {unplaced.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => onPlace(e.id)}
            className="flex-row items-center gap-2 self-start rounded-full border border-ink/10 bg-white px-3 py-1.5 active:opacity-70"
          >
            <IconBadge icon={getEmplacementIcon(e.preset_key)} fill="#F3EFE9" size={26} />
            <Text numberOfLines={1} className="text-sm font-medium text-ink">
              {e.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
