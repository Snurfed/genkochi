import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../src/constants/design';
import { useTranslations } from '../../src/hooks/useTranslations';

export default function TabLayout() {
  const t = useTranslations();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      {/* Camera - The Home Screen */}
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.camera,
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIcon : undefined}>
              <Ionicons
                name={focused ? 'camera' : 'camera-outline'}
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />

      {/* Map - Photo locations */}
      <Tabs.Screen
        name="review"
        options={{
          title: t.tabs.map,
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIcon : undefined}>
              <Ionicons
                name={focused ? 'map' : 'map-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />

      {/* Progress - Streak, stats, skills */}
      <Tabs.Screen
        name="progress"
        options={{
          title: t.tabs.progress,
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIcon : undefined}>
              <Ionicons
                name={focused ? 'stats-chart' : 'stats-chart-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />

      {/* Profile - Settings */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabs.profile,
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeIcon : undefined}>
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />

      {/* Hidden legacy tabs */}
      <Tabs.Screen name="practice" options={{ href: null }} />
      <Tabs.Screen name="phrases" options={{ href: null }} />
      <Tabs.Screen name="brain" options={{ href: null }} />
      <Tabs.Screen name="collection" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.white,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 85,
    paddingTop: 8,
    paddingBottom: 25,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  activeIcon: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    padding: 6,
    borderRadius: 10,
  },
  inactiveIcon: {
    opacity: 0.4,
  },
});
