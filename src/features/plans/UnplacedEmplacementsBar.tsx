import { Pressable, ScrollView, Text, View } from 'react-native';
import { IconBadge } from '../../components/IconBadge';
import { getEmplacementIcon } from '../inventory/constants';
import { useEmplacements } from '../inventory/queries';
import type { PlanPin } from '../../types/database';
import { MENU_PANEL_BACKGROUND } from './constants';

type UnplacedEmplacementsBarProps = {
  pieceId: string;
  pins: PlanPin[];
  onPlace: (emplacementId: string) => void;
};

// Menu vertical flottant sur le bord gauche du plan, fond translucide —
// remplace l'ancienne rangée horizontale de chips sous le plan. Chaque ligne
// porte l'icône ET le nom de l'Emplacement (pas icône seule comme la version
// précédente) : sans le nom, impossible de savoir ce qu'on est en train de
// poser dans la pièce avant de le faire. Ligne tronquée sur 1 ligne plutôt
// qu'élargir encore le panneau, qui reste posé par-dessus un plan déjà
// restreint en largeur.
export function UnplacedEmplacementsBar({ pieceId, pins, onPlace }: UnplacedEmplacementsBarProps) {
  const { data: emplacements } = useEmplacements(pieceId);

  const placedIds = new Set(pins.map((p) => p.emplacement_id));
  const unplaced = (emplacements ?? []).filter((e) => !placedIds.has(e.id));

  if (unplaced.length === 0) return null;

  return (
    <View pointerEvents="box-none" className="absolute bottom-2 left-2 top-2 w-36">
      <View className="flex-1 rounded-2xl p-2" style={{ backgroundColor: MENU_PANEL_BACKGROUND }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-2">
          {unplaced.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => onPlace(e.id)}
              className="flex-row items-center gap-2 rounded-xl bg-white/60 py-1 pl-1 pr-2 active:opacity-70"
            >
              <IconBadge icon={getEmplacementIcon(e.preset_key)} fill="#FFFBF8" size={28} />
              <Text numberOfLines={1} className="flex-1 text-xs font-medium text-ink">
                {e.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
