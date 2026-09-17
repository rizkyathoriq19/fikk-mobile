import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text } from 'react-native';
import type { ColorValue } from 'react-native';

const tabSymbols = {
  home: { ios: 'house.fill', android: 'home', fallback: '⌂' },
  history: { ios: 'clock.fill', android: 'history', fallback: '◷' },
  settings: { ios: 'gearshape.fill', android: 'settings', fallback: '⚙' },
} as const;

type TabName = keyof typeof tabSymbols;

function TabIcon({ name, color }: { name: TabName; color: ColorValue }) {
  const symbol = tabSymbols[name];
  return (
    <SymbolView
      fallback={<Text style={[styles.fallbackIcon, { color }]}>{symbol.fallback}</Text>}
      name={{ ios: symbol.ios, android: symbol.android }}
      size={22}
      tintColor={color}
      weight="medium"
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2457d6',
        tabBarInactiveTintColor: '#60708c',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        tabBarStyle: { borderTopColor: '#d9e2f0', backgroundColor: '#ffffff' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarLabel: 'Home', tabBarIcon: ({ color }) => <TabIcon color={color} name="home" /> }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarLabel: 'History', tabBarIcon: ({ color }) => <TabIcon color={color} name="history" /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarLabel: 'Settings', tabBarIcon: ({ color }) => <TabIcon color={color} name="settings" /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fallbackIcon: { fontSize: 22, lineHeight: 22, textAlign: 'center' },
});
