import { View } from 'react-native';
import Svg, { ClipPath, Defs, Image as SvgImage, Polygon } from 'react-native-svg';
import { Icon, type IconName } from './Icon';

// Hexagone "pointy left/right, flat top/bottom" inscrit dans un carré de
// 100x100 — même formule pour le contour plein et pour le clip-path de la
// photo, afin que les deux restent alignés pixel pour pixel.
function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (i * 60);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

const POINTS = hexPoints(50, 50, 46);

type HexBadgeProps = {
  icon: IconName;
  fill: string;
  size?: number;
  photoUri?: string | null;
  iconColor?: string;
};

export function HexBadge({ icon, fill, size = 56, photoUri, iconColor = '#2D2A26' }: HexBadgeProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {photoUri ? (
          <>
            <Defs>
              <ClipPath id="hexClip">
                <Polygon points={POINTS} />
              </ClipPath>
            </Defs>
            <SvgImage href={photoUri} x={0} y={0} width={100} height={100} preserveAspectRatio="xMidYMid slice" clipPath="url(#hexClip)" />
            <Polygon points={POINTS} fill="none" stroke={fill} strokeWidth={6} strokeLinejoin="round" />
          </>
        ) : (
          <Polygon points={POINTS} fill={fill} stroke={fill} strokeWidth={6} strokeLinejoin="round" />
        )}
      </Svg>
      {photoUri ? null : (
        <View className="absolute inset-0 items-center justify-center">
          <Icon name={icon} size={size * 0.42} color={iconColor} />
        </View>
      )}
    </View>
  );
}
