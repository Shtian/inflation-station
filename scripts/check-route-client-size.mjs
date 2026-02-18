import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const APP_ROOT = path.join(process.cwd(), "src", "app");
const ROUTE_ROOT_SUFFIX = "-route-root.tsx";
const MAX_ROUTE_CLIENT_LINES = Number.parseInt(
  process.env.MAX_ROUTE_CLIENT_LINES ?? "160",
  10,
);

async function collectRouteRootFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => collectRouteRootFiles(path.join(dir, entry.name))),
  );

  const routeRootFiles = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(ROUTE_ROOT_SUFFIX) &&
        !entry.name.endsWith(".test.tsx"),
    )
    .map((entry) => path.join(dir, entry.name));

  return routeRootFiles.concat(...nestedFiles);
}

function firstMeaningfulLine(content) {
  const lines = content.split(/\r?\n/u);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("//")) {
      continue;
    }

    return trimmed;
  }

  return "";
}

function isClientComponent(content) {
  const firstLine = firstMeaningfulLine(content);
  return firstLine === '"use client";' || firstLine === "'use client';";
}

async function run() {
  const routeRootFiles = await collectRouteRootFiles(APP_ROOT);
  const violations = [];

  for (const filePath of routeRootFiles) {
    const content = await readFile(filePath, "utf8");

    if (!isClientComponent(content)) {
      continue;
    }

    const lineCount = content.split(/\r?\n/u).length;
    if (lineCount > MAX_ROUTE_CLIENT_LINES) {
      violations.push({ filePath, lineCount });
    }
  }

  if (violations.length > 0) {
    console.error(
      `Route root client components must stay at or below ${MAX_ROUTE_CLIENT_LINES} lines.`,
    );
    for (const violation of violations) {
      console.error(
        `- ${path.relative(process.cwd(), violation.filePath)}: ${violation.lineCount} lines`,
      );
    }
    process.exit(1);
  }

  console.log(
    `Route root size check passed (${routeRootFiles.length} route roots scanned, max ${MAX_ROUTE_CLIENT_LINES} lines).`,
  );
}

await run();
