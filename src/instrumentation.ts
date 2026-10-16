import * as Sentry from "@sentry/nextjs";

// The app has no edge routes or proxy, so only the Node runtime needs Sentry.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/sentry/server");
  }
}

export const onRequestError = Sentry.captureRequestError;
