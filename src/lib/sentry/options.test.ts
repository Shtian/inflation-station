import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { getSentryOptions } from "./options";

function sample(name: string, url?: string, parentSampled?: boolean) {
  const tracesSampler = getSentryOptions({
    dsn: undefined,
    environment: undefined,
  }).tracesSampler;
  if (!tracesSampler) throw new Error("tracesSampler is not configured");
  return tracesSampler({
    name,
    attributes: {},
    normalizedRequest: url ? { url } : undefined,
    parentSampled,
    inheritOrSampleWith: (fallback) =>
      parentSampled === undefined ? fallback : Number(parentSampled),
  });
}

describe("getSentryOptions tracesSampler", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("traces every chat request, even when the browser trace was dropped", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sample("POST /api/assistant/chat", undefined, false)).toBe(1);
    expect(sample("POST", "http://localhost/api/feedback/chat", false)).toBe(1);
    expect(sample("POST /api/onboarding/chat")).toBe(1);
  });

  it("samples other production traffic at 10% unless the parent decided", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sample("GET /transactions")).toBe(0.1);
    expect(sample("GET /api/assistant/chat-history")).toBe(0.1);
    expect(sample("GET /transactions", undefined, true)).toBe(1);
  });
});
