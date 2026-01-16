'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, PiggyBank, TrendingUp, Wallet, Target } from 'lucide-react';

const FloatingIcon = ({
  Icon,
  className,
  delay = 0
}: {
  Icon: typeof PiggyBank;
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

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 pb-12 overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-amber-50">
      {/* Floating background icons - reduced for cleaner look with illustration */}
      <FloatingIcon Icon={PiggyBank} className="top-[20%] left-[5%]" delay={0} />
      <FloatingIcon Icon={TrendingUp} className="top-[15%] right-[5%]" delay={1.5} />
      <FloatingIcon Icon={Wallet} className="bottom-[20%] left-[8%]" delay={3} />
      <FloatingIcon Icon={Target} className="bottom-[15%] right-[5%]" delay={2} />

      {/* Gradient orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-200/40 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-100/30 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left side - Text content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium mb-6 border border-emerald-200/50">
              <Sparkles className="w-4 h-4" />
              Metoda Baby Steps + polski system finansowy
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-emerald-900 leading-tight mb-6">
              Wyobraź sobie życie{' '}
              <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                bez długu
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl sm:text-2xl text-emerald-800/70 mb-6">
              Gdzie każda złotówka ma sens, a przyszłość jest Twoja
            </p>

            {/* Description */}
            <p className="text-base sm:text-lg text-emerald-700/60 mb-8 max-w-xl leading-relaxed">
              Większość Polaków żyje od wypłaty do wypłaty. Kredyty, rachunki, ciągły stres.
              Ale nie musi tak być. Wolność finansowa to nie marzenie bogatych —
              to umiejętność, której możesz się nauczyć.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4 mb-6">
              <Link href="/auth/signin">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 h-auto group bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-200 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-300 hover:-translate-y-0.5"
                >
                  Zobacz swój pierwszy krok
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <button
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-emerald-700 hover:text-emerald-800 transition-colors underline underline-offset-4 font-medium"
              >
                Jak to działa?
              </button>
            </div>

            {/* Trust text */}
            <p className="text-sm text-emerald-600/50">
              7 dni Premium gratis • Bez karty kredytowej • Anuluj kiedy chcesz
            </p>
          </div>

          {/* Right side - Hero illustration */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative animate-float-slow">
              <Image
                src="/images/hero-illustration.png"
                alt="Uwolnij się od długów z FiredUp"
                width={600}
                height={335}
                className="w-full max-w-lg lg:max-w-xl drop-shadow-2xl"
                priority
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce hidden lg:block">
        <div className="w-6 h-10 rounded-full border-2 border-emerald-300/50 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-emerald-400/60 rounded-full animate-pulse" />
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
        @keyframes float-slow {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        .animate-float {
          animation: float 10s ease-in-out infinite;
        }
        .animate-float-slow {
          animation: float-slow 6s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
}
