import type { CreatedIssue } from "./contract";

export type DraftView<TApproval> =
  | { kind: "writing" }
  | { kind: "awaiting"; approval: TApproval }
  | { kind: "creating" }
  | { kind: "declined" }
  | { kind: "superseded" }
  | { kind: "created"; issue: CreatedIssue }
  | { kind: "failed"; error: string };

type DraftCall = {
  approval?: { approved?: boolean };
  output?: CreatedIssue;
};

type DraftResult = { state: string; outcome?: string; error?: string };

export function draftView<TApproval>({
  call,
  result,
  pending,
  streaming,
}: {
  call: DraftCall;
  result: DraftResult | undefined;
  pending: TApproval | undefined;
  streaming: boolean;
}): DraftView<TApproval> {
  if (pending) {
    return { kind: "awaiting", approval: pending };
  }
  if (result?.outcome || call.approval?.approved === false) {
    return { kind: "declined" };
  }
  if (result?.state === "error") {
    return {
      kind: "failed",
      error: result.error ?? "Saken ble ikke opprettet.",
    };
  }
  if (call.output) {
    return { kind: "created", issue: call.output };
  }
  if (call.approval?.approved) {
    return { kind: "creating" };
  }
  return streaming ? { kind: "writing" } : { kind: "superseded" };
}
