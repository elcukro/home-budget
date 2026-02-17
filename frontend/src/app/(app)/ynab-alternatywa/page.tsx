import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  url: 'https://firedup.app',
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
              <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
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
      <>
        <Check className="w-5 h-5 text-emerald-500 mx-auto" aria-hidden="true" />
        <span className="sr-only">Tak</span>
      </>
    ) : (
      <>
        <X className="w-5 h-5 text-red-400 mx-auto" aria-hidden="true" />
        <span className="sr-only">Nie</span>
      </>
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

export default function YnabAlternatywaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <LandingHeader />
      <main>
        <HeroYnab />
        <PainPoints />
        <ComparisonTable />
      </main>
      <LandingFooter />
    </>
  );
}
