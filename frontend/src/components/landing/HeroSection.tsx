'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-mint/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-lilac/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
          <Sparkles className="w-4 h-4" />
          Metoda Baby Steps + polski system finansowy (IKE/IKZE/PPK)
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-primary leading-tight mb-6">
          Wyobraź sobie życie bez długu
        </h1>

        {/* Subheadline */}
        <p className="text-xl sm:text-2xl text-secondary mb-8 max-w-3xl mx-auto">
          Gdzie każda złotówka ma sens, a przyszłość jest Twoja
        </p>

        {/* Description */}
        <p className="text-base sm:text-lg text-secondary/80 mb-12 max-w-2xl mx-auto leading-relaxed">
          Większość Polaków żyje od wypłaty do wypłaty. Kredyty, rachunki, ciągły stres.
          Ale nie musi tak być. Wolność finansowa to nie marzenie bogatych —
          to umiejętność, której możesz się nauczyć.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <Link href="/auth/signin">
            <Button size="lg" className="text-lg px-8 py-6 h-auto group">
              Zobacz swój pierwszy krok
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <button
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            className="text-secondary hover:text-primary transition-colors underline underline-offset-4"
          >
            Jak to działa?
          </button>
        </div>

        {/* Trust text */}
        <p className="text-sm text-secondary/60">
          7 dni Premium gratis • Bez karty kredytowej • Anuluj kiedy chcesz
        </p>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-secondary/30 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-secondary/50 rounded-full animate-pulse" />
        </div>
      </div>
    </section>
  );
}
