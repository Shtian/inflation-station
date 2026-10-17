import * as Sentry from "@sentry/nextjs";
import { labelAiAgentSpan } from "@/lib/sentry/ai-chat";
import { getSentryOptions } from "@/lib/sentry/options";

Sentry.init(getSentryOptions());
Sentry.getClient()?.on("spanStart", labelAiAgentSpan);
