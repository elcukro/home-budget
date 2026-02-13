'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { manualPages } from './manualPages';

export { manualPages } from './manualPages';
export type { ManualPage } from './manualPages';

export default function ManualSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-40 p-3 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-200"
        aria-label="Menu podręcznika"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-16 z-30
          ${isOpen ? 'left-0' : '-left-full'} lg:left-0
          w-64 lg:w-56 h-[calc(100vh-4rem)] lg:h-auto lg:max-h-[calc(100vh-5rem)]
          bg-white lg:bg-transparent
          border-r lg:border-r-0 border-emerald-100
          overflow-y-auto
          transition-all duration-300 lg:transition-none
          pt-4 pb-8 px-3
          shrink-0
        `}
      >
        <nav className="space-y-1">
          <Link
            href="/manual"
            className={`block px-3 py-2 rounded-lg text-sm font-semibold transition-colors mb-3 ${
              pathname === '/manual'
                ? 'text-emerald-800 bg-emerald-50'
                : 'text-emerald-700/70 hover:text-emerald-800 hover:bg-emerald-50/50'
            }`}
            onClick={() => setIsOpen(false)}
          >
            Wszystkie rozdziały
          </Link>
          <div className="h-px bg-emerald-100 mb-2" />
          {manualPages.map((page) => {
            const Icon = page.icon;
            const isActive = pathname === `/manual/${page.slug}`;
            return (
              <Link
                key={page.slug}
                href={`/manual/${page.slug}`}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'text-emerald-700/70 hover:text-emerald-800 hover:bg-emerald-50/50'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-600' : ''}`} />
                <span>{page.title}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
