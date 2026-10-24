import { describe, expect, it } from "vite-plus/test";
import {
  type SelfUpdateDialogEvent,
  type SelfUpdateDialogState,
  selfUpdateDialogReducer,
} from "./dialog-state";

const PAGE_SHA = "aaa1111";

function run(events: SelfUpdateDialogEvent[]): SelfUpdateDialogState {
  return events.reduce(selfUpdateDialogReducer, { kind: "idle" });
}

const BUILDING = { label: "Bygger", index: 4, total: 6, percent: 61 };

const started: SelfUpdateDialogEvent[] = [
  { type: "start" },
  { type: "started" },
];

describe("selfUpdateDialogReducer", () => {
  it("has no progress until the first status arrives", () => {
    expect(run(started)).toEqual({ kind: "running", log: "", progress: null });
  });

  it("streams the log and progress while the run is in progress", () => {
    expect(
      run([
        ...started,
        {
          type: "status",
          pageSha: PAGE_SHA,
          status: {
            sha: PAGE_SHA,
            log: "==> Building...",
            progress: BUILDING,
            phase: "running",
          },
        },
      ]),
    ).toEqual({ kind: "running", log: "==> Building...", progress: BUILDING });
  });

  it("goes offline when the server stops answering and keeps the last log and progress", () => {
    expect(
      run([
        ...started,
        {
          type: "status",
          pageSha: PAGE_SHA,
          status: {
            sha: PAGE_SHA,
            log: "==> Building...",
            progress: BUILDING,
            phase: "running",
          },
        },
        { type: "unreachable" },
      ]),
    ).toEqual({ kind: "offline", log: "==> Building...", progress: BUILDING });
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
            progress: null,
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
            progress: null,
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
            progress: null,
            phase: "finished",
            exitCode: 1,
          },
        },
      ]),
    ).toEqual({
      kind: "failed",
      message: "Oppdateringen feilet med avslutningskode 1.",
      log: "ERR_PNPM_OUTDATED_LOCKFILE",
    });
  });

  it("fails with the action's message when the start is rejected", () => {
    expect(
      run([
        { type: "start" },
        { type: "start-failed", message: "En oppdatering kjører allerede." },
      ]),
    ).toEqual({
      kind: "failed",
      message: "En oppdatering kjører allerede.",
      log: "",
    });
  });

  it("attaches to a run that is already in progress when opened", () => {
    expect(
      run([
        {
          type: "status",
          pageSha: PAGE_SHA,
          status: {
            sha: PAGE_SHA,
            log: "==> Migrating...",
            progress: BUILDING,
            phase: "running",
          },
        },
      ]),
    ).toEqual({
      kind: "running",
      log: "==> Migrating...",
      progress: BUILDING,
    });
  });

  it("stays idle when opened after an earlier run finished", () => {
    expect(
      run([
        {
          type: "status",
          pageSha: PAGE_SHA,
          status: {
            sha: PAGE_SHA,
            log: "old",
            progress: null,
            phase: "finished",
            exitCode: 1,
          },
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
