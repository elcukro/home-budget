import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
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
      </main>
      <LandingFooter />
    </>
  );
}
