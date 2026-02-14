import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-emerald-50/20">
      <LandingHeader />
      <main className="pt-16">
        {children}
      </main>
      <LandingFooter />
    </div>
  );
}
