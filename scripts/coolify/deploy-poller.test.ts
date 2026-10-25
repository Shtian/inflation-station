import { execFile } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

const SCRIPT = path.join(__dirname, "deploy-poller.sh");
const DIGEST_A = `sha256:${"a".repeat(64)}`;
const DIGEST_B = `sha256:${"b".repeat(64)}`;

type DeployCall = { method?: string; url: string; authorization?: string };

let tmp: string;
let server: Server;
let baseUrl: string;
let latestDigest: string | null;
let coolifyStatus: number;
let deploys: DeployCall[];

beforeEach(async () => {
  tmp = mkdtempSync(path.join(tmpdir(), "deploy-poller-"));
  latestDigest = DIGEST_A;
  coolifyStatus = 200;
  deploys = [];
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (
      url.pathname === "/token" &&
      url.searchParams.get("scope") ===
        "repository:shtian/inflation-station:pull"
    ) {
      res.end(JSON.stringify({ token: "anon-token" }));
    } else if (
      req.method === "HEAD" &&
      url.pathname === "/v2/shtian/inflation-station/manifests/latest" &&
      req.headers.authorization === "Bearer anon-token" &&
      req.headers.accept?.includes("application/vnd.oci.image.index.v1+json")
    ) {
      if (latestDigest === null) {
        res.statusCode = 500;
      } else {
        res.setHeader("Docker-Content-Digest", latestDigest);
      }
      res.end();
    } else if (url.pathname === "/api/v1/deploy") {
      deploys.push({
        method: req.method,
        url: `${url.pathname}${url.search}`,
        authorization: req.headers.authorization,
      });
      res.statusCode = coolifyStatus;
      res.end(
        coolifyStatus === 200
          ? '{"deployments":[]}'
          : '{"message":"Unauthenticated."}',
      );
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  rmSync(tmp, { recursive: true, force: true });
});

function poll(env: Record<string, string> = {}) {
  return new Promise<{ code: number; stdout: string; stderr: string }>(
    (resolve) => {
      execFile(
        "bash",
        [SCRIPT],
        {
          env: {
            ...process.env,
            REGISTRY_URL: baseUrl,
            COOLIFY_URL: baseUrl,
            COOLIFY_TOKEN: "coolify-secret",
            COOLIFY_APP_UUIDS: "app1,app2",
            STATE_DIRECTORY: tmp,
            ...env,
          },
        },
        (error, stdout, stderr) =>
          resolve({ code: error ? Number(error.code) : 0, stdout, stderr }),
      );
    },
  );
}

const stateFile = () => path.join(tmp, "latest-digest");
const savedDigest = () => readFileSync(stateFile(), "utf8");

describe("deploy-poller.sh", () => {
  it("records the current digest on the first run without deploying", async () => {
    const run = await poll();

    expect(run.code).toBe(0);
    expect(savedDigest()).toBe(`${DIGEST_A}\n`);
    expect(deploys).toEqual([]);
  });

  it("does nothing when :latest has not moved", async () => {
    writeFileSync(stateFile(), `${DIGEST_A}\n`);

    const run = await poll();

    expect(run.code).toBe(0);
    expect(run.stdout).toBe("");
    expect(savedDigest()).toBe(`${DIGEST_A}\n`);
    expect(deploys).toEqual([]);
  });

  it("deploys every app once when :latest moves", async () => {
    writeFileSync(stateFile(), `${DIGEST_A}\n`);
    latestDigest = DIGEST_B;

    const run = await poll();

    expect(run.code).toBe(0);
    expect(deploys).toEqual([
      {
        method: "POST",
        url: "/api/v1/deploy?uuid=app1,app2",
        authorization: "Bearer coolify-secret",
      },
    ]);
    expect(savedDigest()).toBe(`${DIGEST_B}\n`);

    await poll();
    expect(deploys).toHaveLength(1);
  });

  it("keeps the old digest when Coolify refuses, so the next run retries", async () => {
    writeFileSync(stateFile(), `${DIGEST_A}\n`);
    latestDigest = DIGEST_B;
    coolifyStatus = 401;

    const failed = await poll();

    expect(failed.code).toBe(1);
    expect(failed.stderr).toContain(
      'Coolify refused the deploy (HTTP 401): {"message":"Unauthenticated."}',
    );
    expect(savedDigest()).toBe(`${DIGEST_A}\n`);

    coolifyStatus = 200;
    const retried = await poll();

    expect(retried.code).toBe(0);
    expect(deploys).toHaveLength(2);
    expect(savedDigest()).toBe(`${DIGEST_B}\n`);
  });

  it("keeps the old digest when Coolify is unreachable", async () => {
    writeFileSync(stateFile(), `${DIGEST_A}\n`);
    latestDigest = DIGEST_B;

    const run = await poll({ COOLIFY_URL: "http://127.0.0.1:1" });

    expect(run.code).toBe(1);
    expect(run.stderr).toContain("Could not reach Coolify");
    expect(savedDigest()).toBe(`${DIGEST_A}\n`);
  });

  it("fails without touching state when the registry fails", async () => {
    latestDigest = null;

    const run = await poll();

    expect(run.code).toBe(1);
    expect(run.stderr).toContain(
      "Could not read the digest of shtian/inflation-station:latest",
    );
    expect(existsSync(stateFile())).toBe(false);
    expect(deploys).toEqual([]);
  });

  it("fails before polling when the Coolify token is missing", async () => {
    const run = await poll({ COOLIFY_TOKEN: "" });

    expect(run.code).toBe(1);
    expect(run.stderr).toContain("COOLIFY_TOKEN is not set");
    expect(existsSync(stateFile())).toBe(false);
  });
});
