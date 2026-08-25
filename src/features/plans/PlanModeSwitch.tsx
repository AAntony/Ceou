import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useThemeColors } from '../../lib/theme';

export type PlanMode = 'explore' | 'edit';

// Bascule Explorer / Modifier, FLOTTANTE au-dessus du plan.
//
// Elle vivait dans le flux de l'écran, au-dessus du canevas : elle mangeait
// donc une bande de hauteur en permanence, et le plan démarrait à mi-écran.
// Posée sur le plan, elle ne coûte plus rien — c'est le même principe que les
// barres flottantes de Material 3 Expressive, et le plan récupère la place.
//
// Forme de pastille segmentée conservée (sélecteur « Un ami / Un invité »,
// onglets Personnelles/Partagées) : même modèle d'interaction, déjà rencontré
// par l'utilisateur, simplement compacté et posé sur un fond opaque pour
// rester lisible par-dessus les pièces.
//
// Affichée UNIQUEMENT à qui peut modifier : proposer « Modifier » à un
// visiteur ou à un ami en Consultation serait une promesse que la RLS
// refuserait derrière.
export function PlanModeSwitch({ mode, onChange }: { mode: PlanMode; onChange: (mode: PlanMode) => void }) {
  const { t } = useTranslation();

  return (
    <View className="flex-row gap-1 self-center rounded-full border border-ink/10 bg-surface/95 p-1">
      <Option
        active={mode === 'explore'}
        icon="search"
        label={t('plans.mode_explore')}
        onPress={() => onChange('explore')}
      />
      <Option active={mode === 'edit'} icon="pencil" label={t('plans.mode_edit')} onPress={() => onChange('edit')} />
    </View>
  );
}

function Option({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: 'search' | 'pencil';
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`flex-row items-center justify-center gap-1.5 rounded-full px-4 py-2 active:opacity-80 ${
        active ? 'bg-coral' : ''
      }`}
    >
      <Icon name={icon} size={16} color={active ? '#fff' : colors.inkSoft} />
      <Text className={active ? 'text-label font-semibold text-white' : 'text-label text-ink-soft'}>{label}</Text>
    </Pressable>
  );
}
