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
import type { UpdateAvailability } from "@/lib/self-update/availability";
import {
  initialSelfUpdateDialogState,
  isPolling,
  type SelfUpdateDialogEvent,
  type SelfUpdateDialogState,
  selfUpdateDialogReducer,
} from "@/lib/self-update/dialog-state";

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
      {log || "Venter på utdata..."}
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
  const [availability, setAvailability] = useState<UpdateAvailability>({
    kind: "unknown",
  });

  useEffect(() => {
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
  }, []);

  const availableSha =
    availability.kind === "available" ? availability.remoteSha : null;

  useEffect(() => {
    if (availableSha === null || !claimNotification(availableSha)) {
      return;
    }
    toast(`Ny versjon ${availableSha} er tilgjengelig`, {
      action: { label: "Oppdater", onClick: () => setOpen(true) },
    });
  }, [availableSha]);

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
        message: "Kunne ikke starte oppdateringen.",
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
            className={
              availableSha === null
                ? "font-mono text-muted-foreground"
                : "font-mono text-brand"
            }
          />
        }
      >
        {availableSha === null ? null : (
          <span aria-hidden className="size-1.5 rounded-full bg-brand" />
        )}
        {availableSha === null ? "Oppdater" : "Oppdatering tilgjengelig"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Oppdater Inflation Station</DialogTitle>
          <DialogDescription>{describe(state, availability)}</DialogDescription>
        </DialogHeader>
        {"log" in state && (polling || state.log !== "") ? (
          <UpdateLog log={state.log} />
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
