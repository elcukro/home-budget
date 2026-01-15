'use client';

import Link from 'next/link';
import { FooterDisclaimer } from '@/components/TaxDisclaimer';

export default function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 border-t border-border bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8">
          {/* Main footer row */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-white font-bold text-lg">F</span>
              </div>
              <span className="font-bold text-xl text-primary">FiredUp</span>
            </div>

            {/* Links */}
            <nav className="flex flex-wrap items-center justify-center gap-6">
              <Link
                href="/pricing"
                className="text-secondary hover:text-primary transition-colors text-sm"
              >
                Cennik
              </Link>
              <Link
                href="/privacy"
                className="text-secondary hover:text-primary transition-colors text-sm"
              >
                Polityka prywatności
              </Link>
              <Link
                href="/terms"
                className="text-secondary hover:text-primary transition-colors text-sm"
              >
                Regulamin
              </Link>
            </nav>

            {/* Copyright */}
            <p className="text-sm text-secondary">
              © {currentYear} FiredUp. Wszelkie prawa zastrzeżone.
            </p>
          </div>

          {/* Disclaimer */}
          <div className="pt-6 border-t border-border text-center">
            <FooterDisclaimer />
          </div>
        </div>
      </div>
    </footer>
  );
}
