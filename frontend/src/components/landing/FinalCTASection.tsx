'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, Lock, Server } from 'lucide-react';
import Link from 'next/link';

const trustBadges = [
  { icon: Shield, label: 'Bezpieczeństwo bankowe' },
  { icon: Lock, label: 'Zgodność z RODO' },
  { icon: Server, label: 'Dane w UE' },
];

export default function FinalCTASection() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-mint/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-6">
          Twoja droga do wolności finansowej zaczyna się teraz
        </h2>

        <p className="text-xl text-secondary mb-8 max-w-2xl mx-auto">
          Dołącz do tysięcy Polaków, którzy odzyskali kontrolę nad swoimi pieniędzmi.
        </p>

        <Link href="/auth/signin">
          <Button size="lg" className="text-lg px-10 py-6 h-auto group mb-6">
            Zacznij 7-dniowy test
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>

        <p className="text-secondary text-sm mb-12">
          7 dni Premium gratis • Bez karty kredytowej • Anuluj kiedy chcesz
        </p>

        {/* Trust Badges */}
        <div className="flex flex-wrap items-center justify-center gap-8">
          {trustBadges.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-secondary">
              <Icon className="w-5 h-5 text-primary" />
              <span className="text-sm">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
