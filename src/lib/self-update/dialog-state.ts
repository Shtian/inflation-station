import type { SelfUpdateStatus } from "./self-update";

export type SelfUpdateDialogState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "running"; log: string }
  | { kind: "offline"; log: string }
  | { kind: "done"; sha: string }
  | { kind: "up-to-date"; log: string }
  | { kind: "failed"; message: string; log: string };

export type SelfUpdateDialogEvent =
  | { type: "start" }
  | { type: "started" }
  | { type: "start-failed"; message: string }
  | { type: "status"; status: SelfUpdateStatus; pageSha: string }
  | { type: "unreachable" }
  | { type: "reset" };

export const initialSelfUpdateDialogState: SelfUpdateDialogState = {
  kind: "idle",
};

export function isPolling(
  state: SelfUpdateDialogState,
): state is Extract<SelfUpdateDialogState, { kind: "running" | "offline" }> {
  return state.kind === "running" || state.kind === "offline";
}

function fromStatus(
  status: SelfUpdateStatus,
  pageSha: string,
): SelfUpdateDialogState | null {
  if (status.sha !== pageSha) {
    return { kind: "done", sha: status.sha };
  }
  switch (status.phase) {
    case "running":
      return { kind: "running", log: status.log };
    case "finished":
      return status.exitCode === 0
        ? { kind: "up-to-date", log: status.log }
        : {
            kind: "failed",
            message: `The update failed with exit code ${status.exitCode}.`,
            log: status.log,
          };
    case "never-run":
      return null;
  }
}

export function selfUpdateDialogReducer(
  state: SelfUpdateDialogState,
  event: SelfUpdateDialogEvent,
): SelfUpdateDialogState {
  switch (event.type) {
    case "start":
      return state.kind === "idle" ? { kind: "starting" } : state;
    case "started":
      return state.kind === "starting" ? { kind: "running", log: "" } : state;
    case "start-failed":
      return state.kind === "starting"
        ? { kind: "failed", message: event.message, log: "" }
        : state;
    case "status": {
      if (state.kind === "idle") {
        return event.status.phase === "running"
          ? { kind: "running", log: event.status.log }
          : state;
      }
      if (!isPolling(state)) {
        return state;
      }
      return fromStatus(event.status, event.pageSha) ?? state;
    }
    case "unreachable":
      return isPolling(state) ? { kind: "offline", log: state.log } : state;
    case "reset":
      return state.kind === "starting" ? state : initialSelfUpdateDialogState;
  }
}
