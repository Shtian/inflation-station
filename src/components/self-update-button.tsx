"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { startSelfUpdateAction } from "@/app/actions/start-self-update";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  initialSelfUpdateDialogState,
  isPolling,
  type SelfUpdateDialogEvent,
  type SelfUpdateDialogState,
  selfUpdateDialogReducer,
} from "@/lib/self-update/dialog-state";

const POLL_INTERVAL_MS = 2000;
const RELOAD_DELAY_MS = 1500;

async function fetchStatusEvent(
  pageSha: string,
): Promise<SelfUpdateDialogEvent> {
  try {
    const response = await fetch("/api/self-update/status", {
      cache: "no-store",
    });
    if (!response.ok) {
      return { type: "unreachable" };
    }
    return { type: "status", status: await response.json(), pageSha };
  } catch {
    return { type: "unreachable" };
  }
}

function describe(state: SelfUpdateDialogState) {
  switch (state.kind) {
    case "idle":
      return "Pull the latest changes and rebuild. If there is anything new, the site is offline for a few minutes while it rebuilds.";
    case "starting":
      return "Starting the update.";
    case "running":
      return "Updating. This page reloads when the new version is up.";
    case "offline":
      return "Rebuilding. The site is offline until it restarts.";
    case "done":
      return `Updated to ${state.sha}. Reloading.`;
    case "up-to-date":
      return "Already up to date.";
    case "failed":
      return state.message;
  }
}

function UpdateLog({ log }: { log: string }) {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  });

  return (
    <pre
      ref={ref}
      className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 font-mono text-muted-foreground text-xs"
    >
      {log || "Waiting for output..."}
    </pre>
  );
}

export function SelfUpdateButton({ pageSha }: { pageSha: string }) {
  const [open, setOpen] = useState(false);
  const [state, dispatch] = useReducer(
    selfUpdateDialogReducer,
    initialSelfUpdateDialogState,
  );
  const polling = isPolling(state);
  // A tab opened before an update over SSH renders a stale sha, so a run
  // started here compares against the sha the server reports at start.
  const baselineSha = useRef(pageSha);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    fetchStatusEvent(pageSha).then((event) => {
      if (!cancelled) {
        dispatch(event);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, pageSha]);

  useEffect(() => {
    if (!polling) {
      return;
    }
    const interval = setInterval(async () => {
      dispatch(await fetchStatusEvent(baselineSha.current));
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [polling]);

  useEffect(() => {
    if (state.kind !== "done") {
      return;
    }
    toast.success(`Updated to ${state.sha}`);
    const timeout = setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [state]);

  async function start() {
    dispatch({ type: "start" });
    try {
      const result = await startSelfUpdateAction();
      if (result.ok) {
        baselineSha.current = result.data.sha;
      }
      dispatch(
        result.ok
          ? { type: "started" }
          : { type: "start-failed", message: result.error.message },
      );
    } catch {
      dispatch({
        type: "start-failed",
        message: "Could not start the update.",
      });
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      dispatch({ type: "reset" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="font-mono text-muted-foreground"
          />
        }
      >
        Update
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Update Inflation Station</DialogTitle>
          <DialogDescription>{describe(state)}</DialogDescription>
        </DialogHeader>
        {"log" in state && (polling || state.log !== "") ? (
          <UpdateLog log={state.log} />
        ) : null}
        <DialogFooter showCloseButton>
          {state.kind === "idle" || state.kind === "starting" ? (
            <Button onClick={start} disabled={state.kind === "starting"}>
              {state.kind === "starting" ? "Starting..." : "Start update"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
