import * as Sentry from "@sentry/nextjs";
import { labelAiAgentSpan } from "@/lib/sentry/ai-chat";
import { getSentryOptions } from "@/lib/sentry/options";

Sentry.init(
  getSentryOptions({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  }),
);
Sentry.getClient()?.on("spanStart", labelAiAgentSpan);
