/**
 * Category configuration with emoji, colors, and Polish labels
 * Inspired by YNAB's colorful category display
 */

export interface CategoryConfig {
  emoji: string;
  icon: string;           // Ionicons name for fallback
  backgroundColor: string; // Light background color
  textColor: string;      // Text/icon color
  label: string;          // Polish label
}

export const CATEGORIES: Record<string, CategoryConfig> = {
  // Housing & Living
  housing: {
    emoji: '🏠',
    icon: 'home',
    backgroundColor: '#f3e8ff',
    textColor: '#8b5cf6',
    label: 'Mieszkanie',
  },
  utilities: {
    emoji: '💧',
    icon: 'flash',
    backgroundColor: '#fef9c3',
    textColor: '#eab308',
    label: 'Media / Rachunki',
  },
  media: {
    emoji: '📺',
    icon: 'tv',
    backgroundColor: '#e0f2fe',
    textColor: '#06b6d4',
    label: 'Media',
  },

  // Food & Dining
  food: {
    emoji: '🍕',
    icon: 'restaurant',
    backgroundColor: '#fff7ed',
    textColor: '#f97316',
    label: 'Jedzenie na mieście',
  },
  groceries: {
    emoji: '🛒',
    icon: 'cart',
    backgroundColor: '#fef3c7',
    textColor: '#d97706',
    label: 'Zakupy spożywcze',
  },

  // Transportation
  transport: {
    emoji: '🚗',
    icon: 'car',
    backgroundColor: '#dbeafe',
    textColor: '#3b82f6',
    label: 'Transport',
  },

  // Entertainment & Lifestyle
  entertainment: {
    emoji: '🎬',
    icon: 'game-controller',
    backgroundColor: '#fce7f3',
    textColor: '#ec4899',
    label: 'Rozrywka',
  },
  subscriptions: {
    emoji: '📱',
    icon: 'repeat',
    backgroundColor: '#e0e7ff',
    textColor: '#6366f1',
    label: 'Subskrypcje',
  },

  // Health & Wellness
  healthcare: {
    emoji: '💊',
    icon: 'heart',
    backgroundColor: '#fee2e2',
    textColor: '#ef4444',
    label: 'Opieka Zdrowotna',
  },

  // Education
  education: {
    emoji: '📚',
    icon: 'school',
    backgroundColor: '#d1fae5',
    textColor: '#10b981',
    label: 'Edukacja',
  },

  // Shopping & Personal
  clothing: {
    emoji: '👕',
    icon: 'shirt',
    backgroundColor: '#ede9fe',
    textColor: '#a855f7',
    label: 'Ubrania',
  },
  personal: {
    emoji: '🧴',
    icon: 'person',
    backgroundColor: '#f1f5f9',
    textColor: '#64748b',
    label: 'Osobiste',
  },

  // Family
  kids: {
    emoji: '👶',
    icon: 'people',
    backgroundColor: '#fae8ff',
    textColor: '#a855f7',
    label: 'Dzieci',
  },
  pets: {
    emoji: '🐕',
    icon: 'paw',
    backgroundColor: '#ffedd5',
    textColor: '#ea580c',
    label: 'Zwierzęta',
  },

  // Financial
  savings: {
    emoji: '💰',
    icon: 'wallet',
    backgroundColor: '#dcfce7',
    textColor: '#22c55e',
    label: 'Oszczędności',
  },
  insurance: {
    emoji: '🛡️',
    icon: 'shield-checkmark',
    backgroundColor: '#e0f2fe',
    textColor: '#0ea5e9',
    label: 'Ubezpieczenia',
  },

  // Other
  other: {
    emoji: '📦',
    icon: 'ellipsis-horizontal-circle',
    backgroundColor: '#f3f4f6',
    textColor: '#6b7280',
    label: 'Inne',
  },

  // Default fallback
  default: {
    emoji: '📝',
    icon: 'pricetag',
    backgroundColor: '#f3f4f6',
    textColor: '#6b7280',
    label: 'Inne',
  },

  // Polish labels (for backward compatibility)
  'Rozrywka': {
    emoji: '🎬',
    icon: 'game-controller',
    backgroundColor: '#fce7f3',
    textColor: '#ec4899',
    label: 'Rozrywka',
  },
  'Żywność': {
    emoji: '🛒',
    icon: 'restaurant',
    backgroundColor: '#fff7ed',
    textColor: '#f97316',
    label: 'Żywność',
  },
  'Mieszkanie': {
    emoji: '🏠',
    icon: 'home',
    backgroundColor: '#f3e8ff',
    textColor: '#8b5cf6',
    label: 'Mieszkanie',
  },
  'Transport': {
    emoji: '🚗',
    icon: 'car',
    backgroundColor: '#dbeafe',
    textColor: '#3b82f6',
    label: 'Transport',
  },
  'Inne': {
    emoji: '📦',
    icon: 'ellipsis-horizontal-circle',
    backgroundColor: '#f3f4f6',
    textColor: '#6b7280',
    label: 'Inne',
  },
  'Media': {
    emoji: '📺',
    icon: 'tv',
    backgroundColor: '#e0f2fe',
    textColor: '#06b6d4',
    label: 'Media',
  },
  'Opieka Zdrowotna': {
    emoji: '💊',
    icon: 'heart',
    backgroundColor: '#fee2e2',
    textColor: '#ef4444',
    label: 'Opieka Zdrowotna',
  },
};

/**
 * Get category configuration, with fallback to default
 */
export function getCategoryConfig(category: string): CategoryConfig {
  return CATEGORIES[category] || CATEGORIES.default;
}

/**
 * Budget status types for progress bars
 */
export type BudgetStatus = 'funded' | 'partial' | 'overspent' | 'empty';

export interface StatusConfig {
  backgroundColor: string;
  textColor: string;
  label: string;
}

export const STATUS_CONFIG: Record<BudgetStatus, StatusConfig> = {
  funded: {
    backgroundColor: '#dcfce7',
    textColor: '#166534',
    label: 'Sfinansowane',
  },
  partial: {
    backgroundColor: '#fef9c3',
    textColor: '#854d0e',
    label: 'W trakcie',
  },
  overspent: {
    backgroundColor: '#fee2e2',
    textColor: '#991b1b',
    label: 'Przekroczono',
  },
  empty: {
    backgroundColor: '#f3f4f6',
    textColor: '#6b7280',
    label: 'Puste',
  },
};

/**
 * Calculate budget status based on spent vs budget
 */
export function getBudgetStatus(spent: number, budget: number): BudgetStatus {
  if (budget <= 0) return 'empty';
  const ratio = spent / budget;
  if (ratio > 1) return 'overspent';
  if (ratio >= 1) return 'funded';
  if (ratio > 0) return 'partial';
  return 'empty';
}
