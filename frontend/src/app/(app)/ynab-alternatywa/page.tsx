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
