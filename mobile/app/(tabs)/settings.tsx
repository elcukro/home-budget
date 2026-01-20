import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  TextInput,
  Modal,
  Pressable,
  Image,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import { useApi } from '@/hooks/useApi';

// ============== Types ==============

interface UserSettings {
  language: string;
  currency: string;
  emergency_fund_target: number;
  emergency_fund_months: number;
  employment_status: string | null;
  tax_form: string | null;
  birth_year: number | null;
  children_count: number;
}

interface SubscriptionStatus {
  status: string;
  plan_type: string;
  is_premium: boolean;
  is_trial: boolean;
  trial_days_left: number | null;
  is_lifetime: boolean;
}

// ============== Constants ==============

const LANGUAGES = [
  { code: 'pl', label: 'Polski' },
  { code: 'en', label: 'English' },
];

const CURRENCIES = [
  { code: 'PLN', label: 'PLN (zł)' },
  { code: 'EUR', label: 'EUR (€)' },
  { code: 'USD', label: 'USD ($)' },
];

const EMPLOYMENT_STATUSES = [
  { code: 'employee', label: 'Pracownik etatowy' },
  { code: 'b2b', label: 'B2B / Samozatrudnienie' },
  { code: 'contract', label: 'Umowa zlecenie / o dzieło' },
  { code: 'freelancer', label: 'Freelancer' },
  { code: 'business', label: 'Własna działalność' },
  { code: 'unemployed', label: 'Bez zatrudnienia' },
];

const TAX_FORMS = [
  { code: 'scale', label: 'Skala podatkowa (12%/32%)' },
  { code: 'linear', label: 'Podatek liniowy (19%)' },
  { code: 'lumpsum', label: 'Ryczałt' },
  { code: 'card', label: 'Karta podatkowa' },
];

const MOCK_SETTINGS: UserSettings = {
  language: 'pl',
  currency: 'PLN',
  emergency_fund_target: 4000,
  emergency_fund_months: 6,
  employment_status: 'employee',
  tax_form: 'scale',
  birth_year: 1990,
  children_count: 2,
};

const MOCK_SUBSCRIPTION: SubscriptionStatus = {
  status: 'trialing',
  plan_type: 'trial',
  is_premium: false,
  is_trial: true,
  trial_days_left: 5,
  is_lifetime: false,
};

// ============== Components ==============

interface SettingRowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  danger?: boolean;
  children?: React.ReactNode;
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
  showChevron = false,
  danger = false,
  children,
}: SettingRowProps) {
  const content = (
    <View style={styles.settingRow}>
      <View style={[styles.settingIcon, danger && styles.settingIconDanger]}>
        <Ionicons
          name={icon as any}
          size={20}
          color={danger ? '#ef4444' : '#6b7280'}
        />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, danger && styles.settingLabelDanger]}>
          {label}
        </Text>
        {children ? (
          children
        ) : value ? (
          <Text style={styles.settingValue}>{value}</Text>
        ) : null}
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

interface PickerModalProps {
  visible: boolean;
  title: string;
  options: Array<{ code: string; label: string }>;
  selectedValue: string | null;
  onSelect: (code: string) => void;
  onClose: () => void;
}

function PickerModal({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: PickerModalProps) {
  // Find initial index to scroll to selected item
  const selectedIndex = options.findIndex((o) => o.code === selectedValue);
  const initialIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const renderItem = ({ item }: { item: { code: string; label: string } }) => (
    <TouchableOpacity
      style={[
        styles.modalOption,
        selectedValue === item.code && styles.modalOptionSelected,
      ]}
      onPress={() => {
        onSelect(item.code);
        onClose();
      }}
    >
      <Text
        style={[
          styles.modalOptionText,
          selectedValue === item.code && styles.modalOptionTextSelected,
        ]}
      >
        {item.label}
      </Text>
      {selectedValue === item.code && (
        <Ionicons name="checkmark" size={20} color="#f97316" />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            renderItem={renderItem}
            keyExtractor={(item) => item.code}
            style={styles.modalOptions}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, index) => ({
              length: 56, // Height of each item (padding 16 * 2 + text ~24)
              offset: 56 * index,
              index,
            })}
            bounces={false}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ============== Main Component ==============

export default function SettingsScreen() {
  const router = useRouter();
  const { user, token, signOut } = useAuthStore();
  const api = useApi();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Picker modals
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const isDevMode = token === 'dev-token-for-testing';

  // Fetch settings and subscription
  const fetchData = useCallback(async () => {
    if (!user?.email || !api) return;

    if (isDevMode) {
      setSettings(MOCK_SETTINGS);
      setSubscription(MOCK_SUBSCRIPTION);
      setIsLoading(false);
      return;
    }

    try {
      const [settingsData, subscriptionData] = await Promise.all([
        api.settings.get(user.email),
        api.subscription.getStatus(user.email).catch((err) => {
          console.error('Failed to fetch subscription:', err);
          return null;
        }),
      ]);

      console.log('Subscription data:', subscriptionData);

      setSettings({
        language: settingsData.language,
        currency: settingsData.currency,
        emergency_fund_target: settingsData.emergency_fund_target,
        emergency_fund_months: settingsData.emergency_fund_months,
        employment_status: settingsData.employment_status,
        tax_form: settingsData.tax_form,
        birth_year: settingsData.birth_year,
        children_count: settingsData.children_count,
      });

      if (subscriptionData) {
        setSubscription(subscriptionData);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      // Fallback to mock data on error
      setSettings(MOCK_SETTINGS);
      setSubscription(MOCK_SUBSCRIPTION);
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, api, isDevMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update settings
  const updateSetting = async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    if (!settings || !user?.email || !api || isDevMode) {
      setSettings((prev) => (prev ? { ...prev, [key]: value } : null));
      return;
    }

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setIsSaving(true);

    try {
      // Backend requires full settings object (language and currency are required)
      await api.settings.update(user.email, {
        language: newSettings.language,
        currency: newSettings.currency,
        emergency_fund_target: newSettings.emergency_fund_target,
        emergency_fund_months: newSettings.emergency_fund_months,
        employment_status: newSettings.employment_status,
        tax_form: newSettings.tax_form,
        birth_year: newSettings.birth_year,
        children_count: newSettings.children_count,
      });
    } catch (err) {
      console.error('Failed to update setting:', err);
      // Revert on error
      setSettings(settings);
      Alert.alert('Błąd', 'Nie udało się zapisać ustawienia');
    } finally {
      setIsSaving(false);
    }
  };

  // Sign out
  const handleSignOut = () => {
    Alert.alert('Wyloguj', 'Czy na pewno chcesz się wylogować?', [
      { text: 'Anuluj', style: 'cancel' },
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
    ]);
  };

  // Get label for code
  const getLabel = (
    options: Array<{ code: string; label: string }>,
    code: string | null
  ) => {
    if (!code) return 'Nie wybrano';
    return options.find((o) => o.code === code)?.label || code;
  };

  // Get subscription badge
  const getSubscriptionBadge = () => {
    if (!subscription) return { label: 'Free', color: '#6b7280', bg: '#ffffff', border: '#e5e7eb' };

    // Paid plans - green background
    if (subscription.is_lifetime) {
      return { label: 'Lifetime', color: '#15803d', bg: '#dcfce7', border: '#bbf7d0' };
    }
    if (subscription.is_premium) {
      // Monthly or Annual paid plan
      const planLabel = subscription.plan_type === 'annual' ? 'Roczny' : 'Miesięczny';
      return { label: planLabel, color: '#15803d', bg: '#dcfce7', border: '#bbf7d0' };
    }
    if (subscription.is_trial && subscription.trial_days_left) {
      return {
        label: `Trial (${subscription.trial_days_left} dni)`,
        color: '#0ea5e9',
        bg: '#e0f2fe',
        border: '#bae6fd',
      };
    }
    return { label: 'Free', color: '#6b7280', bg: '#ffffff', border: '#e5e7eb' };
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  const badge = getSubscriptionBadge();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        {user?.photoUrl ? (
          <Image
            source={{ uri: user.photoUrl }}
            style={styles.profileAvatarImage}
          />
        ) : (
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
        )}
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name || 'Użytkownik'}</Text>
          <Text style={styles.profileEmail}>{user?.email || ''}</Text>
        </View>
        <View style={[styles.subscriptionBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
          <Text style={[styles.subscriptionBadgeText, { color: badge.color }]}>
            {badge.label}
          </Text>
        </View>
      </View>

      {/* Saving indicator */}
      {isSaving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color="#f97316" />
          <Text style={styles.savingText}>Zapisywanie...</Text>
        </View>
      )}

      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profil</Text>
        <View style={styles.sectionContent}>
          <SettingRow
            icon="calendar-outline"
            label="Rok urodzenia"
            value={settings?.birth_year?.toString() || 'Nie podano'}
            onPress={() => setActiveModal('birth_year')}
            showChevron
          />
          <SettingRow
            icon="people-outline"
            label="Liczba dzieci"
            value={settings?.children_count?.toString() || '0'}
            onPress={() => setActiveModal('children_count')}
            showChevron
          />
        </View>
      </View>

      {/* Preferences Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferencje</Text>
        <View style={styles.sectionContent}>
          <SettingRow
            icon="globe-outline"
            label="Język"
            value={getLabel(LANGUAGES, settings?.language || null)}
            onPress={() => setActiveModal('language')}
            showChevron
          />
          <SettingRow
            icon="wallet-outline"
            label="Waluta"
            value={getLabel(CURRENCIES, settings?.currency || null)}
            onPress={() => setActiveModal('currency')}
            showChevron
          />
        </View>
      </View>

      {/* Tax Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profil podatkowy</Text>
        <View style={styles.sectionContent}>
          <SettingRow
            icon="briefcase-outline"
            label="Status zatrudnienia"
            value={getLabel(EMPLOYMENT_STATUSES, settings?.employment_status || null)}
            onPress={() => setActiveModal('employment_status')}
            showChevron
          />
          <SettingRow
            icon="document-text-outline"
            label="Forma opodatkowania"
            value={getLabel(TAX_FORMS, settings?.tax_form || null)}
            onPress={() => setActiveModal('tax_form')}
            showChevron
          />
        </View>
      </View>

      {/* Finance Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Finanse</Text>
        <View style={styles.sectionContent}>
          <SettingRow
            icon="shield-checkmark-outline"
            label="Początkowy fundusz awaryjny"
          >
            <View style={styles.inputRow}>
              <TextInput
                style={styles.numberInput}
                value={settings?.emergency_fund_target?.toString() || ''}
                onChangeText={(text) => {
                  const num = parseInt(text, 10);
                  if (!isNaN(num) || text === '') {
                    setSettings((prev) =>
                      prev
                        ? { ...prev, emergency_fund_target: num || 0 }
                        : null
                    );
                  }
                }}
                onBlur={() =>
                  updateSetting(
                    'emergency_fund_target',
                    settings?.emergency_fund_target || 1000
                  )
                }
                keyboardType="numeric"
                placeholder="1000"
              />
              <Text style={styles.inputSuffix}>PLN</Text>
            </View>
          </SettingRow>
          <SettingRow
            icon="time-outline"
            label="Miesiące pełnego funduszu"
          >
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => {
                  const newVal = Math.max(1, (settings?.emergency_fund_months || 3) - 1);
                  updateSetting('emergency_fund_months', newVal);
                }}
              >
                <Ionicons name="remove" size={20} color="#6b7280" />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>
                {settings?.emergency_fund_months || 3}
              </Text>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => {
                  const newVal = Math.min(12, (settings?.emergency_fund_months || 3) + 1);
                  updateSetting('emergency_fund_months', newVal);
                }}
              >
                <Ionicons name="add" size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </SettingRow>
        </View>
      </View>

      {/* Legal Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informacje prawne</Text>
        <View style={styles.sectionContent}>
          <SettingRow
            icon="document-outline"
            label="Regulamin"
            onPress={() => Linking.openURL('https://firedup.app/terms')}
            showChevron
          />
          <SettingRow
            icon="shield-outline"
            label="Polityka prywatności"
            onPress={() => Linking.openURL('https://firedup.app/privacy')}
            showChevron
          />
        </View>
      </View>

      {/* Sign Out */}
      <View style={styles.section}>
        <View style={styles.sectionContent}>
          <SettingRow
            icon="log-out-outline"
            label="Wyloguj się"
            onPress={handleSignOut}
            danger
          >
            {isSigningOut && (
              <ActivityIndicator size="small" color="#ef4444" />
            )}
          </SettingRow>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>FiredUp v1.0.0</Text>
        <Text style={styles.footerText}>Twoje finanse pod kontrolą 🔥</Text>
      </View>

      {/* Picker Modals */}
      <PickerModal
        visible={activeModal === 'language'}
        title="Wybierz język"
        options={LANGUAGES}
        selectedValue={settings?.language || null}
        onSelect={(code) => updateSetting('language', code)}
        onClose={() => setActiveModal(null)}
      />

      <PickerModal
        visible={activeModal === 'currency'}
        title="Wybierz walutę"
        options={CURRENCIES}
        selectedValue={settings?.currency || null}
        onSelect={(code) => updateSetting('currency', code)}
        onClose={() => setActiveModal(null)}
      />

      <PickerModal
        visible={activeModal === 'employment_status'}
        title="Status zatrudnienia"
        options={EMPLOYMENT_STATUSES}
        selectedValue={settings?.employment_status || null}
        onSelect={(code) => updateSetting('employment_status', code)}
        onClose={() => setActiveModal(null)}
      />

      <PickerModal
        visible={activeModal === 'tax_form'}
        title="Forma opodatkowania"
        options={TAX_FORMS}
        selectedValue={settings?.tax_form || null}
        onSelect={(code) => updateSetting('tax_form', code)}
        onClose={() => setActiveModal(null)}
      />

      <PickerModal
        visible={activeModal === 'birth_year'}
        title="Rok urodzenia"
        options={Array.from({ length: 80 }, (_, i) => {
          const year = new Date().getFullYear() - 18 - i;
          return { code: String(year), label: String(year) };
        })}
        selectedValue={settings?.birth_year ? String(settings.birth_year) : null}
        onSelect={(code) => updateSetting('birth_year', parseInt(code, 10))}
        onClose={() => setActiveModal(null)}
      />

      <PickerModal
        visible={activeModal === 'children_count'}
        title="Liczba dzieci"
        options={Array.from({ length: 11 }, (_, i) => ({
          code: String(i),
          label: i === 0 ? 'Brak' : String(i),
        }))}
        selectedValue={String(settings?.children_count ?? 0)}
        onSelect={(code) => updateSetting('children_count', parseInt(code, 10))}
        onClose={() => setActiveModal(null)}
      />
    </ScrollView>
  );
}

// ============== Styles ==============

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Profile Card
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  profileAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 14,
  },
  profileAvatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
    color: '#6b7280',
  },
  subscriptionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  subscriptionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Saving Indicator
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    marginBottom: 16,
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    gap: 8,
  },
  savingText: {
    fontSize: 13,
    color: '#f97316',
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 10,
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

  // Setting Row
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingIconDanger: {
    backgroundColor: '#fef2f2',
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
  },
  settingLabelDanger: {
    color: '#ef4444',
  },
  settingValue: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },

  // Input Row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  numberInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
    minWidth: 80,
    textAlign: 'right',
  },
  inputSuffix: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 8,
  },

  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginHorizontal: 16,
    minWidth: 24,
    textAlign: 'center',
  },

  // Footer
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

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  modalOptions: {
    padding: 8,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    height: 56, // Fixed height for FlatList getItemLayout
  },
  modalOptionSelected: {
    backgroundColor: '#fff7ed',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#1f2937',
  },
  modalOptionTextSelected: {
    color: '#f97316',
    fontWeight: '600',
  },
});
