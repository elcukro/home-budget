'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, Lock, Server, Sparkles, Flame, Target } from 'lucide-react';
import Link from 'next/link';

const trustBadges = [
  { icon: Shield, label: 'Bezpieczeństwo bankowe' },
  { icon: Lock, label: 'Zgodność z RODO' },
  { icon: Server, label: 'Dane w UE' },
];

const FloatingIcon = ({
  Icon,
  className,
  delay = 0
}: {
  Icon: typeof Sparkles;
  className: string;
  delay?: number;
}) => (
  <div
    className={`absolute opacity-[0.07] animate-float ${className}`}
    style={{ animationDelay: `${delay}s` }}
  >
    <Icon className="w-12 h-12 text-emerald-600" />
  </div>
);

export default function FinalCTASection() {
  return (
    <section className="py-24 relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-amber-50">
      {/* Floating icons */}
      <FloatingIcon Icon={Sparkles} className="top-[15%] left-[10%]" delay={0} />
      <FloatingIcon Icon={Flame} className="top-[20%] right-[15%]" delay={1.5} />
      <FloatingIcon Icon={Target} className="bottom-[25%] left-[15%]" delay={2.5} />
      <FloatingIcon Icon={Sparkles} className="bottom-[20%] right-[10%]" delay={1} />

      {/* Gradient orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-200/40 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-emerald-900 mb-6">
          Twoja droga do wolności finansowej{' '}
          <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
            zaczyna się teraz
          </span>
        </h2>

        <p className="text-xl text-emerald-800/70 mb-8 max-w-2xl mx-auto">
          Dołącz do tysięcy Polaków, którzy odzyskali kontrolę nad swoimi pieniędzmi.
        </p>

        <Link href="/auth/signin">
          <Button
            size="lg"
            className="text-lg px-10 py-6 h-auto group mb-6 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-200 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-300 hover:-translate-y-0.5"
          >
            Zacznij 7-dniowy test
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>

        <p className="text-emerald-600/50 text-sm mb-12">
          7 dni Premium gratis • Bez karty kredytowej • Anuluj kiedy chcesz
        </p>

        {/* Trust Badges */}
        <div className="flex flex-wrap items-center justify-center gap-8">
          {trustBadges.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 text-emerald-700/70 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-emerald-100"
            >
              <Icon className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CSS for floating animation */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-15px) rotate(5deg);
          }
          50% {
            transform: translateY(-8px) rotate(-3deg);
          }
          75% {
            transform: translateY(-20px) rotate(3deg);
          }
        }
        .animate-float {
          animation: float 10s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}
