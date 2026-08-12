import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BottomActionBarProps = PropsWithChildren<{
  // Décale la barre vers le haut — nécessaire sur les écrans où AppTabBar
  // (barre d'onglets globale) est aussi visible en dessous, pour ne pas
  // superposer les deux (ex: /habitations).
  extraBottomOffset?: number;
}>;

/**
 * Sticky bottom action bar. Padding accounts for the device's safe-area
 * inset (Android gesture nav bar) instead of a fixed py-4 — otherwise the
 * buttons sit under the system gesture area on modern devices.
 */
export function BottomActionBar({ children, extraBottomOffset = 0 }: BottomActionBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute left-0 right-0 flex-row gap-3 border-t border-ink/10 bg-sand px-6 pt-4"
      style={{ bottom: extraBottomOffset, paddingBottom: insets.bottom + 16 }}
    >
      {children}
    </View>
  );
}
