import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../lib/theme';
import { placeRoomLabel, overlaps, orderedPins, type LabelRect } from './exploreLayout';
import type { ShapeGeometry } from './types';
import type { PlanPin } from '../../types/database';

type Room = { id: string; geo: ShapeGeometry; label: string };

/** Screen-space labels: measured at the actual font size, independent of map zoom. */
export function ExploreLabelLayer({ rooms, pins, selectedId, zoom, factor, numbers, editingMetrics, highlightedId }: {
  rooms: Room[]; pins: PlanPin[]; selectedId: string | null;
  zoom: { scale: number; translateX: number; translateY: number }; factor: number;
  numbers: Record<string, number>;
  editingMetrics?: { cardWidth: number; cardHeight: number };
  highlightedId?: string | null;
}) {
  const colors = useThemeColors();
  const [measures, setMeasures] = useState<Record<string, { label: string; factor: number; width: number; height: number }>>({});
  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const occupied: LabelRect[] = [];
  if (editingMetrics) for (const pin of pins) {
    const room = roomById.get(pin.forme_id);
    if (!room) continue;
    occupied.push({ x: zoom.translateX + (room.geo.x + pin.rel_x * room.geo.width - editingMetrics.cardWidth / 2) * zoom.scale,
      y: zoom.translateY + (room.geo.y + pin.rel_y * room.geo.height - editingMetrics.cardHeight / 2) * zoom.scale,
      width: editingMetrics.cardWidth * zoom.scale, height: editingMetrics.cardHeight * zoom.scale });
  }
  const roomPins = orderedPins(pins.filter((pin) => pin.forme_id === selectedId));
  const pinNumbers = new Map(roomPins.map((pin, index) => [pin.id, index + 1]));
  const markers = (editingMetrics ? [] : [...roomPins].sort((a, b) => Number(b.emplacement_id === highlightedId) - Number(a.emplacement_id === highlightedId))).map((pin) => {
    const room = roomById.get(pin.forme_id);
    if (!room) return null;
    const highlighted = pin.emplacement_id === highlightedId;
    const diameter = (highlighted ? 44 : 24) * factor;
    const rect = { x: zoom.translateX + (room.geo.x + pin.rel_x * room.geo.width) * zoom.scale - diameter / 2,
      y: zoom.translateY + (room.geo.y + pin.rel_y * room.geo.height) * zoom.scale - diameter / 2,
      width: diameter, height: diameter };
    // Dense/duplicate positions stay available in the full list below the map.
    if (occupied.some((other) => overlaps(rect, other))) return null;
    occupied.push(rect);
    return <View key={pin.id} style={{ position: 'absolute', left: rect.x, top: rect.y,
      width: diameter, height: diameter, borderRadius: diameter / 2, backgroundColor: colors.accent,
      boxShadow: highlighted ? `0 0 0 6px ${colors.accentLight}` : undefined,
      borderWidth: highlighted ? 3 : 2, borderColor: pin.emplacement_id === highlightedId ? colors.accentDark : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
      <Text allowFontScaling={false} style={{ color: '#fff', fontSize: (highlighted ? 18 : 12) * factor, fontWeight: '700' }}>{pinNumbers.get(pin.id)}</Text>
    </View>;
  });
  const textStyle = { fontSize: 14 * factor, lineHeight: 18 * factor, fontWeight: '600' as const, color: colors.ink };
  return <View pointerEvents="none" aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    {/* Measure full names rather than estimating character widths or truncating them. */}
    <View style={{ position: 'absolute', opacity: 0, width: 2000, alignItems: 'flex-start' }}>
    {rooms.map((room) => <Text key={`measure-${room.id}`} allowFontScaling={false}
      style={textStyle}
      onLayout={(event) => {
        const line = event.nativeEvent.layout;
        const size = { label: room.label, factor, width: Math.ceil(line.width) + 2, height: Math.ceil(line.height) + 2 };
        setMeasures((prev) => {
          const previous = prev[room.id];
          return previous?.width === size.width && previous?.height === size.height && previous?.label === room.label && previous?.factor === factor
            ? prev : { ...prev, [room.id]: size };
        });
      }}>{room.label}</Text>)}
    </View>
    {markers}
    {rooms.map((room) => {
      const bounds = { x: zoom.translateX + room.geo.x * zoom.scale, y: zoom.translateY + room.geo.y * zoom.scale,
        width: room.geo.width * zoom.scale, height: room.geo.height * zoom.scale };
      const measured = measures[room.id];
      const size = measured?.label === room.label && measured.factor === factor ? measured : undefined;
      const label = size ? placeRoomLabel(bounds, size, occupied) : null;
      const badge = !label ? placeRoomLabel(bounds, { width: 24 * factor, height: 24 * factor }, occupied) : null;
      const rect = label ?? badge;
      if (!rect) return null;
      occupied.push(rect);
      return <View key={room.id} style={{ position: 'absolute', left: rect.x, top: rect.y,
        width: rect.width, height: rect.height, alignItems: 'center', justifyContent: 'center',
        backgroundColor: label ? undefined : colors.surface, borderRadius: 20 }}>
        <Text allowFontScaling={false} numberOfLines={1} style={label ? textStyle : { ...textStyle, fontSize: 12 * factor }}>
          {label ? room.label : numbers[room.id]}
        </Text>
      </View>;
    })}
  </View>;
}
