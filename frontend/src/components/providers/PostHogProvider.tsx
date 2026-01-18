'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useSearchParams } from 'next/navigation';

// Initialize PostHog only on client-side
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: '/t', // Reverse proxy to bypass ad blockers
    ui_host: 'https://eu.posthog.com', // For toolbar and feature flags UI
    person_profiles: 'identified_only',
    capture_pageview: false, // We'll capture manually for SPA routing
    capture_pageleave: true,
    autocapture: true,
    persistence: 'localStorage',
  });
}

function PostHogPageViewInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  // Track pageviews
  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname;
      if (searchParams?.toString()) {
        url = url + '?' + searchParams.toString();
      }
      posthog.capture('$pageview', { $current_url: url });
    }
  }, [pathname, searchParams]);

  // Identify user when logged in and track signup for new users
  useEffect(() => {
    if (session?.user?.email && posthog) {
      const email = session.user.email;
      const signupKey = `posthog_signup_tracked_${email}`;

      // Check if this is a new user (first time we've seen them)
      const hasTrackedSignup = localStorage.getItem(signupKey);

      posthog.identify(email, {
        email: email,
        name: session.user.name,
      });

      // Track signup_completed for new users
      if (!hasTrackedSignup) {
        posthog.capture('signup_completed', {
          method: 'google', // Assuming Google OAuth
        });
        localStorage.setItem(signupKey, 'true');
      } else {
        // Track login for returning users
        posthog.capture('login');
      }
    }
  }, [session]);

  return null;
}

function PostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageViewInner />
    </Suspense>
  );
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}
