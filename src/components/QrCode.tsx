import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import { View } from 'react-native';

type QrCodeProps = {
  value: string;
  size?: number;
};

// Génère la matrice via qrcode-generator (pur JS, aucune dépendance
// native — contrairement aux libs QR habituelles basées sur
// react-native-svg, qui casseraient les mises à jour OTA pour qui a déjà
// l'app installée, voir CLAUDE.md) et la rend comme une simple grille de
// View colorées plutôt qu'un rendu SVG/Canvas.
export function QrCode({ value, size = 200 }: QrCodeProps) {
  const modules = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    const grid: boolean[][] = [];
    for (let row = 0; row < count; row++) {
      const line: boolean[] = [];
      for (let col = 0; col < count; col++) line.push(qr.isDark(row, col));
      grid.push(line);
    }
    return grid;
  }, [value]);

  const cellSize = size / modules.length;

  return (
    <View style={{ width: size, height: size, backgroundColor: '#FFFFFF' }}>
      {modules.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {row.map((dark, c) => (
            <View key={c} style={{ width: cellSize, height: cellSize, backgroundColor: dark ? '#2D2A26' : '#FFFFFF' }} />
          ))}
        </View>
      ))}
    </View>
  );
}
