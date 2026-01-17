'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useSearchParams } from 'next/navigation';

// Initialize PostHog only on client-side and in production or with explicit key
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false, // We'll capture manually for SPA routing
    capture_pageleave: true,
    autocapture: true,
    // Respect user privacy
    respect_dnt: true,
    // Session recording
    enable_recording_console_log: false,
    // Disable in development unless explicitly enabled
    loaded: (posthog) => {
      if (process.env.NODE_ENV === 'development') {
        posthog.opt_out_capturing();
      }
    },
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

  // Identify user when logged in
  useEffect(() => {
    if (session?.user?.email && posthog) {
      posthog.identify(session.user.email, {
        email: session.user.email,
        name: session.user.name,
      });
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
