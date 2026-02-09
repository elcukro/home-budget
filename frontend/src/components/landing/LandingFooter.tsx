'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Flame } from 'lucide-react';
import { FooterDisclaimer } from '@/components/TaxDisclaimer';
import LegalOverlay from './LegalOverlay';

export default function LandingFooter() {
  const currentYear = new Date().getFullYear();
  const [overlay, setOverlay] = useState<'privacy' | 'terms' | null>(null);

  return (
    <>
      <footer className="py-12 border-t border-emerald-100 bg-gradient-to-b from-white to-emerald-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8">
            {/* Main footer row */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Logo */}
              <Link href="/" className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-200">
                  <Flame className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl text-emerald-800">FiredUp</span>
              </Link>

              {/* Links */}
              <nav className="flex flex-wrap items-center justify-center gap-6">
                <button
                  onClick={() => setOverlay('privacy')}
                  className="text-emerald-700/70 hover:text-emerald-800 transition-colors text-sm font-medium"
                >
                  Polityka prywatności
                </button>
                <button
                  onClick={() => setOverlay('terms')}
                  className="text-emerald-700/70 hover:text-emerald-800 transition-colors text-sm font-medium"
                >
                  Regulamin
                </button>
              </nav>

              {/* Copyright */}
              <p className="text-sm text-emerald-600/60">
                © {currentYear} FiredUp. Wszelkie prawa zastrzeżone.
              </p>
            </div>

            {/* Disclaimer */}
            <div className="pt-6 border-t border-emerald-100 text-center">
              <FooterDisclaimer />
            </div>
          </div>
        </div>
      </footer>

      {/* Legal overlay */}
      {overlay && (
        <LegalOverlay type={overlay} onClose={() => setOverlay(null)} />
      )}
    </>
  );
}
