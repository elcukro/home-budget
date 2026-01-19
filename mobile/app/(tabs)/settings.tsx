import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth';

interface SettingItemProps {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
  danger?: boolean;
  rightElement?: React.ReactNode;
}

function SettingItem({
  icon,
  title,
  subtitle,
  onPress,
  showChevron = true,
  danger = false,
  rightElement,
}: SettingItemProps) {
  return (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View
        style={[
          styles.settingIcon,
          { backgroundColor: danger ? '#fef2f2' : '#f3f4f6' },
        ]}
      >
        <Ionicons
          name={icon as any}
          size={20}
          color={danger ? '#ef4444' : '#6b7280'}
        />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, danger && styles.settingTitleDanger]}>
          {title}
        </Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement}
      {showChevron && !rightElement && (
        <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut, isLoading } = useAuthStore();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = () => {
    Alert.alert(
      'Wyloguj',
      'Czy na pewno chcesz się wylogować?',
      [
        {
          text: 'Anuluj',
          style: 'cancel',
        },
        {
          text: 'Wyloguj',
          style: 'destructive',
          onPress: async () => {
            setIsSigningOut(true);
            try {
              await signOut();
              router.replace('/(auth)/sign-in');
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Błąd', 'Nie udało się wylogować');
            } finally {
              setIsSigningOut(false);
            }
          },
        },
      ]
    );
  };

  const handleNotImplemented = (feature: string) => {
    Alert.alert(
      'Wkrótce dostępne',
      `Funkcja "${feature}" będzie dostępna w przyszłych aktualizacjach.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Profile */}
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name || 'Użytkownik'}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
        </View>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Konto</Text>
        <View style={styles.sectionContent}>
          <SettingItem
            icon="person-outline"
            title="Profil"
            subtitle="Edytuj dane osobowe"
            onPress={() => handleNotImplemented('Profil')}
          />
          <SettingItem
            icon="wallet-outline"
            title="Waluta domyślna"
            subtitle="PLN"
            onPress={() => handleNotImplemented('Waluta domyślna')}
          />
          <SettingItem
            icon="business-outline"
            title="Połączone konta bankowe"
            subtitle="Zarządzaj połączeniami"
            onPress={() => handleNotImplemented('Konta bankowe')}
          />
        </View>
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferencje</Text>
        <View style={styles.sectionContent}>
          <SettingItem
            icon="notifications-outline"
            title="Powiadomienia"
            subtitle="Przypomnienia i alerty"
            onPress={() => handleNotImplemented('Powiadomienia')}
          />
          <SettingItem
            icon="moon-outline"
            title="Motyw"
            subtitle="Jasny"
            onPress={() => handleNotImplemented('Motyw')}
          />
          <SettingItem
            icon="language-outline"
            title="Język"
            subtitle="Polski"
            onPress={() => handleNotImplemented('Język')}
          />
        </View>
      </View>

      {/* Categories Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dane</Text>
        <View style={styles.sectionContent}>
          <SettingItem
            icon="pricetags-outline"
            title="Kategorie"
            subtitle="Zarządzaj kategoriami wydatków"
            onPress={() => handleNotImplemented('Kategorie')}
          />
          <SettingItem
            icon="download-outline"
            title="Eksportuj dane"
            subtitle="CSV, PDF"
            onPress={() => handleNotImplemented('Eksport danych')}
          />
        </View>
      </View>

      {/* Support Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pomoc</Text>
        <View style={styles.sectionContent}>
          <SettingItem
            icon="help-circle-outline"
            title="Centrum pomocy"
            onPress={() => handleNotImplemented('Centrum pomocy')}
          />
          <SettingItem
            icon="chatbubble-outline"
            title="Kontakt"
            onPress={() => handleNotImplemented('Kontakt')}
          />
          <SettingItem
            icon="document-text-outline"
            title="Regulamin"
            onPress={() => handleNotImplemented('Regulamin')}
          />
          <SettingItem
            icon="shield-checkmark-outline"
            title="Polityka prywatności"
            onPress={() => handleNotImplemented('Polityka prywatności')}
          />
        </View>
      </View>

      {/* Sign Out */}
      <View style={styles.section}>
        <View style={styles.sectionContent}>
          <SettingItem
            icon="log-out-outline"
            title="Wyloguj się"
            onPress={handleSignOut}
            showChevron={false}
            danger
            rightElement={
              isSigningOut ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : null
            }
          />
        </View>
      </View>

      {/* App Version */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>FiredUp v1.0.0</Text>
        <Text style={styles.footerText}>Twoje finanse pod kontrolą</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  settingTitleDanger: {
    color: '#ef4444',
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
});
