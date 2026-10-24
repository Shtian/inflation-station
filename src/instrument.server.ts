import * as Sentry from "@sentry/tanstackstart-react";
import { ENV } from "varlock/env";
import { labelAiAgentSpan } from "@/lib/sentry/ai-chat";
import { getSentryEnvironment } from "@/lib/sentry/environment";
import { getSentryOptions } from "@/lib/sentry/options";
import { getSentryRelease } from "@/lib/sentry/release";

Sentry.init({
  ...getSentryOptions({
    dsn: ENV.VITE_SENTRY_DSN,
    environment: getSentryEnvironment(),
  }),
  release: getSentryRelease(
    import.meta.env.VITE_APP_VERSION,
    import.meta.env.VITE_BUILD_SHA,
  ),
});
Sentry.getClient()?.on("spanStart", labelAiAgentSpan);
