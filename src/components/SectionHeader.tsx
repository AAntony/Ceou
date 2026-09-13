import type { ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChromeScale, MAX_CHROME_SCALE } from '../lib/textScale';
import { useThemeColors } from '../lib/theme';

/** Shared header for the main sections, regardless of their navigator. */
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const chrome = useChromeScale();
  const colors = useThemeColors();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.sand }}>
      <View style={{ minHeight: Math.round((Platform.OS === 'ios' ? 44 : 56) * chrome),
        paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        borderBottomWidth: 1, borderBottomColor: colors.sandDark }}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_CHROME_SCALE}
          style={{ flex: 1, color: colors.ink, fontSize: Math.round((Platform.OS === 'ios' ? 17 : 20) * chrome), fontWeight: '600' }}>
          {title}
        </Text>
        {action}
      </View>
    </View>
  );
}
