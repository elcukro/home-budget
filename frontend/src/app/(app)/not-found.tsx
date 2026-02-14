'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft, Search, HelpCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-amber-50 relative overflow-hidden">
      {/* Gradient orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-200/40 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-amber-200/30 rounded-full blur-3xl" />

      <div className="relative z-10 text-center px-4 max-w-2xl mx-auto">
        {/* 404 Number */}
        <div className="mb-8">
          <span className="text-[150px] sm:text-[200px] font-bold bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent leading-none">
            404
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-4xl font-bold text-emerald-900 mb-4">
          Ups! Ta strona poszła na emeryturę
        </h1>

        {/* Description */}
        <p className="text-lg text-emerald-700/70 mb-8 max-w-md mx-auto">
          Wygląda na to, że ta strona osiągnęła wolność finansową i już tu nie pracuje.
          Ale nie martw się — Twoja droga do finansowej niezależności wciąż czeka!
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <Link href="/">
            <Button
              size="lg"
              className="group bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-200 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-300"
            >
              <Home className="mr-2 w-5 h-5" />
              Strona główna
            </Button>
          </Link>
          <Button
            variant="outline"
            size="lg"
            onClick={() => window.history.back()}
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            <ArrowLeft className="mr-2 w-5 h-5" />
            Wróć do poprzedniej
          </Button>
        </div>

        {/* Helpful links */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-emerald-600">
          <Link href="/dashboard" className="flex items-center gap-2 hover:text-emerald-800 transition-colors">
            <Search className="w-4 h-4" />
            Dashboard
          </Link>
          <Link href="/#faq" className="flex items-center gap-2 hover:text-emerald-800 transition-colors">
            <HelpCircle className="w-4 h-4" />
            FAQ
          </Link>
        </div>
      </div>
    </div>
  );
}
