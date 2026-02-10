'use client';

import { signIn, useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { Flame, TrendingUp, PiggyBank, Wallet, Sparkles, AlertCircle } from "lucide-react";
import LegalOverlay from "@/components/landing/LegalOverlay";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

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

export default function SignIn() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const intl = useIntl();
  const error = searchParams?.get("error");
  const [legalOverlay, setLegalOverlay] = useState<'privacy' | 'terms' | null>(null);

  // Determine redirect based on onboarding status
  const isFirstLogin = session?.user?.isFirstLogin ?? true;
  const defaultCallbackUrl = isFirstLogin ? "/welcome" : "/dashboard";
  const callbackUrl = searchParams?.get("callbackUrl") || defaultCallbackUrl;

  useEffect(() => {
    if (session?.user) {
      logger.debug('[auth][debug] Redirecting authenticated user to:', callbackUrl, '(isFirstLogin:', isFirstLogin, ')');
      router.replace(callbackUrl);
    }
  }, [session, router, callbackUrl, isFirstLogin]);

  const handleSignIn = async () => {
    logger.debug('[auth][debug] Initiating Google sign-in...');
    try {
      await signIn("google", {
        callbackUrl,
      });
    } catch (error) {
      logger.error('[auth][error] Sign-in error:', error);
    }
  };

  if (status === "loading" || session?.user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-amber-50 fixed inset-0">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-emerald-700 font-medium">
            {intl.formatMessage({ id: 'auth.loading' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-amber-50 relative overflow-hidden fixed inset-0">
      {/* Floating background icons */}
      <FloatingIcon Icon={PiggyBank} className="top-[10%] left-[10%]" delay={0} />
      <FloatingIcon Icon={TrendingUp} className="top-[20%] right-[15%]" delay={1.5} />
      <FloatingIcon Icon={Wallet} className="bottom-[20%] left-[15%]" delay={3} />
      <FloatingIcon Icon={Sparkles} className="bottom-[15%] right-[10%]" delay={2} />
      <FloatingIcon Icon={PiggyBank} className="top-[50%] left-[5%]" delay={4} />
      <FloatingIcon Icon={TrendingUp} className="top-[40%] right-[5%]" delay={2.5} />

      <div className="w-full max-w-lg mx-4 relative z-10">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-emerald-100 p-8 md:p-12">
          {/* Logo/Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <Flame className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-emerald-900 mb-3">
              {intl.formatMessage({ id: 'auth.signIn.title' })}
            </h1>
            <p className="text-lg text-emerald-700/80 leading-relaxed">
              {intl.formatMessage({ id: 'auth.signIn.subtitle' })}
            </p>
          </div>

          {/* Error Messages */}
          {error && (
            <div
              role="alert"
              className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl border border-red-200"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">
                  {error === "OAuthSignin" && intl.formatMessage({ id: 'auth.errors.googleSignIn' })}
                  {error === "OAuthCallback" && intl.formatMessage({ id: 'auth.errors.googleCallback' })}
                  {error === "default" && intl.formatMessage({ id: 'auth.errors.default' })}
                </span>
              </div>
            </div>
          )}

          {/* Sign In Button */}
          <Button
            onClick={handleSignIn}
            className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium py-6 text-base rounded-xl shadow-md border border-gray-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 flex items-center justify-center gap-3"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="w-5 h-5"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            {intl.formatMessage({ id: 'auth.continueWithGoogle' })}
          </Button>

          {/* Terms and Privacy */}
          <p className="mt-6 text-center text-sm text-emerald-600/70">
            {intl.formatMessage({ id: 'auth.termsPrefix' })}{' '}
            <button
              onClick={() => setLegalOverlay('terms')}
              className="text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
            >
              {intl.formatMessage({ id: 'auth.termsOfService' })}
            </button>
            {' '}{intl.formatMessage({ id: 'auth.termsAnd' })}{' '}
            <button
              onClick={() => setLegalOverlay('privacy')}
              className="text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
            >
              {intl.formatMessage({ id: 'auth.privacyPolicy' })}
            </button>
          </p>

        </div>

        {/* Bottom decorative element */}
        <div className="flex justify-center mt-6">
          <div className="flex items-center gap-2 text-emerald-500/50 text-sm">
            <Flame className="w-4 h-4" />
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

      {/* Legal Overlay - outside card container so it's not constrained */}
      {legalOverlay && (
        <LegalOverlay
          type={legalOverlay}
          onClose={() => setLegalOverlay(null)}
        />
      )}
    </div>
  );
}
