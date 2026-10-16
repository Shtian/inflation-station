import type { BrowserOptions, NodeOptions } from "@sentry/nextjs";

// Shared by the browser and Node runtimes. Sentry stays off until a DSN is
// configured, so local dev, tests, and instances without Sentry send nothing.
//
// Financial data must not leave the instance, so every payload category is
// switched off: only error messages, stack traces, and source context are sent.
// Session replay is left out, and production traces are sampled at the docs'
// recommended 10% to fit the free tier.
export function getSentryOptions(): BrowserOptions & NodeOptions {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "production",
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      stackFrameVariables: false,
    },
  };
}
