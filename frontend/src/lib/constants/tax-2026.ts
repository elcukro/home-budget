/**
 * Polish Tax Constants for 2026
 * Updated: 2026-01-15
 *
 * Sources:
 * - MF (Ministry of Finance) announcements
 * - ZUS official rates
 * - KNF limits for IKE/IKZE/PPK
 */

// === III FILAR (Retirement Savings) ===
export const IKE_LIMIT_2026 = 28_260;  // No Belka tax on gains
export const IKZE_LIMIT_2026_STANDARD = 11_304;  // Tax deductible
export const IKZE_LIMIT_2026_JDG = 16_956;  // Higher limit for self-employed
export const OIPE_LIMIT_2026 = 28_260;  // Pan-European personal pension

// === PPK (Employee Capital Plans) ===
export const PPK_EMPLOYEE_MIN = 0.005;  // 0.5% minimum
export const PPK_EMPLOYEE_DEFAULT = 0.02;  // 2% default
export const PPK_EMPLOYEE_MAX = 0.04;  // 4% maximum
export const PPK_EMPLOYER_MIN = 0.015;  // 1.5% minimum
export const PPK_EMPLOYER_MAX = 0.04;  // 4% maximum
export const PPK_STATE_ANNUAL = 240;  // State contribution per year
export const PPK_STATE_WELCOME = 250;  // One-time welcome bonus

// === Tax Rates ===
export const TAX_FREE_AMOUNT = 30_000;  // Kwota wolna od podatku
export const TAX_THRESHOLD = 120_000;  // Second bracket threshold
export const TAX_RELIEF_AMOUNT = 3_600;  // Kwota zmniejszająca podatek
export const TAX_RATE_12 = 0.12;  // First bracket
export const TAX_RATE_32 = 0.32;  // Second bracket
export const LINEAR_TAX_RATE = 0.19;  // Podatek liniowy
export const CAPITAL_GAINS_TAX = 0.19;  // Podatek Belki

// === ZUS Contributions (Employee - UoP) ===
export const ZUS_PENSION = 0.0976;  // Emerytalne
export const ZUS_DISABILITY = 0.015;  // Rentowe
export const ZUS_SICKNESS = 0.0245;  // Chorobowe
export const ZUS_HEALTH_SCALE = 0.09;  // Zdrowotna (skala)
export const ZUS_HEALTH_LINEAR = 0.049;  // Zdrowotna (liniowy)

// === ZUS for JDG (Self-Employed) ===
export const ZUS_JDG_FULL_2026 = {
  pension: 1_209.98,  // Emerytalne
  disability: 496.54,  // Rentowe
  sickness: 152.26,  // Chorobowe (dobrowolne)
  accident: 20.37,  // Wypadkowe (zależy od branży)
  labor_fund: 152.26,  // Fundusz Pracy
  total_without_health: 2_031.41,  // Razem bez zdrowotnej
};

// === Child Tax Relief (Ulga na dziecko) ===
export const CHILD_RELIEF_1ST = 1_112.04;  // First child
export const CHILD_RELIEF_2ND = 1_112.04;  // Second child
export const CHILD_RELIEF_3RD = 2_000.04;  // Third child
export const CHILD_RELIEF_4TH_PLUS = 2_700.00;  // Fourth and subsequent

// === Youth Tax Relief (Ulga dla młodych) ===
export const YOUNG_RELIEF_AGE_LIMIT = 26;
export const YOUNG_RELIEF_INCOME_LIMIT = 85_528;

// === KUP (Tax Deductible Costs) ===
export const KUP_STANDARD = 0.20;  // 20% standard
export const KUP_AUTHOR = 0.50;  // 50% for authors/creators

// === Family Benefits ===
export const CHILD_BENEFIT_800_PLUS = 800;  // Per child per month
export const CHILD_BENEFIT_INCOME_THRESHOLD = 1_922;  // Per person threshold

// === Minimum Wage ===
export const MINIMUM_WAGE_2026 = 4_806;  // Gross
export const PPK_REDUCED_CONTRIBUTION_THRESHOLD = 5_767.20;  // 120% of min wage

// === Helper Functions ===

/**
 * Calculate child tax relief based on number of children
 */
export function calculateChildTaxRelief(childrenCount: number): number {
  if (childrenCount <= 0) return 0;
  if (childrenCount === 1) return CHILD_RELIEF_1ST;
  if (childrenCount === 2) return CHILD_RELIEF_1ST + CHILD_RELIEF_2ND;
  if (childrenCount === 3) return CHILD_RELIEF_1ST + CHILD_RELIEF_2ND + CHILD_RELIEF_3RD;
  return CHILD_RELIEF_1ST + CHILD_RELIEF_2ND + CHILD_RELIEF_3RD +
         (childrenCount - 3) * CHILD_RELIEF_4TH_PLUS;
}

/**
 * Get IKZE limit based on employment type
 */
export function getIKZELimit(employmentType: string): number {
  if (employmentType === 'business' || employmentType === 'b2b') {
    return IKZE_LIMIT_2026_JDG;
  }
  return IKZE_LIMIT_2026_STANDARD;
}

/**
 * Calculate health insurance contribution for JDG
 */
export function calculateHealthContribution(
  taxForm: 'scale' | 'linear' | 'lumpsum',
  monthlyIncome: number
): number {
  if (taxForm === 'scale') return monthlyIncome * ZUS_HEALTH_SCALE;
  if (taxForm === 'linear') return monthlyIncome * ZUS_HEALTH_LINEAR;
  // Ryczałt has fixed amounts based on income brackets
  return 0;
}

/**
 * Check if user is eligible for youth tax relief
 */
export function isEligibleForYouthRelief(birthDate: Date): boolean {
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ? age - 1
    : age;
  return actualAge < YOUNG_RELIEF_AGE_LIMIT;
}

/**
 * Calculate annual PPK employer contribution
 */
export function calculatePPKEmployerContribution(
  annualGrossSalary: number,
  employerRate: number = PPK_EMPLOYER_MIN
): number {
  return annualGrossSalary * employerRate + PPK_STATE_ANNUAL;
}
