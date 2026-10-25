import * as Sentry from "@sentry/tanstackstart-react";
import { ENV } from "varlock/env";
import { getSentryOptions } from "@/lib/sentry/options";
import { getSentryRelease } from "@/lib/sentry/release";

Sentry.init({
  ...getSentryOptions({
    dsn: ENV.VITE_SENTRY_DSN,
    // The server renders its runtime environment into the document head.
    environment:
      document
        .querySelector('meta[name="sentry-environment"]')
        ?.getAttribute("content") ?? undefined,
  }),
  release: getSentryRelease(
    import.meta.env.VITE_APP_VERSION,
    import.meta.env.VITE_BUILD_SHA,
  ),
  // Proxy browser events through the app so ad blockers don't drop them.
  tunnel: "/monitoring",
});
