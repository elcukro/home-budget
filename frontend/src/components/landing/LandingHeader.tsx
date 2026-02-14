'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Menu, X, Flame } from 'lucide-react';

const scrollLinks = [
  { id: 'baby-steps', label: 'Metoda 7 Kroków' },
  { id: 'features', label: 'Funkcje' },
  { id: 'testimonials', label: 'Nasi użytkownicy' },
  { id: 'pricing', label: 'Cennik' },
  { id: 'faq', label: 'FAQ' },
];

const pageLinks = [
  { href: '/manual', label: 'Podręcznik' },
  { href: '/blog', label: 'Blog' },
];

export default function LandingHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    const sectionIds = scrollLinks.map((l) => l.id);

    const handleScroll = () => {
      const y = window.scrollY;
      setIsScrolled(y > 20);

      // Scroll-spy: find the last section whose top is above the scroll position
      const scrollPos = y + 120;
      let current: string | null = null;

      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.offsetTop <= scrollPos) {
          current = id;
        }
      }

      // Clear when at the very top (hero area)
      if (y < 100) current = null;

      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const top = element.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top, behavior: 'smooth' });
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
            {scrollLinks.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className={`text-sm font-medium transition-colors ${
                  activeSection === id
                    ? 'text-emerald-800 border-b-2 border-emerald-500 pb-0.5'
                    : 'text-emerald-700/70 hover:text-emerald-800'
                }`}
              >
                {label}
              </button>
            ))}
            {pageLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-sm font-medium text-emerald-700/70 hover:text-emerald-800 transition-colors"
              >
                {label}
              </Link>
            ))}
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
              {scrollLinks.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => scrollToSection(id)}
                  className={`text-left font-medium transition-colors ${
                    activeSection === id
                      ? 'text-emerald-800'
                      : 'text-emerald-700 hover:text-emerald-800'
                  }`}
                >
                  {label}
                </button>
              ))}
              {pageLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-left font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
                >
                  {label}
                </Link>
              ))}
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
