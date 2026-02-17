# /ynab-alternatywa Landing Page — Design Document

**Date**: 2026-02-17
**Status**: Approved

## Goal

Build a dedicated landing page at `/ynab-alternatywa` that simultaneously:
1. **Ranks** for "YNAB alternatywa", "YNAB polska", "alternatywa dla YNAB" queries
2. **Converts** YNAB users, YNAB-curious, and general budget app shoppers to FiredUp sign-ups

## Architecture

- **Route**: `frontend/src/app/(app)/ynab-alternatywa/page.tsx`
- **Type**: Next.js Server Component (no `'use client'`)
- **Layout**: Inline `LandingHeader` + `LandingFooter` (not inside `(landing)` route group, no auth redirect)
- **Size**: ~450 lines, single file with inline section components

## SEO

- **H1**: "FiredUp - Polska Alternatywa dla YNAB - Lepsza, Tańsza i w Twoim Języku"
- **URL**: `/ynab-alternatywa`
- **Meta description**: "Szukasz polskiej alternatywy dla YNAB? FiredUp kosztuje 149 zł/rok (vs 600 zł YNAB), obsługuje ING, mBank i PKO, i działa w 100% po polsku. Wypróbuj za darmo."
- **Schema.org**: `SoftwareApplication` + `FAQPage` JSON-LD
- **Sitemap**: Added to `frontend/src/app/sitemap.ts`

## Page Sections (in order)

### 1. Hero
- Badge: "Polska alternatywa dla YNAB"
- H1 with exact keyword phrase
- Subheadline: price comparison (600 zł/rok YNAB vs 149 zł/rok FiredUp)
- Two CTAs: "Wypróbuj za darmo — 7 dni Premium" + "Zobacz porównanie ↓" (anchor scroll)
- Emerald gradient background matching main landing

### 2. Why YNAB Fails Polish Users
- 3 pain point cards with icons:
  - 💸 Drogi — ~600 zł/rok przy kursie USD
  - 🇺🇸 Po angielsku — interfejs, support, treści
  - 🏦 Brak polskich banków — żadnej integracji z ING/mBank/PKO

### 3. Comparison Table
Full-width table with 3 columns: Cecha | YNAB | FiredUp

| Cecha | YNAB | FiredUp |
|-------|------|---------|
| Cena | ~600 zł/rok | 149 zł/rok |
| Język | 🇺🇸 Angielski | 🇵🇱 Polski |
| Polskie banki (ING, mBank, PKO) | ❌ | ✅ |
| IKE / IKZE / PPK | ❌ | ✅ |
| Metodologia | Zero-based budgeting | 7 Baby Steps |
| Analiza AI | ❌ | ✅ |
| Darmowy plan | ❌ | ✅ |
| Wsparcie po polsku | ❌ | ✅ |

FiredUp column header highlighted in emerald.

### 4. Polish-First Advantages
3 feature cards:
- 🏦 Integracja z polskimi bankami (ING, mBank, PKO BP, Santander, Millennium)
- 📋 Polski system finansowy (IKE, IKZE, PPK — śledź wszystko w jednym miejscu)
- 🇵🇱 100% po polsku (interfejs, support, treści edukacyjne)

### 5. Methodology Comparison
Two-column layout:
- Left: YNAB — Zero-based budgeting (every zloty has a job) — good for tracking, not for getting out of debt
- Right: FiredUp — 7 Baby Steps — structured path: emergency fund → debt snowball → investments. Better for Polish users with consumer debt.

### 6. Features Section
Reuse existing `FeaturesSection` component directly (bank connection, dashboard, debt payoff calculator, savings goals, Baby Steps, AI analysis).

### 7. Pricing CTA
Side-by-side pricing cards:
- YNAB: ~600 zł/rok, USD billing, no free plan, English only
- FiredUp: 149 zł/rok (lub 19,99 zł/mies), PLN billing, free plan available, 7-day premium trial

Primary CTA: "Zacznij za darmo — bez karty kredytowej"

### 8. FAQ (YNAB-specific)
5 questions targeting YNAB migration queries:
1. Czy mogę przenieść dane z YNAB do FiredUp?
2. Czy FiredUp jest trudniejszy w obsłudze niż YNAB?
3. Czym różni się metoda Baby Steps od zero-based budgeting?
4. Czy FiredUp działa z moim bankiem?
5. Co stanie się z moimi danymi jeśli zrezygnuję?

### 9. Final CTA
Full-width emerald banner: "Wypróbuj FiredUp za darmo przez 7 dni" with sign-up button.

## Implementation Notes

- All copy hardcoded in Polish directly in the component (no Strapi/CMS)
- Reuse `LandingHeader`, `LandingFooter`, `FeaturesSection` from existing components
- New inline components: `HeroYnab`, `PainPoints`, `ComparisonTable`, `PolishAdvantages`, `MethodologyComparison`, `PricingCTA`, `FaqYnab`, `FinalCTA`
- Sign-up CTA links to `/auth/signin` (same as main landing)
- "Zobacz porównanie" anchor scrolls to `#comparison-table`
- Green checkmarks and red X marks in comparison table using Lucide icons (`Check`, `X`)

## Files to Create/Modify

- **Create**: `frontend/src/app/(app)/ynab-alternatywa/page.tsx`
- **Modify**: `frontend/src/app/sitemap.ts` — add `/ynab-alternatywa` entry

## Success Criteria

- Page renders at `/ynab-alternatywa` with correct Polish copy
- H1 contains "YNAB alternatywa" phrase
- Comparison table shows 8 rows with correct YNAB vs FiredUp data
- Schema.org SoftwareApplication + FAQPage present in HTML
- `/ynab-alternatywa` appears in sitemap.xml
- `LandingHeader` and `LandingFooter` wrap the page correctly
- No TypeScript errors
