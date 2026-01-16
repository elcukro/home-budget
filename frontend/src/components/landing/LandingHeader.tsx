'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Menu, X, Flame } from 'lucide-react';

export default function LandingHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-emerald-100'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-200">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-emerald-800">FiredUp</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={() => scrollToSection('features')}
              className="text-sm text-emerald-700/70 hover:text-emerald-800 transition-colors font-medium"
            >
              Funkcje
            </button>
            <button
              onClick={() => scrollToSection('pricing')}
              className="text-sm text-emerald-700/70 hover:text-emerald-800 transition-colors font-medium"
            >
              Cennik
            </button>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/auth/signin">
              <Button
                variant="ghost"
                size="sm"
                className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
              >
                Zaloguj się
              </Button>
            </Link>
            <Link href="/auth/signin">
              <Button
                size="sm"
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md shadow-emerald-200"
              >
                Rozpocznij za darmo
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-emerald-700 hover:text-emerald-800"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-emerald-100 bg-white/95 backdrop-blur-md">
            <nav className="flex flex-col gap-4">
              <button
                onClick={() => scrollToSection('features')}
                className="text-left text-emerald-700 hover:text-emerald-800 transition-colors font-medium"
              >
                Funkcje
              </button>
              <button
                onClick={() => scrollToSection('pricing')}
                className="text-left text-emerald-700 hover:text-emerald-800 transition-colors font-medium"
              >
                Cennik
              </button>
              <div className="flex items-center gap-4 pt-4 border-t border-emerald-100">
                <Link href="/auth/signin" className="flex-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-emerald-700 hover:bg-emerald-50"
                  >
                    Zaloguj się
                  </Button>
                </Link>
                <Link href="/auth/signin" className="flex-1">
                  <Button
                    size="sm"
                    className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                  >
                    Rozpocznij
                  </Button>
                </Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
