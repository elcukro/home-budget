/**
 * Polskie limity podatkowe i finansowe na rok 2026
 * Źródło: Ministerstwo Finansów, ZUS, KNF
 *
 * UWAGA: Te wartości powinny być aktualizowane co roku!
 */

export const TAX_LIMITS_2026 = {
  // Limity wpłat na konta emerytalne
  IKE_LIMIT: 28260,           // Indywidualne Konto Emerytalne
  IKZE_LIMIT_STANDARD: 11304, // IKZE dla pracowników etatowych
  IKZE_LIMIT_JDG: 16956,      // IKZE dla samozatrudnionych (1.5x)
  OIPE_LIMIT: 28260,          // Ogólnoeuropejski Indywidualny Produkt Emerytalny

  // Progi podatkowe PIT
  KWOTA_WOLNA: 30000,         // Kwota wolna od podatku
  PROG_PODATKOWY_1: 120000,   // Próg 12% -> 32%
  STAWKA_PIT_1: 0.12,         // 12% do progu
  STAWKA_PIT_2: 0.32,         // 32% powyżej progu

  // Podatek od zysków kapitałowych
  PODATEK_BELKI: 0.19,        // 19% od zysków kapitałowych

  // Minimalne wynagrodzenie
  MIN_WAGE_MONTHLY: 4806,     // Minimalne wynagrodzenie miesięczne brutto
  MIN_WAGE_HOURLY: 31.50,     // Minimalna stawka godzinowa brutto

  // Składki ZUS (pracownik)
  ZUS_EMERYTALNA: 0.0976,     // 9.76%
  ZUS_RENTOWA: 0.015,         // 1.5%
  ZUS_CHOROBOWA: 0.0245,      // 2.45%
  ZUS_ZDROWOTNA: 0.09,        // 9% (podstawa po odliczeniu składek społecznych)

  // PPK
  PPK_PRACOWNIK_MIN: 0.02,    // 2% min od pracownika
  PPK_PRACOWNIK_MAX: 0.04,    // do 4% dodatkowe
  PPK_PRACODAWCA_MIN: 0.015,  // 1.5% min od pracodawcy
  PPK_PRACODAWCA_MAX: 0.025,  // do 2.5% dodatkowe
  PPK_DOPLATA_ROCZNA: 240,    // Dopłata roczna od państwa
  PPK_DOPLATA_POWITALNA: 250, // Jednorazowa dopłata powitalna

  // Rekomendowane wartości (nie limity prawne)
  RECOMMENDED_EMERGENCY_FUND_MIN: 3000,    // Minimalny fundusz awaryjny
  RECOMMENDED_EMERGENCY_FUND_MONTHS: 6,    // Zalecane miesiące wydatków
  RECOMMENDED_DTI_MAX: 0.35,               // Zalecany max DTI
  RECOMMENDED_DTI_WARNING: 0.40,           // Próg ostrzeżenia DTI
  BANK_DTI_LIMIT: 0.50,                    // Limit DTI w bankach dla hipoteki
} as const;

/**
 * Oblicza oszczędność podatkową z wpłaty na IKZE
 * @param wplata - kwota wpłaty na IKZE
 * @param rocznyDochod - roczny dochód brutto
 * @returns oszczędność podatkowa w PLN
 */
export function calculateIKZETaxSavings(wplata: number, rocznyDochod: number): number {
  const { PROG_PODATKOWY_1, STAWKA_PIT_1, STAWKA_PIT_2 } = TAX_LIMITS_2026;

  // Stawka podatkowa zależy od progu
  const stawka = rocznyDochod > PROG_PODATKOWY_1 ? STAWKA_PIT_2 : STAWKA_PIT_1;

  return Math.round(wplata * stawka);
}

/**
 * Oblicza efektywną stopę zwrotu z IKZE uwzględniając ulgę podatkową
 * @param wplata - kwota wpłaty
 * @param rocznyDochod - roczny dochód brutto
 * @returns efektywny koszt wpłaty (po odliczeniu ulgi)
 */
export function calculateIKZEEffectiveCost(wplata: number, rocznyDochod: number): number {
  const oszczednosc = calculateIKZETaxSavings(wplata, rocznyDochod);
  return wplata - oszczednosc;
}

/**
 * Oblicza podatek Belki od zysku kapitałowego
 * @param zysk - zysk z inwestycji
 * @returns kwota podatku do zapłaty
 */
export function calculateBelkaTax(zysk: number): number {
  if (zysk <= 0) return 0;
  return Math.round(zysk * TAX_LIMITS_2026.PODATEK_BELKI);
}

/**
 * Sprawdza czy wpłata mieści się w limicie IKE
 * @param obecneWplaty - suma dotychczasowych wpłat w roku
 * @param nowaWplata - planowana wpłata
 * @returns obiekt z informacją czy mieści się i ile zostało
 */
export function checkIKELimit(obecneWplaty: number, nowaWplata: number): {
  isWithinLimit: boolean;
  remaining: number;
  excess: number;
} {
  const limit = TAX_LIMITS_2026.IKE_LIMIT;
  const remaining = Math.max(0, limit - obecneWplaty);
  const excess = Math.max(0, (obecneWplaty + nowaWplata) - limit);

  return {
    isWithinLimit: (obecneWplaty + nowaWplata) <= limit,
    remaining,
    excess,
  };
}

/**
 * Sprawdza czy wpłata mieści się w limicie IKZE
 * @param obecneWplaty - suma dotychczasowych wpłat w roku
 * @param nowaWplata - planowana wpłata
 * @param isJDG - czy osoba prowadzi działalność gospodarczą
 * @returns obiekt z informacją czy mieści się i ile zostało
 */
export function checkIKZELimit(obecneWplaty: number, nowaWplata: number, isJDG: boolean = false): {
  isWithinLimit: boolean;
  remaining: number;
  excess: number;
  limit: number;
} {
  const limit = isJDG ? TAX_LIMITS_2026.IKZE_LIMIT_JDG : TAX_LIMITS_2026.IKZE_LIMIT_STANDARD;
  const remaining = Math.max(0, limit - obecneWplaty);
  const excess = Math.max(0, (obecneWplaty + nowaWplata) - limit);

  return {
    isWithinLimit: (obecneWplaty + nowaWplata) <= limit,
    remaining,
    excess,
    limit,
  };
}

/**
 * Formatuje kwotę w PLN
 */
export function formatPLN(amount: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Zwraca opis limitów na dany rok (do wyświetlenia użytkownikowi)
 */
export function getTaxLimitsDescription(): string {
  const { IKE_LIMIT, IKZE_LIMIT_STANDARD, IKZE_LIMIT_JDG, OIPE_LIMIT } = TAX_LIMITS_2026;

  return `Limity wpłat 2026:
• IKE: ${formatPLN(IKE_LIMIT)}
• IKZE (etat): ${formatPLN(IKZE_LIMIT_STANDARD)}
• IKZE (JDG): ${formatPLN(IKZE_LIMIT_JDG)}
• OIPE: ${formatPLN(OIPE_LIMIT)}`;
}
