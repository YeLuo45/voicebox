import { Redirect, Tabs } from 'expo-router';
import { Mic, PenTool, Users } from 'lucide-react-native';
import { View } from 'react-native';
import { colors } from '@/lib/colors';
import { useSession } from '@/lib/session';

export default function TabsLayout() {
  const { session, hydrated } = useSession();

  // Wait for SecureStore hydration before deciding where to send the user.
  // Without this we'd briefly render the tabs against a null session and
  // every authenticated query would fire with no bearer.
  if (!hydrated) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }
  if (!session) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Captures',
          tabBarIcon: ({ color, size }) => <Mic size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="generate"
        options={{
          title: 'Generate',
          tabBarIcon: ({ color, size }) => <PenTool size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="voices"
        options={{
          title: 'Voices',
          tabBarIcon: ({ color, size }) => <Users size={size - 2} color={color} />,
        }}
      />
    </Tabs>
  );
}
