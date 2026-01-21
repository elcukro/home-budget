/**
 * Polish Tax Calculator for 2026
 *
 * Calculates net income from gross income considering:
 * - 50% KUP (Koszty Uzyskania Przychodu) - costs of obtaining revenue for creators
 * - Tax brackets (12% and 32%)
 * - Health insurance contributions
 * - Tax-free threshold (kwota wolna)
 *
 * Note: This is a simplified calculation and may not cover all edge cases.
 * For exact calculations, consult a tax advisor.
 */

// 2026 Polish Tax Constants
const TAX_CONSTANTS_2026 = {
  // 50% KUP annual limit
  KUP_50_ANNUAL_LIMIT: 120_000, // PLN per year

  // Tax brackets
  FIRST_BRACKET_LIMIT: 120_000, // PLN annual
  FIRST_BRACKET_RATE: 0.12, // 12%
  SECOND_BRACKET_RATE: 0.32, // 32%

  // Tax-free threshold (kwota wolna od podatku)
  TAX_FREE_THRESHOLD: 30_000, // PLN annual

  // Health insurance
  HEALTH_INSURANCE_RATE: 0.09, // 9%
  HEALTH_INSURANCE_DEDUCTIBLE_RATE: 0.0775, // 7.75% can be deducted from tax

  // Number of months
  MONTHS_PER_YEAR: 12,
};

interface TaxCalculationResult {
  grossAnnual: number;
  netAnnual: number;
  netMonthly: number;
  netMonthlyAverage: number; // Average considering tax bracket changes
  taxPaid: number;
  healthInsurance: number;
  kupDeducted: number;
  taxableIncome: number;
  inSecondBracket: boolean;
  secondBracketMonth: number | null; // Month when second bracket kicks in (1-12)
  effectiveTaxRate: number;
}

/**
 * Calculate net income from gross income with 50% KUP
 *
 * @param grossMonthly - Monthly gross income in PLN
 * @returns Detailed tax calculation result
 */
export function calculateNetIncomeWith50KUP(grossMonthly: number): TaxCalculationResult {
  const {
    KUP_50_ANNUAL_LIMIT,
    FIRST_BRACKET_LIMIT,
    FIRST_BRACKET_RATE,
    SECOND_BRACKET_RATE,
    TAX_FREE_THRESHOLD,
    HEALTH_INSURANCE_RATE,
    MONTHS_PER_YEAR
  } = TAX_CONSTANTS_2026;

  const grossAnnual = grossMonthly * MONTHS_PER_YEAR;

  // Calculate 50% KUP (limited to annual max)
  const rawKup = grossAnnual * 0.5;
  const kupDeducted = Math.min(rawKup, KUP_50_ANNUAL_LIMIT);

  // Taxable income after KUP deduction
  const incomeAfterKup = grossAnnual - kupDeducted;

  // Apply tax-free threshold
  const taxableIncome = Math.max(0, incomeAfterKup - TAX_FREE_THRESHOLD);

  // Calculate income tax (progressive)
  let incomeTax = 0;
  const effectiveBracketLimit = FIRST_BRACKET_LIMIT - TAX_FREE_THRESHOLD;

  if (taxableIncome <= effectiveBracketLimit) {
    // All income in first bracket
    incomeTax = taxableIncome * FIRST_BRACKET_RATE;
  } else {
    // Some income in second bracket
    incomeTax = effectiveBracketLimit * FIRST_BRACKET_RATE;
    incomeTax += (taxableIncome - effectiveBracketLimit) * SECOND_BRACKET_RATE;
  }

  // Health insurance (9% of gross, not tax-deductible in full)
  const healthInsurance = grossAnnual * HEALTH_INSURANCE_RATE;

  // Total tax + health insurance
  const totalDeductions = incomeTax + healthInsurance;

  // Net annual income
  const netAnnual = grossAnnual - totalDeductions;
  const netMonthly = netAnnual / MONTHS_PER_YEAR;

  // Calculate which month the second bracket kicks in
  let secondBracketMonth: number | null = null;
  const inSecondBracket = taxableIncome > effectiveBracketLimit;

  if (inSecondBracket) {
    // Calculate cumulative taxable income per month until we hit second bracket
    const monthlyTaxableBase = (grossMonthly * 0.5 <= KUP_50_ANNUAL_LIMIT / MONTHS_PER_YEAR)
      ? grossMonthly * 0.5
      : KUP_50_ANNUAL_LIMIT / MONTHS_PER_YEAR;
    const monthlyTaxable = grossMonthly - monthlyTaxableBase - (TAX_FREE_THRESHOLD / MONTHS_PER_YEAR);

    // Cumulative approach - when does cumulative taxable exceed bracket limit?
    for (let month = 1; month <= MONTHS_PER_YEAR; month++) {
      const cumulativeGross = grossMonthly * month;
      const cumulativeKup = Math.min(cumulativeGross * 0.5, KUP_50_ANNUAL_LIMIT);
      const cumulativeAfterKup = cumulativeGross - cumulativeKup;
      const cumulativeTaxable = Math.max(0, cumulativeAfterKup - TAX_FREE_THRESHOLD);

      if (cumulativeTaxable > effectiveBracketLimit) {
        secondBracketMonth = month;
        break;
      }
    }
  }

  // Calculate month-by-month net income for more accurate average
  let totalMonthlyNet = 0;
  let cumulativeTaxableForYear = 0;
  let cumulativeTaxPaid = 0;

  for (let month = 1; month <= MONTHS_PER_YEAR; month++) {
    const cumulativeGross = grossMonthly * month;
    const cumulativeKup = Math.min(cumulativeGross * 0.5, KUP_50_ANNUAL_LIMIT);
    const cumulativeAfterKup = cumulativeGross - cumulativeKup;
    const cumulativeTaxable = Math.max(0, cumulativeAfterKup - TAX_FREE_THRESHOLD);

    // Calculate cumulative tax
    let cumulativeTax = 0;
    if (cumulativeTaxable <= effectiveBracketLimit) {
      cumulativeTax = cumulativeTaxable * FIRST_BRACKET_RATE;
    } else {
      cumulativeTax = effectiveBracketLimit * FIRST_BRACKET_RATE;
      cumulativeTax += (cumulativeTaxable - effectiveBracketLimit) * SECOND_BRACKET_RATE;
    }

    // This month's tax is the difference
    const thisMonthTax = cumulativeTax - cumulativeTaxPaid;
    cumulativeTaxPaid = cumulativeTax;
    cumulativeTaxableForYear = cumulativeTaxable;

    // This month's health insurance
    const thisMonthHealth = grossMonthly * HEALTH_INSURANCE_RATE;

    // This month's net
    const thisMonthNet = grossMonthly - thisMonthTax - thisMonthHealth;
    totalMonthlyNet += thisMonthNet;
  }

  const netMonthlyAverage = totalMonthlyNet / MONTHS_PER_YEAR;
  const effectiveTaxRate = totalDeductions / grossAnnual;

  return {
    grossAnnual,
    netAnnual,
    netMonthly,
    netMonthlyAverage,
    taxPaid: incomeTax,
    healthInsurance,
    kupDeducted,
    taxableIncome,
    inSecondBracket,
    secondBracketMonth,
    effectiveTaxRate,
  };
}

/**
 * Format currency with Polish locale
 */
export function formatPLN(amount: number): string {
  return amount.toLocaleString('pl-PL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Get a summary message about the tax calculation
 */
export function getTaxSummaryMessage(result: TaxCalculationResult): string {
  if (result.inSecondBracket && result.secondBracketMonth) {
    return `Od ${result.secondBracketMonth}. miesiąca wchodzisz w II próg podatkowy (32%). Średnie netto: ${formatPLN(result.netMonthlyAverage)} zł/mies.`;
  }
  return `Zostajesz w I progu podatkowym (12%) przez cały rok.`;
}
