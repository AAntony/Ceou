import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { useThemeColors } from '../../lib/theme';

export type PlanMode = 'explore' | 'edit';

// Bascule Explorer / Modifier.
//
// Reprend le motif des pastilles segmentées déjà utilisé ailleurs dans l'app
// (sélecteur « Un ami / Un invité » de ShareInviteModal, onglets
// Personnelles/Partagées) plutôt qu'un nouveau composant : c'est le même
// modèle d'interaction — deux vues interchangeables — et l'utilisateur l'a
// déjà rencontré.
//
// Affichée UNIQUEMENT à qui peut modifier : proposer « Modifier » à un
// visiteur ou à un ami en Consultation serait une promesse que la RLS
// refuserait derrière.
export function PlanModeSwitch({ mode, onChange }: { mode: PlanMode; onChange: (mode: PlanMode) => void }) {
  const { t } = useTranslation();

  return (
    <View className="mb-3 flex-row gap-2">
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
      className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl px-4 active:opacity-80 ${
        active ? 'border-2 border-coral bg-coral-light py-[9px]' : 'border border-ink/10 py-2.5'
      }`}
    >
      <Icon name={icon} size={16} color={active ? colors.accentDark : colors.inkSoft} />
      <Text className={active ? 'text-sm font-semibold text-coral-dark' : 'text-sm text-ink-soft'}>{label}</Text>
    </Pressable>
  );
}
