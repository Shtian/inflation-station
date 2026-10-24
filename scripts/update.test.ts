import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

const ROOT = path.join(__dirname, "..");

let tmp: string;
let app: string;
let bin: string;
let logs: string;

const fakes: Record<string, string> = {
  pnpm: `
if [ "$1" = "\${FAKE_FAIL:-}" ]; then echo "boom $1"; exit "\${FAKE_FAIL_CODE:-1}"; fi
case "$1" in
  build)
    rm -rf .output
    mkdir -p .output/server .output/public/assets
    echo "server $FAKE_SHA" > .output/server/index.mjs
    echo "chunk $FAKE_SHA" > .output/public/assets/chunk.js
    ;;
esac
echo "pnpm $1 ok"
`,
  git: `echo "$FAKE_SHA"`,
  pm2: `
echo "$*" >> "$LOGS/pm2.log"
case "$1" in
  jlist)
    if [ -f "$LOGS/pm2-path" ]; then
      printf '[{"name":"inflation-station","pm2_env":{"pm_exec_path":"%s"}}]' "$(cat "$LOGS/pm2-path")"
    else
      echo '[]'
    fi
    ;;
  delete) rm -f "$LOGS/pm2-path" ;;
  start)
    node -e '
      const path = require("path");
      const app = require(path.resolve(process.argv[1])).apps[0];
      const fs = require("fs");
      fs.writeFileSync(process.argv[2] + "/pm2-path", path.resolve(app.cwd, app.script));
      fs.writeFileSync(process.argv[2] + "/pm2-self-update-root", app.env.SELF_UPDATE_ROOT);
    ' "$2" "$LOGS"
    ;;
esac
`,
  curl: `
n=$(ls "$LOGS" | grep -c '^curl-' || true)
printf '%s\\n' "$@" > "$LOGS/curl-$n.args"
cat > "$LOGS/curl-$n.body"
exit "\${FAKE_CURL_EXIT:-0}"
`,
};

function deploy(sha: string, env: Record<string, string> = {}) {
  return spawnSync("bash", [path.join(app, "update.sh")], {
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      LOGS: logs,
      FAKE_SHA: sha,
      ...env,
    },
    encoding: "utf8",
  });
}

function live(file: string) {
  return readFileSync(path.join(app, ".releases/current", file), "utf8");
}

function pm2Calls() {
  const file = path.join(logs, "pm2.log");
  return existsSync(file)
    ? readFileSync(file, "utf8")
        .trim()
        .split("\n")
        .filter((l) => l !== "jlist")
    : [];
}

function sentryEnvelopes() {
  return readdirSync(logs)
    .filter((f) => /^curl-\d+\.body$/.test(f))
    .map((f) => {
      const [header, ...rest] = readFileSync(path.join(logs, f), "utf8")
        .split("\n")
        .map((line) => JSON.parse(line));
      const items = [];
      for (let i = 0; i < rest.length; i += 2) {
        items.push({ header: rest[i], payload: rest[i + 1] });
      }
      return { header, items };
    });
}

function onlyEnvelope() {
  const envelopes = sentryEnvelopes();
  expect(envelopes).toHaveLength(1);
  const [{ header, items }] = envelopes;
  return {
    header,
    types: items.map((i) => i.header.type),
    event: items.find((i) => i.header.type === "event")?.payload,
    metricItem: items.find((i) => i.header.type === "trace_metric"),
  };
}

type Metric = {
  name: string;
  type: string;
  unit?: string;
  value: number;
  trace_id: string;
  attributes: Record<string, { value: unknown; type: string }>;
};

function describeMetrics(
  items: Metric[],
): Record<string, string | undefined>[] {
  return items.map((m) => ({
    name: m.name,
    type: m.type,
    unit: m.unit,
    ...Object.fromEntries(
      Object.entries(m.attributes).map(([k, a]) => [k, `${a.type}:${a.value}`]),
    ),
  }));
}

function curlArgs() {
  return readFileSync(path.join(logs, "curl-0.args"), "utf8").split("\n");
}

beforeEach(() => {
  tmp = realpathSync(mkdtempSync(path.join(tmpdir(), "update-")));
  app = path.join(tmp, "app");
  bin = path.join(tmp, "bin");
  logs = path.join(tmp, "logs");
  mkdirSync(app);
  mkdirSync(bin);
  mkdirSync(logs);
  copyFileSync(path.join(ROOT, "update.sh"), path.join(app, "update.sh"));
  writeFileSync(path.join(app, "package.json"), '{ "version": "2.3.4" }');
  copyFileSync(
    path.join(ROOT, "ecosystem.config.js"),
    path.join(app, "ecosystem.config.js"),
  );
  for (const [name, body] of Object.entries(fakes)) {
    writeFileSync(path.join(bin, name), `#!/usr/bin/env bash\n${body}`);
    chmodSync(path.join(bin, name), 0o755);
  }
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("update.sh", () => {
  it("starts pm2 from the assembled release on a fresh clone", () => {
    const run = deploy("aaa1111");

    expect(run.status).toBe(0);
    expect(live("server/index.mjs")).toBe("server aaa1111\n");
    expect(live("public/assets/chunk.js")).toBe("chunk aaa1111\n");
    expect(readFileSync(path.join(logs, "pm2-path"), "utf8")).toBe(
      path.join(app, ".releases/current/server/index.mjs"),
    );
    expect(readFileSync(path.join(logs, "pm2-self-update-root"), "utf8")).toBe(
      app,
    );
    expect(pm2Calls()).toEqual([
      "delete inflation-station",
      "start ecosystem.config.js",
      "save",
    ]);
  });

  it("swaps the release and restarts pm2, keeping only the previous release", () => {
    deploy("aaa1111");
    deploy("bbb2222");
    rmSync(path.join(logs, "pm2.log"));

    const run = deploy("ccc3333");

    expect(run.status).toBe(0);
    expect(live("server/index.mjs")).toBe("server ccc3333\n");
    expect(live("public/assets/chunk.js")).toBe("chunk ccc3333\n");
    expect(pm2Calls()).toEqual(["restart inflation-station"]);
    expect(
      readdirSync(path.join(app, ".releases"))
        .map((d) => d.replace(/^\d+-/, ""))
        .sort(),
    ).toEqual(["bbb2222", "ccc3333", "current"]);
  });

  it("leaves the live release and pm2 alone when the build fails", () => {
    deploy("aaa1111");
    rmSync(path.join(logs, "pm2.log"));

    const run = deploy("bbb2222", {
      FAKE_FAIL: "build",
      FAKE_FAIL_CODE: "137",
    });

    expect(run.status).toBe(137);
    expect(run.stderr).toContain("==> Deploy failed at build (exit 137)");
    expect(live("server/index.mjs")).toBe("server aaa1111\n");
    expect(live("public/assets/chunk.js")).toBe("chunk aaa1111\n");
    expect(pm2Calls()).toEqual([]);
  });

  it("moves a process from the Next release layout to the Nitro server", () => {
    writeFileSync(
      path.join(logs, "pm2-path"),
      path.join(app, ".releases/current/server.js"),
    );

    const run = deploy("aaa1111");

    expect(run.status).toBe(0);
    expect(readFileSync(path.join(logs, "pm2-path"), "utf8")).toBe(
      path.join(app, ".releases/current/server/index.mjs"),
    );
    expect(pm2Calls()).toEqual([
      "delete inflation-station",
      "start ecosystem.config.js",
      "save",
    ]);
  });

  it("reports a failed step to Sentry once, with the output tail", () => {
    writeFileSync(
      path.join(app, ".env"),
      [
        "VITE_SENTRY_DSN=https://pubkey@o1.ingest.sentry.io/42",
        "SENTRY_ENVIRONMENT=coolify",
        "VITE_SENTRY_ENVIRONMENT=home",
        "PM2_APP_NAME=inflation-station-other",
      ].join("\n"),
    );

    const run = deploy("bbb2222", {
      FAKE_FAIL: "build",
      FAKE_FAIL_CODE: "137",
    });

    expect(run.status).toBe(137);
    const { header, types, event } = onlyEnvelope();
    expect(types).toEqual(["event", "trace_metric"]);
    expect(header.event_id).toBe(event.event_id);
    expect(event).toMatchObject({
      level: "error",
      environment: "coolify",
      release: "inflation-station@2.3.4+bbb2222",
      message: { formatted: "Deploy failed at build (exit 137)" },
      fingerprint: ["deploy-failed", "build"],
      tags: {
        deploy_step: "build",
        exit_code: "137",
        pm2_app: "inflation-station-other",
      },
      extra: { output_tail: "boom build" },
    });
    expect(curlArgs()).toContain(
      "https://o1.ingest.sentry.io/api/42/envelope/",
    );
    expect(curlArgs()).toContain(
      "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=pubkey, sentry_client=update.sh/1",
    );
  });

  it("reports a failed migration without its output", () => {
    writeFileSync(
      path.join(app, ".env"),
      "VITE_SENTRY_DSN=https://pubkey@o1.ingest.sentry.io/42\n",
    );

    const run = deploy("bbb2222", { FAKE_FAIL: "db:migrate:deploy" });

    expect(run.status).toBe(1);
    const { event } = onlyEnvelope();
    expect(event.message.formatted).toBe("Deploy failed at migrate (exit 1)");
    expect(event.environment).toBe("production");
    expect(event.extra).toEqual({});
  });

  it("sends nothing when no DSN is configured", () => {
    writeFileSync(path.join(app, ".env"), "VITE_SENTRY_DSN=\n");

    const run = deploy("bbb2222", {
      FAKE_FAIL: "install",
      FAKE_FAIL_CODE: "2",
    });

    expect(run.status).toBe(2);
    expect(run.stderr).toContain("==> Deploy failed at install (exit 2)");
    expect(sentryEnvelopes()).toEqual([]);
  });

  it("keeps the failing exit code when Sentry is unreachable", () => {
    writeFileSync(
      path.join(app, ".env"),
      "VITE_SENTRY_DSN=https://pubkey@o1.ingest.sentry.io/42\n",
    );

    const run = deploy("bbb2222", {
      FAKE_FAIL: "build",
      FAKE_FAIL_CODE: "137",
      FAKE_CURL_EXIT: "7",
    });

    expect(run.status).toBe(137);
    expect(sentryEnvelopes()).toHaveLength(1);
  });

  it("sends deploy timings to Sentry after a successful deploy", () => {
    writeFileSync(
      path.join(app, ".env"),
      [
        "VITE_SENTRY_DSN=https://pubkey@o1.ingest.sentry.io/42",
        "VITE_SENTRY_ENVIRONMENT=home",
        "PM2_APP_NAME=inflation-station-other",
      ].join("\n"),
    );

    const run = deploy("aaa1111");

    expect(run.status).toBe(0);
    const { header, types, metricItem } = onlyEnvelope();
    expect(header).toEqual({});
    expect(types).toEqual(["trace_metric"]);
    expect(metricItem?.header).toEqual({
      type: "trace_metric",
      item_count: 7,
      content_type: "application/vnd.sentry.items.trace-metric+json",
    });
    expect(metricItem?.payload.version).toBe(2);
    const metrics: Metric[] = metricItem?.payload.items;
    const common = {
      "sentry.release": "string:inflation-station@2.3.4+aaa1111",
      "sentry.environment": "string:home",
      pm2_app: "string:inflation-station-other",
    };
    const step = (name: string) => ({
      name: "deploy.step.duration",
      type: "distribution",
      unit: "millisecond",
      ...common,
      deploy_step: `string:${name}`,
      outcome: "string:success",
    });
    expect(describeMetrics(metrics)).toEqual([
      step("install"),
      step("migrate"),
      step("build"),
      step("assemble"),
      step("restart"),
      {
        name: "deploy.duration",
        type: "distribution",
        unit: "millisecond",
        ...common,
        outcome: "string:success",
      },
      {
        name: "deploy.completed",
        type: "counter",
        unit: undefined,
        ...common,
        outcome: "string:success",
      },
    ]);
    expect(metrics[6].value).toBe(1);
    for (const m of metrics.slice(0, 6)) {
      expect(Number.isInteger(m.value) && m.value >= 0).toBe(true);
    }
    const stepTotal = metrics.slice(0, 5).reduce((sum, m) => sum + m.value, 0);
    expect(metrics[5].value).toBeGreaterThanOrEqual(stepTotal);
  });

  it("links a failed deploy's event to its step timings", () => {
    writeFileSync(
      path.join(app, ".env"),
      "VITE_SENTRY_DSN=https://pubkey@o1.ingest.sentry.io/42\n",
    );

    const run = deploy("bbb2222", {
      FAKE_FAIL: "build",
      FAKE_FAIL_CODE: "137",
    });

    expect(run.status).toBe(137);
    const { event, metricItem } = onlyEnvelope();
    const metrics: Metric[] = metricItem?.payload.items;
    expect(
      describeMetrics(metrics).map((m) => [m.name, m.deploy_step, m.outcome]),
    ).toEqual([
      ["deploy.step.duration", "string:install", "string:success"],
      ["deploy.step.duration", "string:migrate", "string:success"],
      ["deploy.step.duration", "string:build", "string:failure"],
      ["deploy.duration", "string:build", "string:failure"],
      ["deploy.completed", undefined, "string:failure"],
    ]);
    const traceId = event.contexts.trace.trace_id;
    expect(traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(event.contexts.trace.span_id).toMatch(/^[0-9a-f]{16}$/);
    expect(new Set(metrics.map((m) => m.trace_id))).toEqual(new Set([traceId]));
  });

  it("marks each step and the end in the progress file", () => {
    const steps = path.join(logs, "steps");

    const run = deploy("aaa1111", { DEPLOY_STEPS_FILE: steps });

    expect(run.status).toBe(0);
    const marks = readFileSync(steps, "utf8")
      .trim()
      .split("\n")
      .map((line) => line.split(" "));
    expect(marks.map(([step]) => step)).toEqual([
      "install",
      "migrate",
      "build",
      "assemble",
      "restart",
      "end",
    ]);
    const times = marks.map(([, at]) => Number(at));
    expect(times.every(Number.isInteger)).toBe(true);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("deploys even when the progress file cannot be written", () => {
    const run = deploy("aaa1111", {
      DEPLOY_STEPS_FILE: path.join(logs, "missing-dir/steps"),
    });

    expect(run.status).toBe(0);
    expect(live("server/index.mjs")).toBe("server aaa1111\n");
  });

  it("sends nothing after a successful deploy when no DSN is configured", () => {
    const run = deploy("aaa1111");

    expect(run.status).toBe(0);
    expect(live("server/index.mjs")).toBe("server aaa1111\n");
    expect(sentryEnvelopes()).toEqual([]);
  });
});
