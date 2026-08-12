import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon';

// Sous-ensemble minimal de BottomTabBarProps (React Navigation) — on ne
// dépend que de state/descriptors/navigation.navigate/navigation.emit,
// donc pas besoin d'importer les types internes d'expo-router.
type TabBarState = { index: number; routes: { key: string; name: string }[] };
type TabBarDescriptor = { options: { title?: string } };
type TabBarNavigation = {
  navigate: (name: string) => void;
  emit: (event: { type: string; target: string; canPreventDefault?: boolean }) => { defaultPrevented: boolean };
};

export type AppTabBarProps = {
  state: TabBarState;
  descriptors: Record<string, TabBarDescriptor>;
  navigation: TabBarNavigation;
};

const TAB_ICONS: Record<string, IconName> = {
  index: 'home',
  profile: 'profile',
};

export function AppTabBar({ state, descriptors, navigation }: AppTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="absolute left-6 right-6" style={{ bottom: insets.bottom + 12 }}>
      <View className="h-16 flex-row items-center rounded-full bg-white px-2 shadow-lg">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused ? '#FF6B4A' : '#A39C8F';

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Pressable key={route.key} onPress={onPress} className="flex-1 items-center justify-center py-2">
              <Icon name={TAB_ICONS[route.name] ?? 'home'} size={22} color={color} />
              <Text className="mt-0.5 text-xs font-medium" style={{ color }}>
                {options.title}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => router.push('/habitations?create=1')}
        className="absolute self-center active:opacity-85"
        style={{ top: -22 }}
      >
        <LinearGradient
          colors={['#FF6B4A', '#FFC857']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 6,
            shadowColor: '#2D2A26',
            shadowOpacity: 0.25,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 8,
          }}
        >
          <Icon name="add" size={26} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}
