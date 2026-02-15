'use client';

import { Shield, Eye, Check, Lock } from 'lucide-react';
import Image from 'next/image';

const securityQuestions = [
  {
    question: 'Czy widzicie mój login i hasło do banku?',
    answer: (
      <>
        <strong>Nie. Nigdy.</strong> Kiedy łączysz konto, zostajesz bezpiecznie przekierowany na stronę
        Twojego banku (np. mBank, PKO BP). Logujesz się tam, a bank wysyła nam tylko zaszyfrowany
        "klucz" (token), który pozwala pobrać historię. FiredUp <strong>nigdy nie widzi, nie zapisuje
        ani nie ma dostępu</strong> do Twoich danych logowania.
      </>
    ),
  },
  {
    question: 'Czy możecie wykonać przelew z mojego konta?',
    answer: (
      <>
        <strong>Absolutnie nie.</strong> Korzystamy z licencji AISP (Account Information Service Provider)
        w ramach unijnej dyrektywy PSD2. Technicznie oznacza to dostęp <strong>tylko do odczytu (Read-Only)</strong>.
        Możemy jedynie pobrać historię transakcji, aby ją przeanalizować. Nie mamy technicznej możliwości
        zlecenia przelewu, zmiany limitów czy wzięcia kredytu.
      </>
    ),
  },
  {
    question: 'Kto odpowiada za bezpieczeństwo połączenia?',
    answer: (
      <>
        Naszym partnerem technologicznym jest <strong>Tink</strong> — europejski gigant Open Banking,
        który należy do <strong>Visa</strong>. Tink jest nadzorowany przez europejskie organy finansowe
        i stosuje te same standardy szyfrowania co Twój bank (SSL/TLS 256-bit). To ta sama technologia,
        której używają największe banki w Polsce, gdy dodajesz konto z "innego banku" w ich aplikacji.
      </>
    ),
  },
  {
    question: 'Czy sprzedajecie moje dane?',
    answer: (
      <>
        <strong>Nie.</strong> FiredUp to płatna usługa, ponieważ naszym produktem jest aplikacja,
        <strong> a nie Twoje dane</strong>. W przeciwieństwie do darmowych aplikacji, nie zarabiamy
        na sprzedawaniu Twojej historii zakupowej reklamodawcom czy firmom pożyczkowym. Twoje dane
        służą tylko Tobie.
      </>
    ),
  },
];

type ImageBadge = { name: string; description: string; type: 'image'; url: string; alt: string };
type IconBadge = { name: string; description: string; type: 'icon'; icon: typeof Shield };
type TrustBadge = ImageBadge | IconBadge;

const trustBadges: TrustBadge[] = [
  {
    name: 'Visa',
    description: 'Właściciel Tink',
    type: 'image',
    url: 'https://assets.stickpng.com/images/58482363cef1014c0b5e49c1.png',
    alt: 'Visa logo'
  },
  {
    name: 'Tink',
    description: 'Open Banking Partner',
    type: 'image',
    url: 'https://cdn.brandfetch.io/idxUjYnNys/theme/dark/logo.svg',
    alt: 'Tink logo'
  },
  {
    name: 'RODO',
    description: 'GDPR Compliant',
    type: 'icon',
    icon: Shield
  },
  {
    name: 'SSL',
    description: 'Szyfrowanie 256-bit',
    type: 'icon',
    icon: Lock
  },
];

export default function SecuritySection() {
  return (
    <section
      id="security"
      className="py-20 scroll-mt-20 bg-gradient-to-b from-slate-50 to-white border-y border-emerald-100"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium mb-4">
            <Shield className="w-4 h-4" />
            Bezpieczeństwo na pierwszym miejscu
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-emerald-900 mb-4">
            Twoje pieniądze są bezpieczne.
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
              My tylko patrzymy.
            </span>
          </h2>

          <p className="text-emerald-700/70 text-lg max-w-2xl mx-auto">
            Odpowiadamy na najczęstsze pytania o bezpieczeństwo połączeń bankowych
          </p>
        </div>

        {/* Q&A Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {securityQuestions.map((item, index) => (
            <div
              key={index}
              className="bg-white border border-emerald-100 rounded-2xl p-6 hover:shadow-lg hover:border-emerald-200 transition-all"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Eye className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-emerald-900 leading-tight">
                  {item.question}
                </h3>
              </div>
              <p className="text-emerald-700/70 text-sm leading-relaxed pl-11">
                {item.answer}
              </p>
            </div>
          ))}
        </div>

        {/* Trust Badges */}
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-8">
          <p className="text-sm text-emerald-600/70 text-center mb-6 font-medium">
            Zaufały nam instytucje finansowe:
          </p>

          <div className="flex flex-wrap justify-center items-center gap-8 mb-6">
            {trustBadges.map((badge) => (
              <div
                key={badge.name}
                className="flex flex-col items-center gap-2"
              >
                <div className="w-20 h-20 bg-white rounded-xl border border-emerald-200 flex items-center justify-center shadow-sm p-3">
                  {badge.type === 'image' ? (
                    <Image
                      src={badge.url}
                      alt={badge.alt}
                      width={80}
                      height={80}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <badge.icon className="w-8 h-8 text-emerald-600" />
                  )}
                </div>
                <span className="text-xs text-emerald-600/60">{badge.description}</span>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-3 bg-white border border-emerald-200 rounded-xl p-4">
            <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-700 leading-relaxed">
              <strong>Dlaczego to płatne?</strong> Ponieważ jesteś klientem, a nie produktem.
              Płacimy za bezpieczne, szyfrowane łącza bankowe (Tink/Visa).
              <strong> Nie sprzedajemy Twoich danych</strong> reklamodawcom.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
