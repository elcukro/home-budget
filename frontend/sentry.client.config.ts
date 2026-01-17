import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% of transactions for performance monitoring

  // Session Replay - capture 10% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Only send errors in production
  enabled: process.env.NODE_ENV === "production",

  // Set environment
  environment: process.env.NODE_ENV,

  // Filter out noisy errors
  ignoreErrors: [
    // Browser extensions
    /ResizeObserver loop/,
    /ResizeObserver loop limit exceeded/,
    // Network errors that are expected
    /Failed to fetch/,
    /NetworkError/,
    /Load failed/,
    // User aborted requests
    /AbortError/,
  ],

  beforeSend(event) {
    // Don't send events in development
    if (process.env.NODE_ENV === "development") {
      return null;
    }
    return event;
  },
});
