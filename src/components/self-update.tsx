"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import type { UpdateAvailability } from "@/lib/self-update/availability";
import {
  initialSelfUpdateDialogState,
  isPolling,
  type SelfUpdateDialogEvent,
  type SelfUpdateDialogState,
  selfUpdateDialogReducer,
} from "@/lib/self-update/dialog-state";
import type { SelfUpdateProgress } from "@/lib/self-update/progress";
import type { MutationActionResult } from "@/lib/server-actions/mutation-result";

export type StartSelfUpdate = () => Promise<
  MutationActionResult<{ sha: string }>
>;

const POLL_INTERVAL_MS = 2000;
const RELOAD_DELAY_MS = 1500;
const AVAILABILITY_INTERVAL_MS = 15 * 60 * 1000;
const NOTIFIED_STORAGE_KEY = "inflation-station:update-notified";

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

async function fetchAvailability(): Promise<UpdateAvailability> {
  try {
    const response = await fetch("/api/self-update/availability", {
      cache: "no-store",
    });
    return response.ok ? await response.json() : { kind: "unknown" };
  } catch {
    return { kind: "unknown" };
  }
}

// Returns true the first time this browser sees remoteSha, so each new version
// toasts once rather than on every page load.
function claimNotification(remoteSha: string) {
  try {
    if (localStorage.getItem(NOTIFIED_STORAGE_KEY) === remoteSha) {
      return false;
    }
    localStorage.setItem(NOTIFIED_STORAGE_KEY, remoteSha);
  } catch {}
  return true;
}

function describe(
  state: SelfUpdateDialogState,
  availability: UpdateAvailability,
) {
  switch (state.kind) {
    case "idle":
      if (availability.kind === "available") {
        return `Versjon ${availability.remoteSha} er tilgjengelig. Når den hentes, bygges siden på nytt og er utilgjengelig i noen minutter.`;
      }
      return "Hent de siste endringene og bygg på nytt. Hvis det finnes noe nytt, er siden utilgjengelig i noen minutter mens den bygges.";
    case "starting":
      return "Starter oppdateringen.";
    case "running":
      return "Oppdaterer. Siden lastes inn på nytt når den nye versjonen er oppe.";
    case "offline":
      return "Bygger på nytt. Siden er utilgjengelig til den starter igjen.";
    case "done":
      return `Oppdatert til ${state.sha}. Laster inn på nytt.`;
    case "up-to-date":
      return "Allerede oppdatert.";
    case "failed":
      return state.message;
  }
}

function UpdateProgress({ progress }: { progress: SelfUpdateProgress }) {
  const label =
    progress.index === 0
      ? progress.label
      : `Steg ${progress.index} av ${progress.total}: ${progress.label}`;
  return (
    <Progress value={progress.percent}>
      <ProgressLabel>{label}</ProgressLabel>
      <ProgressValue />
    </Progress>
  );
}

function UpdateLog({ log }: { log: string }) {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  });

  return (
    <pre
      ref={ref}
      className="max-h-72 overflow-auto rounded-md bg-muted p-2 font-mono text-xs break-all whitespace-pre-wrap text-muted-foreground"
    >
      {log || "Venter på utdata..."}
    </pre>
  );
}

export function useSelfUpdate(enabled: boolean) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [availability, setAvailability] = useState<UpdateAvailability>({
    kind: "unknown",
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    async function check() {
      const next = await fetchAvailability();
      if (!cancelled) {
        setAvailability(next);
      }
    }
    check();
    const interval = setInterval(check, AVAILABILITY_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled]);

  const availableSha =
    availability.kind === "available" ? availability.remoteSha : null;

  useEffect(() => {
    if (availableSha === null || !claimNotification(availableSha)) {
      return;
    }
    toast(`Ny versjon ${availableSha} er tilgjengelig`, {
      action: { label: "Oppdater", onClick: () => setDialogOpen(true) },
    });
  }, [availableSha]);

  return { availability, availableSha, dialogOpen, setDialogOpen };
}

export function SelfUpdateDialog({
  open,
  onOpenChange,
  pageSha,
  availability,
  startSelfUpdate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageSha: string;
  availability: UpdateAvailability;
  startSelfUpdate: StartSelfUpdate;
}) {
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
    toast.success(`Oppdatert til ${state.sha}`);
    const timeout = setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [state]);

  async function start() {
    dispatch({ type: "start" });
    try {
      const result = await startSelfUpdate();
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
        message: "Kunne ikke starte oppdateringen.",
      });
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      dispatch({ type: "reset" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Oppdater Inflation Station</DialogTitle>
          <DialogDescription>{describe(state, availability)}</DialogDescription>
        </DialogHeader>
        {polling && state.progress ? (
          <UpdateProgress progress={state.progress} />
        ) : null}
        {"log" in state && (polling || state.log !== "") ? (
          <details open={!polling} className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              Vis logg
            </summary>
            <div className="mt-2">
              <UpdateLog log={state.log} />
            </div>
          </details>
        ) : null}
        <DialogFooter showCloseButton>
          {state.kind === "idle" || state.kind === "starting" ? (
            <Button onClick={start} disabled={state.kind === "starting"}>
              {state.kind === "starting" ? "Starter..." : "Oppdater nå"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
