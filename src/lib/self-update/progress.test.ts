import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import {
  DEPLOY_STEPS,
  estimateProgress,
  parseStepMarks,
  stepDurations,
} from "./progress";

// install 30s, migrate 4s, build 90s, assemble 1s, restart 4s; no backup.
const PREVIOUS = stepDurations(
  parseStepMarks(
    [
      "install 1000",
      "migrate 31000",
      "build 35000",
      "assemble 125000",
      "restart 126000",
      "end 130000",
    ].join("\n"),
  ),
);

describe("parseStepMarks", () => {
  it("keeps well-formed lines and drops the rest", () => {
    expect(
      parseStepMarks("install 1000\n\ngarbage\nbuild notanumber\nend 2000\n"),
    ).toEqual([
      { step: "install", at: 1000 },
      { step: "end", at: 2000 },
    ]);
  });
});

describe("stepDurations", () => {
  it("measures each step to the next mark and ignores unknown steps", () => {
    expect(
      stepDurations(
        parseStepMarks("install 0\nwarmup 500\nmigrate 1000\nbuild 3000"),
      ),
    ).toEqual({ install: 500, migrate: 2000 });
  });
});

describe("estimateProgress", () => {
  it("reports the pull before any step has started", () => {
    expect(estimateProgress([], PREVIOUS, 5000)).toEqual({
      label: "Henter endringer",
      index: 0,
      total: 6,
      percent: 0,
    });
  });

  it("weights steps by the previous run and counts a skipped backup as done", () => {
    // Expected total: 30000 + 2000 (default backup) + 4000 + 90000 + 1000 + 4000 = 131000.
    // Done: 36000 before build, plus 45000 into it = 81000 → 61%.
    const marks = parseStepMarks("install 0\nmigrate 20000\nbuild 25000");

    expect(estimateProgress(marks, PREVIOUS, 70_000)).toEqual({
      label: "Bygger",
      index: 4,
      total: 6,
      percent: 61,
    });
  });

  it("holds a slow step at 95% of its expected time", () => {
    // 36000 + 0.95 × 90000 = 121500 of 131000 → 92%.
    const marks = parseStepMarks("install 0\nmigrate 20000\nbuild 25000");

    expect(estimateProgress(marks, PREVIOUS, 500_000).percent).toBe(92);
  });

  it("falls back to default durations without a previous run", () => {
    // Defaults total 133000; install 15000 in → 11%.
    expect(estimateProgress(parseStepMarks("install 0"), {}, 15_000)).toEqual({
      label: "Installerer avhengigheter",
      index: 1,
      total: 6,
      percent: 11,
    });
  });

  it("ignores unknown steps when picking the current one", () => {
    const marks = parseStepMarks("install 0\nwarmup 1000");

    expect(estimateProgress(marks, {}, 1000).label).toBe(
      "Installerer avhengigheter",
    );
  });

  it("is complete once the end mark is written", () => {
    const marks = parseStepMarks("install 0\nrestart 1000\nend 2000");

    expect(estimateProgress(marks, PREVIOUS, 2000)).toEqual({
      label: "Starter på nytt",
      index: 6,
      total: 6,
      percent: 100,
    });
  });
});

describe("DEPLOY_STEPS", () => {
  it("matches the run_step calls in update.sh, in order", () => {
    const script = readFileSync(
      path.join(__dirname, "../../../update.sh"),
      "utf8",
    );
    const steps = [...script.matchAll(/^\s*run_step (\w+)/gm)].map(
      (match) => match[1],
    );

    expect(DEPLOY_STEPS.map((step) => step.key)).toEqual(steps);
  });
});
