import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Sticky bottom action bar. Padding accounts for the device's safe-area
 * inset (Android gesture nav bar) instead of a fixed py-4 — otherwise the
 * buttons sit under the system gesture area on modern devices.
 */
export function BottomActionBar({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute bottom-0 left-0 right-0 flex-row gap-3 border-t border-ink/10 bg-sand px-6 pt-4"
      style={{ paddingBottom: insets.bottom + 16 }}
    >
      {children}
    </View>
  );
}
