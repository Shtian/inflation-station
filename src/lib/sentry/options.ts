import type { Options } from "@sentry/core";

const AI_CHAT_PATH = /\/api\/(assistant|feedback|onboarding)\/chat(?![\w-])/;

const tracesSampler: NonNullable<Options["tracesSampler"]> = ({
  name,
  normalizedRequest,
  inheritOrSampleWith,
}) => {
  if (AI_CHAT_PATH.test(`${name} ${normalizedRequest?.url ?? ""}`)) {
    return 1.0;
  }
  return inheritOrSampleWith(
    process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  );
};

// Shared by the browser and Node runtimes. Sentry stays off until a DSN is
// configured, so local dev, tests, and instances without Sentry send nothing.
//
// Financial data stays out of Sentry, so every payload category is switched
// off except AI chats: their prompts, answers, and tool calls are sent so
// Agent Tracing can show full transcripts.
// Session replay is left out, and production traces are sampled at the docs'
// recommended 10% to fit the free tier. Chat requests are always traced, so
// Sentry Conversations shows every turn of a chat rather than one in ten.
//
// Varlock inlines the DSN into the client bundle at build time, so it changes
// only on a rebuild. The environment is read when the server boots.
export function getSentryOptions({
  dsn,
  environment,
}: {
  dsn: string | undefined;
  environment: string | undefined;
}) {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: environment || "production",
    tracesSampler,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: true, outputs: true },
      databaseQueryData: false,
      stackFrameVariables: false,
    },
  } satisfies Options;
}
