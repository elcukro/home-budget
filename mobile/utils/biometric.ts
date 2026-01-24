import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'biometric_auth_enabled';

export interface BiometricResult {
  success: boolean;
  error?: string;
}

export class BiometricAuth {
  static async isAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) return false;
      
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return isEnrolled;
    } catch {
      return false;
    }
  }

  static async getBiometricType(): Promise<'FaceID' | 'TouchID' | 'Biometric' | null> {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return 'FaceID';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return 'TouchID';
      }
      if (types.length > 0) {
        return 'Biometric';
      }
      return null;
    } catch {
      return null;
    }
  }

  static async isEnabled(): Promise<boolean> {
    try {
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch {
      return false;
    }
  }

  static async setEnabled(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
  }

  static async authenticate(reason?: string): Promise<BiometricResult> {
    try {
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        return { success: false, error: 'Biometric authentication not available' };
      }

      const isEnabled = await this.isEnabled();
      if (!isEnabled) {
        return { success: false, error: 'Biometric authentication not enabled' };
      }

      const biometricType = await this.getBiometricType();
      const promptMessage = reason || `Użyj ${biometricType === 'FaceID' ? 'Face ID' : biometricType === 'TouchID' ? 'Touch ID' : 'biometrii'} aby kontynuować`;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Anuluj',
        fallbackLabel: 'Użyj hasła',
        disableDeviceFallback: false,
      });

      if (result.success) {
        return { success: true };
      } else {
        let errorMessage = 'Uwierzytelnienie nie powiodło się';
        
        if (result.error) {
          switch (result.error) {
            case LocalAuthentication.LocalAuthenticationError.UserCancel:
              errorMessage = 'Anulowano przez użytkownika';
              break;
            case LocalAuthentication.LocalAuthenticationError.UserFallback:
              errorMessage = 'Wybrano alternatywną metodę';
              break;
            case LocalAuthentication.LocalAuthenticationError.SystemCancel:
              errorMessage = 'Anulowano przez system';
              break;
            case LocalAuthentication.LocalAuthenticationError.NotEnrolled:
              errorMessage = 'Biometria nie jest skonfigurowana';
              break;
            case LocalAuthentication.LocalAuthenticationError.PasscodeNotSet:
              errorMessage = 'Kod dostępu nie jest ustawiony';
              break;
            case LocalAuthentication.LocalAuthenticationError.BiometryNotAvailable:
              errorMessage = 'Biometria niedostępna';
              break;
            case LocalAuthentication.LocalAuthenticationError.BiometryNotEnrolled:
              errorMessage = 'Biometria nie jest zapisana';
              break;
            case LocalAuthentication.LocalAuthenticationError.BiometryLockout:
              errorMessage = 'Zbyt wiele prób';
              break;
          }
        }
        
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Nieznany błąd' 
      };
    }
  }

  static async authenticateForLogin(): Promise<BiometricResult> {
    return this.authenticate('Zaloguj się do FiredUp');
  }

  static async authenticateForSensitiveAction(action: string): Promise<BiometricResult> {
    return this.authenticate(`Potwierdź ${action}`);
  }
}