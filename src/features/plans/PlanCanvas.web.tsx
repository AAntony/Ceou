import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { forwardRef, type RefAttributes } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { PlanCanvasHandle, PlanCanvasProps } from './PlanCanvasImpl';

export type { PlanCanvasHandle } from './PlanCanvasImpl';

/** CanvasKit must be ready before importing the drawing module on web. */
export const PlanCanvas = forwardRef<PlanCanvasHandle, PlanCanvasProps>(function PlanCanvasWeb(props, ref) {
  return <View style={{ flex: 1 }}>
    <WithSkiaWeb<PlanCanvasProps & RefAttributes<PlanCanvasHandle>> opts={{ locateFile: () => '/canvaskit.wasm' }}
      fallback={<View className="flex-1 items-center justify-center"><ActivityIndicator /></View>}
      getComponent={async () => { const module = await import('./PlanCanvasImpl'); return { default: module.PlanCanvas }; }}
      componentProps={{ ...props, ref }} />
  </View>;
});
