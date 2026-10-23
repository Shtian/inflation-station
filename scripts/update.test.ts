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

function sentryEvents() {
  return readdirSync(logs)
    .filter((f) => /^curl-\d+\.body$/.test(f))
    .map((f) => {
      const [header, item, event] = readFileSync(path.join(logs, f), "utf8")
        .split("\n")
        .map((line) => JSON.parse(line));
      return { header, item, event };
    });
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
        "NEXT_PUBLIC_SENTRY_DSN=https://pubkey@o1.ingest.sentry.io/42",
        "NEXT_PUBLIC_SENTRY_ENVIRONMENT=home",
        "PM2_APP_NAME=inflation-station-other",
      ].join("\n"),
    );

    const run = deploy("bbb2222", {
      FAKE_FAIL: "build",
      FAKE_FAIL_CODE: "137",
    });

    expect(run.status).toBe(137);
    const events = sentryEvents();
    expect(events).toHaveLength(1);
    const [{ header, item, event }] = events;
    expect(item).toEqual({ type: "event" });
    expect(header.event_id).toBe(event.event_id);
    expect(event).toMatchObject({
      level: "error",
      environment: "home",
      release: "bbb2222",
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
      "NEXT_PUBLIC_SENTRY_DSN=https://pubkey@o1.ingest.sentry.io/42\n",
    );

    const run = deploy("bbb2222", { FAKE_FAIL: "db:migrate:deploy" });

    expect(run.status).toBe(1);
    const [{ event }] = sentryEvents();
    expect(event.message.formatted).toBe("Deploy failed at migrate (exit 1)");
    expect(event.environment).toBe("production");
    expect(event.extra).toEqual({});
  });

  it("sends nothing when no DSN is configured", () => {
    writeFileSync(path.join(app, ".env"), "NEXT_PUBLIC_SENTRY_DSN=\n");

    const run = deploy("bbb2222", {
      FAKE_FAIL: "install",
      FAKE_FAIL_CODE: "2",
    });

    expect(run.status).toBe(2);
    expect(run.stderr).toContain("==> Deploy failed at install (exit 2)");
    expect(sentryEvents()).toEqual([]);
  });

  it("keeps the failing exit code when Sentry is unreachable", () => {
    writeFileSync(
      path.join(app, ".env"),
      "NEXT_PUBLIC_SENTRY_DSN=https://pubkey@o1.ingest.sentry.io/42\n",
    );

    const run = deploy("bbb2222", {
      FAKE_FAIL: "build",
      FAKE_FAIL_CODE: "137",
      FAKE_CURL_EXIT: "7",
    });

    expect(run.status).toBe(137);
    expect(sentryEvents()).toHaveLength(1);
  });
});
