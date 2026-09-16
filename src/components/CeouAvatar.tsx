import { Text, View } from 'react-native';

/** Local Céoù smile: works offline and with the existing native build. */
export function CeouAvatar({ size = 80 }: { size?: number }) {
  return <View aria-hidden accessibilityElementsHidden accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#0B689F', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    <View style={{ position: 'absolute', width: size * .86, height: size * .86, borderRadius: size, backgroundColor: '#117CB7' }} />
    <Text allowFontScaling={false} style={{ color: '#fff', fontSize: size * .25, fontWeight: '800', marginTop: -size * .1 }}>Céoù</Text>
    <View style={{ width: size * .4, height: size * .2, borderBottomWidth: size * .05, borderColor: '#fff', borderBottomLeftRadius: size * .25, borderBottomRightRadius: size * .25 }} />
    {[.2, .72].map(left => <View key={left} style={{ position: 'absolute', left: size * left, top: size * .55, width: size * .08, height: size * .08, borderRadius: size, backgroundColor: '#9DDDFA' }} />)}
  </View>;
}
