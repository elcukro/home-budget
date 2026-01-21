import { Tabs, Redirect, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { View, Text, Pressable } from 'react-native';

type TabButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
};

function TabButton({ icon, iconFocused, label, focused, onPress, onLongPress }: TabButtonProps) {
  const color = focused ? '#f97316' : '#6b7280';
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View style={{
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? '#e5e7eb' : 'transparent',
        borderRadius: 12,
        minWidth: 60,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}>
        <Ionicons name={focused ? iconFocused : icon} size={22} color={color} />
        <Text style={{ fontSize: 11, fontWeight: '500', color, marginTop: 2 }} numberOfLines={1}>{label}</Text>
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { isAuthenticated } = useAuthStore();
  const pathname = usePathname();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const isTabActive = (tabName: string) => {
    if (tabName === 'index') {
      return pathname === '/' || pathname === '/index';
    }
    return pathname === `/${tabName}` || pathname.startsWith(`/${tabName}/`);
  };

  return (
    <Tabs
      safeAreaInsets={{ bottom: 0, top: 0, left: 0, right: 0 }}
      screenOptions={{
        tabBarActiveTintColor: '#f97316', // Orange - FiredUp brand color
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          position: 'absolute',
          bottom: 24,
          left: 0,
          right: 0,
          marginHorizontal: 16,
          backgroundColor: '#ffffff',
          borderRadius: 20,
          height: 60,
          paddingTop: 0,
          paddingBottom: 0,
          paddingHorizontal: 0,
          borderTopWidth: 0,
          // Shadow
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 10,
        },
        tabBarItemStyle: {
          flex: 1,
          paddingVertical: 0,
          marginVertical: 0,
        },
        tabBarShowLabel: false,
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTitleStyle: {
          fontWeight: '600',
          color: '#1f2937',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarButton: (props) => (
            <TabButton
              icon="home-outline"
              iconFocused="home"
              label="Home"
              focused={isTabActive('index')}
              onPress={props.onPress}
              onLongPress={props.onLongPress}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Wydatki',
          tabBarButton: (props) => (
            <TabButton
              icon="list-outline"
              iconFocused="list"
              label="Wydatki"
              focused={isTabActive('transactions')}
              onPress={props.onPress}
              onLongPress={props.onLongPress}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="loans"
        options={{
          title: 'Kredyty',
          headerShown: false,
          tabBarButton: (props) => (
            <TabButton
              icon="card-outline"
              iconFocused="card"
              label="Kredyty"
              focused={isTabActive('loans')}
              onPress={props.onPress}
              onLongPress={props.onLongPress}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: 'Fire',
          tabBarButton: (props) => (
            <TabButton
              icon="flame-outline"
              iconFocused="flame"
              label="Fire"
              focused={isTabActive('goals')}
              onPress={props.onPress}
              onLongPress={props.onLongPress}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profil',
          tabBarButton: (props) => (
            <TabButton
              icon="person-outline"
              iconFocused="person"
              label="Profil"
              focused={isTabActive('settings')}
              onPress={props.onPress}
              onLongPress={props.onLongPress}
            />
          ),
        }}
      />
    </Tabs>
  );
}
