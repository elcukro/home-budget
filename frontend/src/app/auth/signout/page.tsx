'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useIntl } from 'react-intl';
import Image from 'next/image';
import { LogIn, Lightbulb, Sparkles, TrendingUp, PiggyBank, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    className={`absolute opacity-10 animate-float ${className}`}
    style={{ animationDelay: `${delay}s` }}
  >
    <Icon className="w-12 h-12 text-emerald-600" />
  </div>
);

export default function SignOutPage() {
  const intl = useIntl();
  const router = useRouter();
  const [randomTip, setRandomTip] = useState<string>('');
  const [isSigningOut, setIsSigningOut] = useState(true);

  useEffect(() => {
    // Select random tip index (0-9)
    const randomIndex = Math.floor(Math.random() * 10);
    const tipKey = `auth.signedOut.tip${randomIndex}`;
    setRandomTip(intl.formatMessage({ id: tipKey }));

    // Perform sign out
    const performSignOut = async () => {
      try {
        await signOut({ redirect: false });
      } finally {
        setIsSigningOut(false);
      }
    };

    performSignOut();
  }, [intl]);

  const handleBackToLogin = () => {
    router.push('/auth/signin');
  };

  if (isSigningOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-amber-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-emerald-700 font-medium">
            {intl.formatMessage({ id: 'common.loading' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-amber-50 relative overflow-hidden">
      {/* Floating background icons */}
      <FloatingIcon Icon={PiggyBank} className="top-[10%] left-[10%]" delay={0} />
      <FloatingIcon Icon={TrendingUp} className="top-[20%] right-[15%]" delay={1.5} />
      <FloatingIcon Icon={Wallet} className="bottom-[20%] left-[15%]" delay={3} />
      <FloatingIcon Icon={Sparkles} className="bottom-[15%] right-[10%]" delay={2} />
      <FloatingIcon Icon={PiggyBank} className="top-[50%] left-[5%]" delay={4} />
      <FloatingIcon Icon={TrendingUp} className="top-[40%] right-[5%]" delay={2.5} />

      <div className="w-full max-w-lg mx-4 relative z-10">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-emerald-100 p-8 md:p-12">
          {/* Illustration */}
          <div className="flex justify-center mb-6">
            <div className="relative w-48 h-48 md:w-56 md:h-56">
              <Image
                src="/images/signout-illustration.jpg"
                alt=""
                fill
                className="object-contain rounded-2xl"
                priority
              />
            </div>
          </div>

          {/* Main message */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-emerald-900 mb-3">
              {intl.formatMessage({ id: 'auth.signedOut.title' })}
            </h1>
            <p className="text-lg text-emerald-700/80 leading-relaxed">
              {intl.formatMessage({ id: 'auth.signedOut.subtitle' })}
            </p>
          </div>

          {/* Tip card */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 mb-8 border border-amber-200/50">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-amber-600" />
              </div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-700">
                {intl.formatMessage({ id: 'auth.signedOut.tipTitle' })}
              </h2>
            </div>
            <p className="text-amber-900/80 leading-relaxed">
              {randomTip}
            </p>
          </div>

          {/* Back to login button */}
          <Button
            onClick={handleBackToLogin}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-6 text-lg rounded-xl shadow-lg shadow-emerald-200 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-300 hover:-translate-y-0.5"
          >
            <LogIn className="w-5 h-5 mr-2" />
            {intl.formatMessage({ id: 'auth.signedOut.backToLogin' })}
          </Button>

          {/* Footer message */}
          <p className="text-center text-emerald-600/70 text-sm mt-6">
            {intl.formatMessage({ id: 'auth.signedOut.footer' })}
          </p>
        </div>

        {/* Bottom decorative element */}
        <div className="flex justify-center mt-6">
          <div className="flex items-center gap-2 text-emerald-500/50 text-sm">
            <PiggyBank className="w-4 h-4" />
            <span>FiredUp</span>
          </div>
        </div>
      </div>

      {/* CSS for floating animation */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-10px) rotate(5deg);
          }
          50% {
            transform: translateY(-5px) rotate(-3deg);
          }
          75% {
            transform: translateY(-15px) rotate(3deg);
          }
        }
        .animate-float {
          animation: float 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
