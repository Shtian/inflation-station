// The release workflow's image job runs this last, even on failure, to send
// its timings to Sentry as metrics. Without a DSN it does nothing.
const e = process.env;
const dsn = e.VITE_SENTRY_DSN;
if (!dsn) process.exit(0);

const { protocol, username, host, pathname } = new URL(dsn);
const projectId = pathname.split("/").pop();
const prefix = pathname.slice(0, pathname.lastIndexOf("/"));
const url = `${protocol}//${host}${prefix}/api/${projectId}/envelope/`;

const end = Date.now();
// Matches getSentryRelease, so metrics share the release the build uploads.
const release = `inflation-station@${e.IMAGE_VERSION}+${e.SOURCE_COMMIT.slice(0, 7)}`;
const traceId = crypto.randomUUID().replaceAll("-", "");
const outcome = (status) => (status === "success" ? "success" : "failure");

const metric = (name, type, unit, value, attributes) => ({
  timestamp: end / 1000,
  trace_id: traceId,
  name,
  type,
  ...(unit && { unit }),
  value,
  attributes: Object.fromEntries(
    Object.entries({
      "sentry.release": release,
      "sentry.environment": e.SENTRY_ENVIRONMENT || "production",
      ...attributes,
    })
      .filter(([, v]) => v)
      .map(([k, v]) => [k, { value: v, type: "string" }]),
  ),
});

const metrics = [];
// A job that fails before the build step never records its start.
if (e.IMAGE_BUILD_START_MS) {
  metrics.push(
    metric(
      "image.build.duration",
      "distribution",
      "millisecond",
      end - Number(e.IMAGE_BUILD_START_MS),
      { outcome: outcome(e.IMAGE_BUILD_OUTCOME) },
    ),
  );
}
metrics.push(
  metric(
    "image.duration",
    "distribution",
    "millisecond",
    end - Number(e.IMAGE_START_MS),
    { outcome: outcome(e.IMAGE_JOB_STATUS) },
  ),
  metric("image.completed", "counter", undefined, 1, {
    outcome: outcome(e.IMAGE_JOB_STATUS),
  }),
);

const body = [
  {},
  {
    type: "trace_metric",
    item_count: metrics.length,
    content_type: "application/vnd.sentry.items.trace-metric+json",
  },
  { version: 2, items: metrics },
]
  .map((line) => JSON.stringify(line))
  .join("\n");

// Metrics are best-effort and never fail the release.
try {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-sentry-envelope",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${username}, sentry_client=report-image-metrics/1`,
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) console.warn(`Sentry responded ${res.status}`);
} catch (error) {
  console.warn(`Could not send metrics to Sentry: ${error}`);
}
