import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';
import { Icon } from '../../components/Icon';
import { useThemeColors } from '../../lib/theme';

export type PlanMode = 'explore' | 'edit';

/** Editing is an explicit secondary action; browsing is the default. */
export function PlanModeSwitch({ mode, onChange }: { mode: PlanMode; onChange: (mode: PlanMode) => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const editing = mode === 'edit';
  return <Pressable accessibilityRole="button" onPress={() => onChange(editing ? 'explore' : 'edit')}
    className={`min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl px-3 ${editing ? 'bg-coral' : 'bg-surface'}`}>
    <Icon name={editing ? 'close' : 'pencil'} size={18} color={editing ? '#fff' : colors.accentDark} />
    <Text className={`text-label font-semibold ${editing ? 'text-white' : 'text-coral-dark'}`}>{t(editing ? 'common.done' : 'plans.mode_edit')}</Text>
  </Pressable>;
}
