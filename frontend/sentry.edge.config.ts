import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://c40ac91262b9394a5ca3741b80dc186a@o4510725745868800.ingest.de.sentry.io/4510725755699280",

  // Performance Monitoring
  tracesSampleRate: 0.1,

  // Only send errors in production
  enabled: process.env.NODE_ENV === "production",

  // Set environment
  environment: process.env.NODE_ENV,
});
