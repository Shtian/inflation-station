import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

const SCRIPT = path.join(__dirname, "report-image-metrics.mjs");
const SHA = "0123456789abcdef0123456789abcdef01234567";

type Request = { url?: string; auth?: string; body: string };
type Metric = {
  name: string;
  type: string;
  unit?: string;
  value: number;
  attributes: Record<string, { value: string }>;
};

let server: Server;
let port: number;
let requests: Request[];

beforeEach(async () => {
  requests = [];
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      requests.push({
        url: req.url,
        auth: req.headers["x-sentry-auth"] as string | undefined,
        body,
      });
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterEach(() => {
  server.close();
});

function run(env: Record<string, string>) {
  return new Promise<void>((resolve, reject) =>
    execFile(
      process.execPath,
      [SCRIPT],
      { env: { ...process.env, ...env } },
      (error) => (error ? reject(error) : resolve()),
    ),
  );
}

function baseEnv(overrides: Record<string, string> = {}) {
  const now = Date.now();
  return {
    VITE_SENTRY_DSN: `http://publickey@127.0.0.1:${port}/42`,
    IMAGE_VERSION: "1.2.3",
    SOURCE_COMMIT: SHA,
    IMAGE_START_MS: String(now - 60_000),
    IMAGE_BUILD_START_MS: String(now - 45_000),
    IMAGE_BUILD_OUTCOME: "success",
    IMAGE_JOB_STATUS: "success",
    SENTRY_ENVIRONMENT: "",
    ...overrides,
  };
}

function metrics(): Metric[] {
  const lines = requests[0].body.split("\n").map((l) => JSON.parse(l));
  expect(lines[1]).toMatchObject({
    type: "trace_metric",
    item_count: lines[2].items.length,
  });
  return lines[2].items;
}

describe("report-image-metrics", () => {
  it("does nothing without a DSN", async () => {
    await run({ ...baseEnv(), VITE_SENTRY_DSN: "" });
    expect(requests).toHaveLength(0);
  });

  it("sends build and job durations to the project's envelope endpoint", async () => {
    await run(baseEnv());

    expect(requests[0].url).toBe("/api/42/envelope/");
    expect(requests[0].auth).toContain("sentry_key=publickey");
    const [build, job, completed] = metrics();
    expect(build).toMatchObject({
      name: "image.build.duration",
      unit: "millisecond",
    });
    expect(build.value).toBeGreaterThanOrEqual(45_000);
    expect(build.value).toBeLessThan(job.value);
    expect(job).toMatchObject({ name: "image.duration", type: "distribution" });
    expect(job.value).toBeGreaterThanOrEqual(60_000);
    expect(completed).toMatchObject({
      name: "image.completed",
      type: "counter",
      value: 1,
    });
    expect(completed.attributes).toMatchObject({
      "sentry.release": { value: "inflation-station@1.2.3+0123456" },
      "sentry.environment": { value: "production" },
      outcome: { value: "success" },
    });
  });

  it("reports a failed build as a failure", async () => {
    await run(
      baseEnv({ IMAGE_BUILD_OUTCOME: "failure", IMAGE_JOB_STATUS: "failure" }),
    );

    expect(metrics().map((m) => m.attributes.outcome.value)).toEqual([
      "failure",
      "failure",
      "failure",
    ]);
  });

  it("skips the build duration when the job fails before the build starts", async () => {
    await run(
      baseEnv({
        IMAGE_BUILD_START_MS: "",
        IMAGE_BUILD_OUTCOME: "skipped",
        IMAGE_JOB_STATUS: "failure",
      }),
    );

    expect(metrics().map((m) => m.name)).toEqual([
      "image.duration",
      "image.completed",
    ]);
  });

  it("does not fail the release when Sentry is unreachable", async () => {
    server.close();
    await expect(run(baseEnv())).resolves.toBeUndefined();
  });
});
