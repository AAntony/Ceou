import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon, type IconName } from '../../components/Icon';
import { useThemeColors } from '../../lib/theme';

export function ProfileSection({ title, summary, icon, children, defaultOpen = false }: {
  title: string; summary: string; icon: IconName; children: ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const colors = useThemeColors();
  return <View className="mb-3 overflow-hidden rounded-2xl border border-ink/10 bg-surface">
    <Pressable onPress={() => setOpen(!open)} accessibilityRole="button"
      accessibilityLabel={`${title}. ${summary}`} accessibilityState={{ expanded: open }}
      className="min-h-[64px] flex-row items-center gap-3 p-4">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-coral-light">
        <Icon name={icon} size={22} color={colors.accentDark} />
      </View>
      <View className="flex-1">
        <Text className="text-body font-semibold text-ink">{title}</Text>
        <Text className="mt-1 text-caption text-ink-soft">{summary}</Text>
      </View>
      <Icon name={open ? 'arrowDown' : 'chevron'} size={18} color={colors.inkSoft} />
    </Pressable>
    {open ? <View className="border-t border-ink/10 px-4 pb-4 pt-3">{children}</View> : null}
  </View>;
}
