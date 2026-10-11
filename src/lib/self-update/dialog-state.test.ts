import { describe, expect, it } from "vitest";
import {
  type SelfUpdateDialogEvent,
  type SelfUpdateDialogState,
  selfUpdateDialogReducer,
} from "./dialog-state";

const PAGE_SHA = "aaa1111";

function run(events: SelfUpdateDialogEvent[]): SelfUpdateDialogState {
  return events.reduce(selfUpdateDialogReducer, { kind: "idle" });
}

const started: SelfUpdateDialogEvent[] = [
  { type: "start" },
  { type: "started" },
];

describe("selfUpdateDialogReducer", () => {
  it("streams the log while the run is in progress", () => {
    expect(
      run([
        ...started,
        {
          type: "status",
          pageSha: PAGE_SHA,
          status: { sha: PAGE_SHA, log: "==> Building...", phase: "running" },
        },
      ]),
    ).toEqual({ kind: "running", log: "==> Building..." });
  });

  it("goes offline when the server stops answering and keeps the last log", () => {
    expect(
      run([
        ...started,
        {
          type: "status",
          pageSha: PAGE_SHA,
          status: { sha: PAGE_SHA, log: "==> Building...", phase: "running" },
        },
        { type: "unreachable" },
      ]),
    ).toEqual({ kind: "offline", log: "==> Building..." });
  });

  it("is done once a server with a different sha answers", () => {
    expect(
      run([
        ...started,
        { type: "unreachable" },
        {
          type: "status",
          pageSha: PAGE_SHA,
          status: {
            sha: "bbb2222",
            log: "==> Done!",
            phase: "finished",
            exitCode: 0,
          },
        },
      ]),
    ).toEqual({ kind: "done", sha: "bbb2222" });
  });

  it("reports up to date when the run finishes cleanly on the same sha", () => {
    expect(
      run([
        ...started,
        {
          type: "status",
          pageSha: PAGE_SHA,
          status: {
            sha: PAGE_SHA,
            log: "==> Already up to date",
            phase: "finished",
            exitCode: 0,
          },
        },
      ]),
    ).toEqual({ kind: "up-to-date", log: "==> Already up to date" });
  });

  it("fails with the log when the run exits non-zero", () => {
    expect(
      run([
        ...started,
        {
          type: "status",
          pageSha: PAGE_SHA,
          status: {
            sha: PAGE_SHA,
            log: "ERR_PNPM_OUTDATED_LOCKFILE",
            phase: "finished",
            exitCode: 1,
          },
        },
      ]),
    ).toEqual({
      kind: "failed",
      message: "The update failed with exit code 1.",
      log: "ERR_PNPM_OUTDATED_LOCKFILE",
    });
  });

  it("fails with the action's message when the start is rejected", () => {
    expect(
      run([
        { type: "start" },
        { type: "start-failed", message: "An update is already running." },
      ]),
    ).toEqual({
      kind: "failed",
      message: "An update is already running.",
      log: "",
    });
  });

  it("attaches to a run that is already in progress when opened", () => {
    expect(
      run([
        {
          type: "status",
          pageSha: PAGE_SHA,
          status: { sha: PAGE_SHA, log: "==> Migrating...", phase: "running" },
        },
      ]),
    ).toEqual({ kind: "running", log: "==> Migrating..." });
  });

  it("stays idle when opened after an earlier run finished", () => {
    expect(
      run([
        {
          type: "status",
          pageSha: PAGE_SHA,
          status: { sha: PAGE_SHA, log: "old", phase: "finished", exitCode: 1 },
        },
      ]),
    ).toEqual({ kind: "idle" });
  });

  it("returns to idle when a finished dialog is reset", () => {
    expect(
      run([...started, { type: "unreachable" }, { type: "reset" }]),
    ).toEqual({ kind: "idle" });
  });
});
