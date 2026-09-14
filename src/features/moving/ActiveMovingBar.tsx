import { useTranslation } from 'react-i18next';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSpaceForAppTabBar } from '../../components/AppTabBar';
import { Icon } from '../../components/Icon';
import { useThemeColors } from '../../lib/theme';
import type { ActiveMoving } from './useActiveMoving';

/**
 * A compact bar resting just above the tab bar while a move is ongoing.
 *
 * Absolutely positioned so it stays put while the list scrolls; the screen
 * reads its height through `onLayout` to keep the end of the list reachable.
 */
export function ActiveMovingBar({ moving, onLayout }: { moving: ActiveMoving; onLayout?: (event: LayoutChangeEvent) => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const bottom = useSpaceForAppTabBar();

  const title = moving.activeCount > 1 ? t('moving.activeBarMany', { count: moving.activeCount }) : t('moving.activeBar');
  const hasPercent = moving.percent !== null;

  return (
    <View pointerEvents="box-none" onLayout={onLayout} style={{ position: 'absolute', left: 0, right: 0, bottom }} className="px-4 pb-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasPercent ? `${title}, ${t('moving.progress', { percent: moving.percent })}` : title}
        accessibilityHint={t('moving.resumeEntry')}
        onPress={moving.resume}
        className="min-h-[48px] flex-row items-center gap-3 rounded-2xl border border-ink/10 bg-surface px-4 py-2.5 active:opacity-80"
        // Lifts the bar off the list scrolling underneath it.
        style={{ elevation: 4, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}
      >
        <Icon name="conteneur" size={20} color={colors.accentDark} />
        <Text className="min-w-0 flex-1 text-label font-semibold text-ink">{title}</Text>
        {hasPercent ? (
          <Text className="text-label font-semibold text-coral-dark" style={{ fontVariant: ['tabular-nums'] }}>
            {t('moving.activeBarPercent', { percent: moving.percent })}
          </Text>
        ) : null}
        <Icon name="chevron" size={18} color={colors.inkSoft} />
      </Pressable>
    </View>
  );
}
