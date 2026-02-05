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
  lastUpdated: '5 lutego 2026',
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
 * Detailed information required for Tink certification.
 */
export const DATA_RETENTION = {
  // User account data
  accountData: 'Do momentu usunięcia konta przez użytkownika',

  // Manually entered financial data (expenses, incomes, loans, goals)
  financialData: 'Do momentu usunięcia konta lub na żądanie użytkownika',

  // Raw banking data from Tink (accounts, transactions, balances)
  bankingData:
    'Dane o kontach i transakcjach bankowych są przechowywane do momentu rozłączenia banku lub usunięcia konta. Po rozłączeniu banku surowe dane bankowe są usuwane w ciągu 30 dni.',

  // Processed transactions (expenses/incomes created from bank data)
  processedBankingData:
    'Wydatki i przychody utworzone automatycznie z transakcji bankowych pozostają do momentu ręcznego usunięcia przez użytkownika lub usunięcia konta.',

  // Tink access tokens (short-lived)
  tinkAccessTokens: 'Tokeny dostępu: maksymalnie 1 godzina, automatycznie wygasają.',

  // Tink refresh tokens (longer-lived)
  tinkRefreshTokens:
    'Tokeny odświeżające: do 90 dni lub do momentu rozłączenia banku przez użytkownika.',

  // Audit logs for Tink operations (security and troubleshooting)
  tinkAuditLogs:
    'Logi operacji bankowych (synchronizacje, błędy, zmiany połączeń): 12 miesięcy dla celów bezpieczeństwa i rozwiązywania problemów.',

  // Analytics data
  analyticsData: '24 miesiące od ostatniej aktywności użytkownika',

  // Data deletion timeline after user request
  deletionTimeline:
    'Dane są usuwane w ciągu 30 dni od otrzymania żądania usunięcia, zgodnie z Art. 17 RODO.',
} as const;
