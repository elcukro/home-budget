import Link from 'next/link';
import { Flame } from 'lucide-react';
import ManualSidebar from '@/components/manual/ManualSidebar';
import LandingFooter from '@/components/landing/LandingFooter';

export const metadata = {
  title: 'Podręcznik - FiredUp',
  description: 'Poznaj wszystkie funkcje FiredUp. Szczegółowy podręcznik użytkownika z opisami i zrzutami ekranu.',
};

export default function ManualLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-emerald-50/20">
      {/* Simplified header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shadow-sm border-b border-emerald-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-200">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-emerald-800">FiredUp</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/manual"
                className="text-sm font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
              >
                Podręcznik
              </Link>
              <Link
                href="/#pricing"
                className="text-sm font-medium text-emerald-700/70 hover:text-emerald-800 transition-colors"
              >
                Cennik
              </Link>
              <Link
                href="/auth/signin"
                className="text-sm font-medium px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md shadow-emerald-200"
              >
                Wypróbuj za darmo
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Content with sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          <ManualSidebar />
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>

      <LandingFooter />
    </div>
  );
}
