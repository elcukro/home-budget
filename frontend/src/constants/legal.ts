/**
 * Legal entity information for FiredUp application.
 * Used in Privacy Policy, Terms of Service, and other legal documents.
 *
 * NOTE: Update these values with actual business registration data before commercial launch.
 */

export const LEGAL_ENTITY = {
  // Company/entity name (update with legal business name)
  name: 'FiredUp',

  // Full legal name for formal documents
  legalName: 'FiredUp Łukasz Górski',

  // Registered address (update with actual business address)
  address: {
    street: 'ul. Przykładowa 1/2',
    postalCode: '00-001',
    city: 'Warszawa',
    country: 'Polska',
  },

  // Tax identification number (NIP) - update with actual NIP
  nip: '1234567890',

  // Contact emails
  email: {
    privacy: 'privacy@firedup.app',
    contact: 'contact@firedup.app',
    support: 'support@firedup.app',
  },

  // Website
  website: 'https://firedup.app',

  // Last updated date for legal documents (update when documents change)
  lastUpdated: '4 lutego 2026',
} as const;

/**
 * Third-party data processors used by FiredUp.
 * Required for GDPR compliance disclosure.
 */
export const DATA_PROCESSORS = [
  {
    name: 'Tink AB',
    purpose: 'Agregacja danych bankowych (AISP)',
    location: 'Szwecja/UE',
    privacyPolicy: 'https://tink.com/legal/privacy-policy',
  },
  {
    name: 'Vercel Inc.',
    purpose: 'Hosting aplikacji webowej',
    location: 'USA (Privacy Shield)',
    privacyPolicy: 'https://vercel.com/legal/privacy-policy',
  },
  {
    name: 'PostHog Inc.',
    purpose: 'Analityka produktowa (opcjonalna)',
    location: 'USA/UE',
    privacyPolicy: 'https://posthog.com/privacy',
  },
  {
    name: 'Google LLC',
    purpose: 'Uwierzytelnianie (Google Sign-In)',
    location: 'USA (Privacy Shield)',
    privacyPolicy: 'https://policies.google.com/privacy',
  },
] as const;

/**
 * Data retention periods for GDPR compliance.
 */
export const DATA_RETENTION = {
  accountData: 'Do momentu usunięcia konta przez użytkownika',
  financialData: 'Do momentu usunięcia konta lub na żądanie użytkownika',
  bankingData: 'Przechowywane lokalnie, usuwane przy rozłączeniu konta bankowego',
  tinkTokens: 'Ważne do 90 dni, automatycznie odświeżane lub usuwane',
  analyticsData: '24 miesiące od ostatniej aktywności',
} as const;
