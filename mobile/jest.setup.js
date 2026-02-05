// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock expo-local-authentication
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  supportedAuthenticationTypesAsync: jest.fn().mockResolvedValue([1]),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  LocalAuthenticationError: {
    UserCancel: 'user_cancel',
    UserFallback: 'user_fallback',
    SystemCancel: 'system_cancel',
    NotEnrolled: 'not_enrolled',
    PasscodeNotSet: 'passcode_not_set',
    BiometryNotAvailable: 'biometry_not_available',
    BiometryNotEnrolled: 'biometry_not_enrolled',
    BiometryLockout: 'biometry_lockout',
  },
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  Redirect: jest.fn(({ href }) => null),
  Stack: Object.assign(jest.fn(({ children }) => children), {
    Screen: jest.fn(() => null),
  }),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
  SafeAreaProvider: jest.fn(({ children }) => children),
}));

// Mock @react-native-google-signin/google-signin
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    getCurrentUser: jest.fn().mockResolvedValue(null),
    revokeAccess: jest.fn(),
    signOut: jest.fn(),
  },
}));

// Mock image requires
jest.mock('@/assets/illustrations/onboarding/onboarding-welcome.png', () => 'mock-image', { virtual: true });
jest.mock('@/assets/illustrations/hello-welcome.png', () => 'mock-image', { virtual: true });
jest.mock('@/assets/illustrations/hello-streaks.png', () => 'mock-image', { virtual: true });
jest.mock('@/assets/illustrations/hello-badges.png', () => 'mock-image', { virtual: true });
jest.mock('@/assets/illustrations/hello-fire-roadmap.png', () => 'mock-image', { virtual: true });
jest.mock('@/assets/illustrations/hello-nextsteps.png', () => 'mock-image', { virtual: true });

// Mock Mascot component
jest.mock('@/components/Mascot', () => {
  const { View } = require('react-native');
  return function MockMascot() {
    return View;
  };
});

// Mock OnboardingProgressBar
jest.mock('@/components/onboarding/OnboardingProgressBar', () => {
  const { View, Text } = require('react-native');
  return function MockProgressBar({ currentStep, totalSteps }) {
    return null;
  };
});
