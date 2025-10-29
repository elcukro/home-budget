'use client';

import { signIn, useSession } from "next-auth/react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useIntl } from "react-intl";

export default function SignIn() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const intl = useIntl();
  const callbackUrl = searchParams?.get("callbackUrl") || "/";
  const error = searchParams?.get("error");

  useEffect(() => {
    if (session?.user) {
      console.log('[auth][debug] Redirecting authenticated user to:', callbackUrl);
      router.replace(callbackUrl);
    }
  }, [session, router, callbackUrl]);

  if (status === "loading" || session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <div className="text-primary font-medium">
            {intl.formatMessage({ id: 'auth.loading' })}
          </div>
        </div>
      </div>
    );
  }

  const handleSignIn = async () => {
    console.log('[auth][debug] Initiating Google sign-in...');
    try {
      await signIn("google", { 
        callbackUrl,
      });
    } catch (error) {
      console.error('[auth][error] Sign-in error:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md mx-4">
        <div className="bg-card rounded-lg shadow-lg p-8 border border-default">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-primary mb-2">
              {intl.formatMessage({ id: 'auth.welcome' })}
            </h1>
            <p className="text-secondary">
              {intl.formatMessage({ id: 'auth.signInPrompt' })}
            </p>
          </div>

          {/* Error Messages */}
          {error && (
            <div 
              role="alert"
              className="mb-6 bg-destructive/15 text-destructive p-4 rounded-lg border border-destructive"
            >
              <div className="flex items-center">
                <svg 
                  className="w-5 h-5 mr-2 flex-shrink-0" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
                <span>
                  {error === "OAuthSignin" && intl.formatMessage({ id: 'auth.errors.googleSignIn' })}
                  {error === "OAuthCallback" && intl.formatMessage({ id: 'auth.errors.googleCallback' })}
                  {error === "default" && intl.formatMessage({ id: 'auth.errors.default' })}
                </span>
              </div>
            </div>
          )}

          {/* Sign In Button */}
          <button
            onClick={handleSignIn}
            className="w-full flex items-center justify-center px-4 py-3 border border-default rounded-lg shadow-sm text-base font-medium text-primary bg-card hover:bg-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            aria-label={intl.formatMessage({ id: 'auth.signInWithGoogle' })}
          >
            <Image
              src="/google.svg"
              alt=""
              width={20}
              height={20}
              className="mr-3"
              aria-hidden="true"
            />
            <span>{intl.formatMessage({ id: 'auth.continueWithGoogle' })}</span>
          </button>

          {/* Terms and Privacy */}
          <p className="mt-6 text-center text-sm text-secondary">
            {intl.formatMessage({ id: 'auth.termsPrefix' })}{' '}
            <a 
              href="#" 
              className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded"
            >
              {intl.formatMessage({ id: 'auth.termsOfService' })}
            </a>
            {' '}{intl.formatMessage({ id: 'auth.termsAnd' })}{' '}
            <a 
              href="#" 
              className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded"
            >
              {intl.formatMessage({ id: 'auth.privacyPolicy' })}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
} 
