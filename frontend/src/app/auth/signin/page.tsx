'use client';

import { signIn, useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useIntl } from "react-intl";
import { logger } from "@/lib/logger";

export default function SignIn() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const intl = useIntl();
  const callbackUrl = searchParams?.get("callbackUrl") || "/";
  const error = searchParams?.get("error");

  useEffect(() => {
    if (session?.user) {
      logger.debug('[auth][debug] Redirecting authenticated user to:', callbackUrl);
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
    logger.debug('[auth][debug] Initiating Google sign-in...');
    try {
      await signIn("google", { 
        callbackUrl,
      });
    } catch (error) {
      logger.error('[auth][error] Sign-in error:', error);
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
          <div className="flex justify-center">
            <button
              onClick={handleSignIn}
              className="gsi-material-button w-full max-w-sm"
              aria-label={intl.formatMessage({ id: 'auth.signInWithGoogle' })}
            >
              <div className="gsi-material-button-state" />
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon" aria-hidden="true">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    className="block h-5 w-5"
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
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {intl.formatMessage({ id: 'auth.continueWithGoogle' })}
                </span>
                <span className="sr-only">
                  {intl.formatMessage({ id: 'auth.signInWithGoogle' })}
                </span>
              </div>
            </button>
          </div>

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
