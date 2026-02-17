# /ynab-alternatywa Landing Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a dedicated `/ynab-alternatywa` landing page that ranks for "YNAB alternatywa" and converts Polish budget app seekers to FiredUp sign-ups.

**Architecture:** Single Next.js Server Component at `frontend/src/app/(app)/ynab-alternatywa/page.tsx` with inline section components, reusing `LandingHeader`, `LandingFooter`, and `FeaturesSection`. Polish copy hardcoded directly in the component. Schema.org JSON-LD added inline.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Lucide icons, existing landing component library in `src/components/landing/`.

---

## Context: Key Files to Know

- `frontend/src/components/landing/LandingHeader.tsx` — import and render at top of page
- `frontend/src/components/landing/LandingFooter.tsx` — import and render at bottom
- `frontend/src/components/landing/FeaturesSection.tsx` — reuse directly (6 feature cards)
- `frontend/src/app/(app)/(landing)/page.tsx` — reference for how the main landing page is structured
- `frontend/src/app/sitemap.ts` — add `/ynab-alternatywa` entry here
- `frontend/src/components/ui/button.tsx` — Button component used for CTAs

## Context: Design Decisions

- Page is NOT inside `(landing)` route group — no auth redirect
- No `'use client'` — pure Server Component
- H1 must contain "YNAB alternatywa" for SEO
- CTA buttons link to `/auth/signin`
- "Zobacz porównanie" scrolls to `id="comparison-table"`
- All copy is in Polish

---

## Task 1: Create page skeleton with metadata and layout wrappers

**Files:**
- Create: `frontend/src/app/(app)/ynab-alternatywa/page.tsx`

**Step 1: Create the file with metadata and empty body**

```tsx
import type { Metadata } from 'next';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';

export const metadata: Metadata = {
  title: 'FiredUp - Polska Alternatywa dla YNAB | Tańsza i po Polsku',
  description:
    'Szukasz polskiej alternatywy dla YNAB? FiredUp kosztuje 149 zł/rok (vs ~600 zł YNAB), obsługuje ING, mBank i PKO, i działa w 100% po polsku. Wypróbuj za darmo.',
  keywords: [
    'ynab alternatywa',
    'polska alternatywa ynab',
    'ynab po polsku',
    'aplikacja budżet domowy',
    'firedup',
  ],
  openGraph: {
    title: 'FiredUp - Polska Alternatywa dla YNAB',
    description: 'Tańsza, po polsku, z integracją polskich banków.',
    url: 'https://firedup.app/ynab-alternatywa',
  },
};

const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'FiredUp',
  operatingSystem: 'Web, iOS, Android',
  applicationCategory: 'FinanceApplication',
  offers: {
    '@type': 'Offer',
    price: '149',
    priceCurrency: 'PLN',
  },
  description:
    'Polska alternatywa dla YNAB. Budżet domowy online z integracją polskich banków (ING, mBank, PKO), metodą 7 Baby Steps i analizą AI.',
};

export default function YnabAlternatywaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <LandingHeader />
      <main>
        {/* sections go here */}
      </main>
      <LandingFooter />
    </>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep ynab`
Expected: no output (no errors)

**Step 3: Verify page renders**

Run: open `http://localhost:3100/ynab-alternatywa`
Expected: Page with header and footer visible, no errors in console.

**Step 4: Commit**

```bash
git add frontend/src/app/(app)/ynab-alternatywa/page.tsx
git commit -m "feat: Add /ynab-alternatywa page skeleton"
```

---

## Task 2: Hero section

**Files:**
- Modify: `frontend/src/app/(app)/ynab-alternatywa/page.tsx`

**Step 1: Add HeroYnab component above the `export default` and add to main**

Add this component definition in the file (before `export default`):

```tsx
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function HeroYnab() {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center pt-24 pb-20 overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-amber-50">
      {/* Gradient orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-200/40 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center z-10">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium mb-6 border border-emerald-200/50">
          🇵🇱 Polska alternatywa dla YNAB
        </div>

        {/* H1 */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-emerald-900 leading-tight mb-6">
          FiredUp – Polska{' '}
          <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
            Alternatywa dla YNAB
          </span>
          <br />
          Lepsza, Tańsza i w Twoim Języku
        </h1>

        {/* Subheadline */}
        <p className="text-xl text-emerald-800/70 mb-8 max-w-3xl mx-auto">
          YNAB kosztuje <strong>~600 zł/rok</strong> i jest po angielsku.
          FiredUp kosztuje <strong>149 zł/rok</strong>, obsługuje ING, mBank i PKO,
          i działa w 100% po polsku.
        </p>

        {/* Trust bullets */}
        <div className="flex flex-wrap justify-center gap-4 mb-10 text-sm text-emerald-700">
          {[
            '7 dni Premium za darmo',
            'Bez karty kredytowej',
            'Polskie banki: ING, mBank, PKO',
          ].map((item) => (
            <span key={item} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              {item}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 text-lg rounded-xl">
            <Link href="/auth/signin">
              Wypróbuj za darmo — 7 dni Premium
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 px-8 py-4 text-lg rounded-xl">
            <a href="#comparison-table">
              Zobacz porównanie ↓
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
```

In `main`:
```tsx
<main>
  <HeroYnab />
</main>
```

**Step 2: TypeScript check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep ynab`
Expected: no output

**Step 3: Verify visually**

Open `http://localhost:3100/ynab-alternatywa` — should see emerald hero with H1 and two buttons.

**Step 4: Commit**

```bash
git add frontend/src/app/(app)/ynab-alternatywa/page.tsx
git commit -m "feat: Add hero section to /ynab-alternatywa"
```

---

## Task 3: Pain points + Comparison Table

**Files:**
- Modify: `frontend/src/app/(app)/ynab-alternatywa/page.tsx`

**Step 1: Add PainPoints component**

```tsx
import { AlertCircle } from 'lucide-react';

function PainPoints() {
  const pains = [
    {
      emoji: '💸',
      title: 'YNAB jest drogi',
      description:
        'YNAB kosztuje $99/rok — przy obecnym kursie to ~600 zł rocznie. Za podobną kwotę masz FiredUp na 4 lata.',
    },
    {
      emoji: '🇺🇸',
      title: 'Tylko po angielsku',
      description:
        'Interfejs, support, treści edukacyjne — wszystko po angielsku. Dla polskiego użytkownika to bariera.',
    },
    {
      emoji: '🏦',
      title: 'Brak polskich banków',
      description:
        'YNAB nie obsługuje ING, mBank, PKO BP ani żadnego polskiego banku. Musisz wpisywać transakcje ręcznie.',
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Dlaczego YNAB nie jest idealny dla Polaków?
          </h2>
          <p className="text-lg text-gray-600">
            YNAB to świetna aplikacja — ale zaprojektowana dla Amerykanów, nie dla nas.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pains.map((pain) => (
            <div
              key={pain.title}
              className="p-6 rounded-2xl border border-red-100 bg-red-50/50"
            >
              <div className="text-4xl mb-4">{pain.emoji}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{pain.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{pain.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Step 2: Add ComparisonTable component**

```tsx
import { Check, X } from 'lucide-react';

type Row = {
  feature: string;
  ynab: boolean | string;
  firedup: boolean | string;
};

const rows: Row[] = [
  { feature: 'Cena roczna', ynab: '~600 zł/rok ($99)', firedup: '149 zł/rok' },
  { feature: 'Język interfejsu', ynab: '🇺🇸 Angielski', firedup: '🇵🇱 Polski' },
  { feature: 'Polskie banki (ING, mBank, PKO)', ynab: false, firedup: true },
  { feature: 'IKE / IKZE / PPK', ynab: false, firedup: true },
  { feature: 'Metodologia wyjścia z długów', ynab: 'Zero-based budgeting', firedup: '7 Baby Steps' },
  { feature: 'Analiza AI', ynab: false, firedup: true },
  { feature: 'Darmowy plan (na zawsze)', ynab: false, firedup: true },
  { feature: 'Wsparcie po polsku', ynab: false, firedup: true },
];

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="w-5 h-5 text-emerald-500 mx-auto" />
    ) : (
      <X className="w-5 h-5 text-red-400 mx-auto" />
    );
  }
  return <span className="text-sm text-gray-700">{value}</span>;
}

function ComparisonTable() {
  return (
    <section id="comparison-table" className="py-20 bg-emerald-50/30 scroll-mt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            FiredUp vs YNAB — Pełne Porównanie
          </h2>
          <p className="text-lg text-gray-600">
            To samo podejście do budżetowania, zaprojektowane dla Polski.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-emerald-200 shadow-sm">
          <table className="w-full bg-white">
            <thead>
              <tr className="border-b border-emerald-100">
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-500 w-1/2">
                  Cecha
                </th>
                <th className="px-6 py-4 text-center text-sm font-medium text-gray-500 w-1/4">
                  YNAB
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-emerald-700 bg-emerald-50 w-1/4">
                  FiredUp ✓
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.feature}
                  className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">
                    {row.feature}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Cell value={row.ynab} />
                  </td>
                  <td className="px-6 py-4 text-center bg-emerald-50/50">
                    <Cell value={row.firedup} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-center mt-8">
          <Button asChild size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 rounded-xl">
            <Link href="/auth/signin">
              Przejdź na FiredUp — 7 dni za darmo
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
```

**Step 3: Add both sections to main**

```tsx
<main>
  <HeroYnab />
  <PainPoints />
  <ComparisonTable />
</main>
```

**Step 4: TypeScript check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep ynab`
Expected: no output

**Step 5: Commit**

```bash
git add frontend/src/app/(app)/ynab-alternatywa/page.tsx
git commit -m "feat: Add pain points and comparison table to /ynab-alternatywa"
```

---

## Task 4: Polish Advantages + Methodology sections

**Files:**
- Modify: `frontend/src/app/(app)/ynab-alternatywa/page.tsx`

**Step 1: Add PolishAdvantages component**

```tsx
import { Landmark, FileText, Globe } from 'lucide-react';

function PolishAdvantages() {
  const advantages = [
    {
      icon: Landmark,
      color: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      title: 'Polskie banki — automatycznie',
      description:
        'ING, mBank, PKO BP, Santander, Millennium i inne. Twoje transakcje pobierają się automatycznie — koniec z ręcznym wpisywaniem.',
    },
    {
      icon: FileText,
      color: 'bg-amber-100',
      iconColor: 'text-amber-600',
      title: 'IKE, IKZE i PPK',
      description:
        'YNAB nie wie co to IKE. FiredUp śledzi Twoje polskie produkty emerytalne i uwzględnia je w planie finansowym.',
    },
    {
      icon: Globe,
      color: 'bg-sky-100',
      iconColor: 'text-sky-600',
      title: '100% po polsku',
      description:
        'Interfejs, treści edukacyjne, support i powiadomienia — wszystko w Twoim języku. Bez tłumaczenia głowy.',
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Zaprojektowany dla polskich finansów
          </h2>
          <p className="text-lg text-gray-600">
            YNAB był tworzony z myślą o dolarach, FiredUp — o złotych.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {advantages.map((adv) => (
            <div key={adv.title} className="p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
              <div className={`w-12 h-12 ${adv.color} rounded-xl flex items-center justify-center mb-4`}>
                <adv.icon className={`w-6 h-6 ${adv.iconColor}`} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{adv.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{adv.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Step 2: Add MethodologyComparison component**

```tsx
import { Footprints, BarChart3 } from 'lucide-react';

function MethodologyComparison() {
  return (
    <section className="py-20 bg-gradient-to-br from-emerald-50 to-amber-50/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Inna filozofia, lepsze wyniki dla zadłużonych
          </h2>
          <p className="text-lg text-gray-600">
            Obie aplikacje pomagają zarządzać pieniędzmi — ale w różny sposób.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* YNAB */}
          <div className="p-8 rounded-2xl bg-white border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">YNAB</p>
                <h3 className="text-lg font-bold text-gray-900">Zero-based budgeting</h3>
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-4 leading-relaxed">
              Każdy dolar (czy złoty) musi mieć przypisane zadanie. Świetne do śledzenia wydatków,
              ale nie daje jasnej ścieżki wyjścia z długów — decydujesz sam, co jest priorytetem.
            </p>
            <ul className="space-y-2 text-sm text-gray-500">
              <li className="flex items-start gap-2"><span className="text-gray-300 mt-0.5">•</span> Śledzenie każdego wydatku</li>
              <li className="flex items-start gap-2"><span className="text-gray-300 mt-0.5">•</span> Własne kategorie i budżety</li>
              <li className="flex items-start gap-2"><span className="text-gray-300 mt-0.5">•</span> Brak gotowego planu wyjścia z długów</li>
            </ul>
          </div>

          {/* FiredUp */}
          <div className="p-8 rounded-2xl bg-emerald-50 border border-emerald-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Footprints className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-emerald-500 uppercase tracking-wide">FiredUp</p>
                <h3 className="text-lg font-bold text-emerald-900">7 Baby Steps</h3>
              </div>
            </div>
            <p className="text-emerald-800/70 text-sm mb-4 leading-relaxed">
              Sprawdzona, krok-po-kroku ścieżka: fundusz awaryjny → spłata długów metodą kuli śnieżnej
              → inwestycje. Wiesz dokładnie co robić teraz i co będzie następne.
            </p>
            <ul className="space-y-2 text-sm text-emerald-700">
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> Gotowy plan dla każdego</li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> Metoda kuli śnieżnej dla długów</li>
              <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> Od funduszu awaryjnego do wolności finansowej</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
```

**Step 3: Add to main**

```tsx
<main>
  <HeroYnab />
  <PainPoints />
  <ComparisonTable />
  <PolishAdvantages />
  <MethodologyComparison />
</main>
```

**Step 4: TypeScript check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep ynab`
Expected: no output

**Step 5: Commit**

```bash
git add frontend/src/app/(app)/ynab-alternatywa/page.tsx
git commit -m "feat: Add Polish advantages and methodology sections to /ynab-alternatywa"
```

---

## Task 5: Features + Pricing CTA sections

**Files:**
- Modify: `frontend/src/app/(app)/ynab-alternatywa/page.tsx`

**Step 1: Import and add FeaturesSection**

Add import at top:
```tsx
import FeaturesSection from '@/components/landing/FeaturesSection';
```

**Step 2: Add PricingCta component**

```tsx
function PricingCta() {
  return (
    <section className="py-20 bg-emerald-50/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            3x tańszy od YNAB — i więcej w zestawie
          </h2>
          <p className="text-lg text-gray-600">
            Takie same koncepcje budżetowania, ułamek ceny.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* YNAB */}
          <div className="p-8 rounded-2xl bg-white border border-gray-200">
            <p className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-2">YNAB</p>
            <div className="text-4xl font-bold text-gray-900 mb-1">~600 zł</div>
            <div className="text-sm text-gray-500 mb-6">rocznie (kurs USD)</div>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex items-center gap-2"><X className="w-4 h-4 text-red-400" /> Po angielsku</li>
              <li className="flex items-center gap-2"><X className="w-4 h-4 text-red-400" /> Brak polskich banków</li>
              <li className="flex items-center gap-2"><X className="w-4 h-4 text-red-400" /> Brak darmowego planu</li>
              <li className="flex items-center gap-2"><X className="w-4 h-4 text-red-400" /> Rozliczenie w USD</li>
            </ul>
          </div>

          {/* FiredUp */}
          <div className="p-8 rounded-2xl bg-emerald-600 text-white relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-1 rounded-full">
              POLECANE
            </div>
            <p className="text-sm font-medium text-emerald-200 uppercase tracking-wide mb-2">FiredUp</p>
            <div className="text-4xl font-bold text-white mb-1">149 zł</div>
            <div className="text-sm text-emerald-200 mb-6">rocznie (lub 19,99 zł/mies)</div>
            <ul className="space-y-3 text-sm text-emerald-100">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-300" /> 100% po polsku</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-300" /> ING, mBank, PKO BP i inne</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-300" /> Darmowy plan na zawsze</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-300" /> Rozliczenie w PLN</li>
            </ul>
          </div>
        </div>

        <div className="text-center mt-10">
          <Button asChild size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-4 text-lg rounded-xl">
            <Link href="/auth/signin">
              Zacznij za darmo — bez karty kredytowej
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
          <p className="text-sm text-gray-500 mt-3">7 dni Premium za darmo. Potem darmowy plan lub 149 zł/rok.</p>
        </div>
      </div>
    </section>
  );
}
```

**Step 3: Add to main**

```tsx
<main>
  <HeroYnab />
  <PainPoints />
  <ComparisonTable />
  <PolishAdvantages />
  <MethodologyComparison />
  <FeaturesSection />
  <PricingCta />
</main>
```

**Step 4: TypeScript check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep ynab`
Expected: no output

**Step 5: Commit**

```bash
git add frontend/src/app/(app)/ynab-alternatywa/page.tsx
git commit -m "feat: Add features and pricing CTA to /ynab-alternatywa"
```

---

## Task 6: FAQ + Final CTA + Schema.org FAQPage

**Files:**
- Modify: `frontend/src/app/(app)/ynab-alternatywa/page.tsx`

**Step 1: Add FAQ data and component**

```tsx
const faqItems = [
  {
    question: 'Czy mogę przenieść dane z YNAB do FiredUp?',
    answer:
      'Aktualnie nie oferujemy automatycznego importu z YNAB, ale możesz łatwo zacząć od nowa. Połącz swój bank i FiredUp automatycznie pobierze historię transakcji z ostatnich miesięcy. Ręczne przenoszenie budżetów zajmuje zwykle 15-20 minut.',
  },
  {
    question: 'Czy FiredUp jest trudniejszy w obsłudze niż YNAB?',
    answer:
      'Nie — większość użytkowników mówi, że FiredUp jest łatwiejszy, bo jest po polsku i ma gotowy plan krok-po-kroku. YNAB wymaga zrozumienia angielskich pojęć i samodzielnego definiowania kategorii. W FiredUp startujesz ze strukturą dopasowaną do polskich finansów.',
  },
  {
    question: 'Czym różni się metoda Baby Steps od zero-based budgeting YNAB?',
    answer:
      'YNAB używa "zero-based budgeting" — każdy złoty musi mieć przypisane zadanie. To świetne śledzenie, ale bez gotowego planu. FiredUp opiera się na 7 Baby Steps: zaczyna od funduszu awaryjnego, potem metodą kuli śnieżnej spłacasz długi od najmniejszego do największego, a na końcu budujesz inwestycje. To sprawdzona kolejność priorytetów.',
  },
  {
    question: 'Czy FiredUp działa z moim polskim bankiem?',
    answer:
      'FiredUp obsługuje integrację z ING, mBank, PKO BP, Santander, Millennium i innymi polskimi bankami przez certyfikowane API (Open Banking / PSD2). Połączenie zajmuje 2 minuty i nie wymaga podawania hasła — logujesz się bezpośrednio na stronie swojego banku.',
  },
  {
    question: 'Co się stanie z moimi danymi jeśli zrezygnuję?',
    answer:
      'Twoje dane zawsze należą do Ciebie. Możesz wyeksportować wszystkie dane (Excel, CSV, JSON) w dowolnym momencie z poziomu ustawień. Jeśli zdecydujesz się usunąć konto, dane są kasowane natychmiastowo i nieodwracalnie — zgodnie z RODO.',
  },
];

function FaqYnab() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Najczęstsze pytania o zmianę z YNAB
          </h2>
        </div>
        <div className="space-y-6">
          {faqItems.map((item) => (
            <div key={item.question} className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
              <h3 className="text-base font-semibold text-gray-900 mb-3">{item.question}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Step 2: Add FinalCta component**

```tsx
function FinalCta() {
  return (
    <section className="py-24 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white text-center">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-bold mb-4">
          Wypróbuj FiredUp za darmo przez 7 dni
        </h2>
        <p className="text-xl text-emerald-100 mb-8">
          Pełna wersja Premium, bez karty kredytowej. Jeśli nie spodoba się — nic nie tracisz.
        </p>
        <Button asChild size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50 px-10 py-4 text-lg rounded-xl font-semibold">
          <Link href="/auth/signin">
            Zacznij za darmo — to zajmie 2 minuty
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </Button>
        <p className="text-emerald-200 text-sm mt-4">
          Potem darmowy plan lub 149 zł/rok. Rezygnacja jednym kliknięciem.
        </p>
      </div>
    </section>
  );
}
```

**Step 3: Add FAQPage JSON-LD to the page (alongside softwareJsonLd)**

```tsx
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqItems.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
};
```

In `export default`, add the second script:
```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
/>
```

**Step 4: Add to main**

```tsx
<main>
  <HeroYnab />
  <PainPoints />
  <ComparisonTable />
  <PolishAdvantages />
  <MethodologyComparison />
  <FeaturesSection />
  <PricingCta />
  <FaqYnab />
  <FinalCta />
</main>
```

**Step 5: TypeScript check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep ynab`
Expected: no output

**Step 6: Commit**

```bash
git add frontend/src/app/(app)/ynab-alternatywa/page.tsx
git commit -m "feat: Add FAQ, final CTA, and FAQPage schema to /ynab-alternatywa"
```

---

## Task 7: Add to sitemap + verify build

**Files:**
- Modify: `frontend/src/app/sitemap.ts`

**Step 1: Add /ynab-alternatywa entry**

In `frontend/src/app/sitemap.ts`, add after the `pricing` entry:

```ts
{
  url: `${baseUrl}/ynab-alternatywa`,
  lastModified: new Date(),
  changeFrequency: 'monthly' as const,
  priority: 0.9,
},
```

Priority 0.9 matches `/blog` — this is a high-value SEO page.

**Step 2: TypeScript check (whole project)**

Run: `cd frontend && npx tsc --noEmit 2>&1`
Expected: no output (zero errors)

**Step 3: Verify sitemap includes the new URL**

Run: `curl -s http://localhost:3100/sitemap.xml | grep ynab`
Expected: `<loc>https://firedup.app/ynab-alternatywa</loc>`

**Step 4: Verify schema.org**

Run:
```bash
curl -s http://localhost:3100/ynab-alternatywa | python3 -c "
import sys, re, json
html = sys.stdin.read()
for m in re.finditer(r'<script type=\"application/ld\+json\">(.*?)</script>', html, re.DOTALL):
    d = json.loads(m.group(1))
    print('@type:', d.get('@type'))
"
```
Expected:
```
@type: SoftwareApplication
@type: FAQPage
```

**Step 5: Full commit**

```bash
git add frontend/src/app/sitemap.ts
git commit -m "feat: Add /ynab-alternatywa to sitemap"
```

---

## Task 8: Deploy to production

**Step 1: Push branch**

```bash
cd ~/claude/repos/home-budget
git push origin fix/blog-table-rendering
```

**Step 2: Deploy**

```bash
ssh root@firedup.app "cd /opt/home-budget && git pull origin fix/blog-table-rendering && sudo systemctl restart home-budget-frontend"
```

**Step 3: Wait for build (30s) and verify**

```bash
sleep 35 && curl -s -o /dev/null -w "%{http_code}" https://firedup.app/ynab-alternatywa
```
Expected: `200`

**Step 4: Verify schema on production**

```bash
curl -s https://firedup.app/ynab-alternatywa | grep -c 'application/ld+json'
```
Expected: `2` (SoftwareApplication + FAQPage)

**Step 5: Verify sitemap**

```bash
curl -s https://firedup.app/sitemap.xml | grep ynab
```
Expected: `<loc>https://firedup.app/ynab-alternatywa</loc>`
