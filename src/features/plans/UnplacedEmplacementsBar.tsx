import { Pressable, ScrollView, View } from 'react-native';
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

// Menu vertical flottant sur le bord gauche du plan, façon inventaire de jeu
// vidéo (icônes seules, empilées, fond translucide) — remplace l'ancienne
// rangée horizontale de chips sous le plan. Icônes uniquement, sans texte :
// un panneau volontairement compact posé par-dessus un plan déjà petit
// (340px de large) n'a pas la place pour des libellés.
export function UnplacedEmplacementsBar({ pieceId, pins, onPlace }: UnplacedEmplacementsBarProps) {
  const { data: emplacements } = useEmplacements(pieceId);

  const placedIds = new Set(pins.map((p) => p.emplacement_id));
  const unplaced = (emplacements ?? []).filter((e) => !placedIds.has(e.id));

  if (unplaced.length === 0) return null;

  return (
    <View pointerEvents="box-none" className="absolute bottom-2 left-2 top-2 w-11 items-center">
      <View className="w-11 flex-1 items-center rounded-2xl py-2" style={{ backgroundColor: MENU_PANEL_BACKGROUND }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="items-center gap-2">
          {unplaced.map((e) => (
            <Pressable key={e.id} onPress={() => onPlace(e.id)} className="active:opacity-70">
              <IconBadge icon={getEmplacementIcon(e.preset_key)} fill="#FFFBF8" size={32} />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
