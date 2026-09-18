"use client";

/**
 * PROTOTYPE — throwaway, not production code.
 *
 * Question: how should a review-table message cell transition from its
 * loading skeleton to the resolved (cleaned or original) text once a
 * cleanup chunk response lands?
 *
 * Three variants, switchable via `?variant=A|B|C` on the real `/import`
 * route (see the gate in `import-uploader.tsx`). Not wired to the backend;
 * a local timer fakes a chunk streaming in so the transition can be
 * replayed on demand. Delete this file plus its two-line hook in
 * `import-uploader.tsx` once a direction is picked — see the
 * `prototype/message-cell-loading` branch for the full variant set and the
 * decision once it's made.
 */

import { CheckCircle2, DownloadCloud, Loader2, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNok } from "@/lib/format-nok";
import { cn } from "@/lib/utils";

type CellState = "pending" | "resolved";

type DemoRow = {
  id: string;
  rowNumber: number;
  bookingDate: string;
  amountNok: number;
  paymentType: string;
  original: string;
  /** null => chunk resolved with no suggestion for this row. */
  cleaned: string | null;
  resolveAfterMs: number;
};

const DEMO_ROWS: DemoRow[] = [
  {
    id: "r1",
    rowNumber: 2,
    bookingDate: "2026-09-01",
    amountNok: -89.9,
    paymentType: "CARD",
    original: "REMA 1000 5062 OSLO NO",
    cleaned: "Rema 1000",
    resolveAfterMs: 700,
  },
  {
    id: "r2",
    rowNumber: 3,
    bookingDate: "2026-09-02",
    amountNok: -45,
    paymentType: "CARD",
    original: "RUTER BILLETT",
    cleaned: null,
    resolveAfterMs: 1000,
  },
  {
    id: "r3",
    rowNumber: 4,
    bookingDate: "2026-09-03",
    amountNok: -25,
    paymentType: "CARD",
    original: "VIPPS*KIWI MINIPRIS",
    cleaned: "Kiwi",
    resolveAfterMs: 1300,
  },
  {
    id: "r4",
    rowNumber: 5,
    bookingDate: "2026-09-04",
    amountNok: -599,
    paymentType: "CARD",
    original: "PAYPAL *SPOTIFY AB",
    cleaned: "Spotify",
    resolveAfterMs: 1600,
  },
  {
    id: "r5",
    rowNumber: 6,
    bookingDate: "2026-09-05",
    amountNok: -79,
    paymentType: "CARD",
    original: "BUNNPRIS BISLETT OSLO",
    cleaned: "Bunnpris",
    resolveAfterMs: 1900,
  },
  {
    id: "r6",
    rowNumber: 7,
    bookingDate: "2026-09-06",
    amountNok: -1200,
    paymentType: "CARD",
    original: "IKEA NORGE AS NETTBUTIKK",
    cleaned: "Ikea",
    resolveAfterMs: 2200,
  },
  {
    id: "r7",
    rowNumber: 8,
    bookingDate: "2026-09-07",
    amountNok: -49,
    paymentType: "CARD",
    original: "NARVESEN 445 OSLO S",
    cleaned: "Narvesen",
    resolveAfterMs: 2500,
  },
  {
    id: "r8",
    rowNumber: 9,
    bookingDate: "2026-09-08",
    amountNok: -899,
    paymentType: "CARD",
    original: "APPLE.COM/BILL",
    cleaned: null,
    resolveAfterMs: 2800,
  },
  {
    id: "r9",
    rowNumber: 10,
    bookingDate: "2026-09-09",
    amountNok: -215,
    paymentType: "CARD",
    original: "MENY GRUNERLOKKA OSLO",
    cleaned: "Meny",
    resolveAfterMs: 3100,
  },
  {
    id: "r10",
    rowNumber: 11,
    bookingDate: "2026-09-10",
    amountNok: -149,
    paymentType: "CARD",
    original: "EXTRA STORGATA TRONDHEIM",
    cleaned: "Extra",
    resolveAfterMs: 3400,
  },
  {
    id: "r11",
    rowNumber: 12,
    bookingDate: "2026-09-11",
    amountNok: -65,
    paymentType: "CARD",
    original: "VIPPS*JOKER MAJORSTUEN",
    cleaned: "Joker",
    resolveAfterMs: 3700,
  },
  {
    id: "r12",
    rowNumber: 13,
    bookingDate: "2026-09-12",
    amountNok: -32.5,
    paymentType: "CARD",
    original: "RUTER AS AUTOMAT",
    cleaned: "Ruter",
    resolveAfterMs: 4000,
  },
];

const LOOP_PAUSE_MS = 1600;

type CellProps = {
  state: CellState;
  original: string;
  cleaned: string | null;
};

/** A: two layers stacked in place, crossfading on opacity only. */
function VariantA({ state, original, cleaned }: CellProps) {
  const resolvedText = cleaned ?? original;
  return (
    <div className="flex h-5 items-center gap-2">
      <div className="relative h-4 w-40">
        <span
          className={cn(
            "absolute inset-0 flex items-center transition-opacity duration-300",
            state === "pending" ? "opacity-100" : "opacity-0",
          )}
        >
          <Skeleton className="h-4 w-28" />
        </span>
        <span
          className={cn(
            "absolute inset-0 flex items-center truncate text-sm transition-opacity duration-300",
            state === "resolved" ? "opacity-100" : "opacity-0",
          )}
        >
          {resolvedText}
        </span>
      </div>
      {state === "resolved" && cleaned ? (
        <Sparkles
          className="h-3.5 w-3.5 shrink-0 text-violet-500"
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

/** B: original text visible immediately, pulses while pending, flashes on change. */
function VariantB({ state, original, cleaned }: CellProps) {
  const [justResolved, setJustResolved] = useState(false);

  useEffect(() => {
    if (state !== "resolved") {
      return;
    }
    setJustResolved(true);
    const timeout = setTimeout(() => setJustResolved(false), 700);
    return () => clearTimeout(timeout);
  }, [state]);

  const text = state === "resolved" ? (cleaned ?? original) : original;

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "max-w-[20ch] truncate rounded px-1 text-sm transition-colors duration-700",
          state === "pending" && "animate-pulse",
          justResolved && "bg-violet-100",
        )}
      >
        {text}
      </span>
      {state === "resolved" && cleaned ? (
        <Sparkles
          className="fade-in-0 h-3.5 w-3.5 shrink-0 animate-in text-violet-500 duration-500 ease-out"
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

/** C: keyed remount on state change, each layer slides up into place. */
function VariantC({ state, original, cleaned }: CellProps) {
  const resolvedText = cleaned ?? original;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-4 w-40 overflow-hidden">
        <div
          key={state}
          className="slide-in-from-bottom-2 fade-in-0 absolute inset-0 flex animate-in items-center duration-300 ease-out"
        >
          {state === "pending" ? (
            <Skeleton className="h-4 w-28" />
          ) : (
            <span className="truncate text-sm">{resolvedText}</span>
          )}
        </div>
      </div>
      {state === "resolved" && cleaned ? (
        <Sparkles
          className="fade-in-0 zoom-in-95 h-3.5 w-3.5 shrink-0 animate-in text-violet-500 delay-150 duration-300"
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

const VARIANTS = {
  A: { label: "Crossfade morph", Cell: VariantA },
  B: { label: "Always-visible + pulse/flash", Cell: VariantB },
  C: { label: "Slide-up reveal", Cell: VariantC },
} as const;

type VariantKey = keyof typeof VARIANTS;
const VARIANT_KEYS = Object.keys(VARIANTS) as VariantKey[];

function isVariantKey(value: string | null): value is VariantKey {
  return !!value && (VARIANT_KEYS as string[]).includes(value);
}

function useDemoCycle() {
  const [states, setStates] = useState<Record<string, CellState>>(() =>
    Object.fromEntries(DEMO_ROWS.map((row) => [row.id, "pending"])),
  );
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const runCycle = useCallback(() => {
    for (const timer of timersRef.current) {
      clearTimeout(timer);
    }
    setStates(Object.fromEntries(DEMO_ROWS.map((row) => [row.id, "pending"])));

    const resolveTimers = DEMO_ROWS.map((row) =>
      setTimeout(() => {
        setStates((current) => ({ ...current, [row.id]: "resolved" }));
      }, row.resolveAfterMs),
    );
    const lastResolve = Math.max(...DEMO_ROWS.map((row) => row.resolveAfterMs));
    const loopTimer = setTimeout(() => {
      runCycle();
    }, lastResolve + LOOP_PAUSE_MS);

    timersRef.current = [...resolveTimers, loopTimer];
  }, []);

  useEffect(() => {
    runCycle();
    return () => {
      for (const timer of timersRef.current) {
        clearTimeout(timer);
      }
    };
  }, [runCycle]);

  return { states, replay: runCycle };
}

function PrototypeSwitcher({
  current,
  label,
  onChange,
}: {
  current: VariantKey;
  label: string;
  onChange: (next: VariantKey) => void;
}) {
  const index = VARIANT_KEYS.indexOf(current);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "ArrowLeft") {
        onChange(
          VARIANT_KEYS[(index - 1 + VARIANT_KEYS.length) % VARIANT_KEYS.length],
        );
      } else if (event.key === "ArrowRight") {
        onChange(VARIANT_KEYS[(index + 1) % VARIANT_KEYS.length]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, onChange]);

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-foreground px-4 py-2 text-background shadow-lg">
      <button
        type="button"
        aria-label="Previous variant"
        onClick={() =>
          onChange(
            VARIANT_KEYS[
              (index - 1 + VARIANT_KEYS.length) % VARIANT_KEYS.length
            ],
          )
        }
        className="text-lg leading-none"
      >
        ←
      </button>
      <span className="font-medium text-sm">
        {current} · {label}
      </span>
      <button
        type="button"
        aria-label="Next variant"
        onClick={() =>
          onChange(VARIANT_KEYS[(index + 1) % VARIANT_KEYS.length])
        }
        className="text-lg leading-none"
      >
        →
      </button>
    </div>
  );
}

export function MessageCellTransitionPrototype() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawVariant = searchParams.get("variant")?.toUpperCase() ?? null;
  const variant = isVariantKey(rawVariant) ? rawVariant : "A";
  const { states, replay } = useDemoCycle();
  const { Cell, label } = VARIANTS[variant];

  const resolvedCount = DEMO_ROWS.filter(
    (row) => states[row.id] === "resolved",
  ).length;
  const totalCount = DEMO_ROWS.length;
  const cleanupInProgress = resolvedCount < totalCount;

  function setVariant(next: VariantKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", next);
    router.replace(`/import?${params.toString()}`);
  }

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground text-xl tracking-tight">
            PROTOTYPE: message cell loading → text transition
          </h2>
          <p className="text-muted-foreground text-xs">
            Fake data, local timer. Not wired to the backend.
          </p>
        </div>
        <button
          type="button"
          onClick={replay}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Replay now
        </button>
      </div>

      <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 shadow-sm">
        <div className="flex items-center gap-2 text-sm">
          {cleanupInProgress ? (
            <>
              <Loader2
                className="h-4 w-4 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
              <span className="text-muted-foreground">
                Cleaning up messages… {resolvedCount} of {totalCount}
              </span>
            </>
          ) : (
            <>
              <CheckCircle2
                className="h-4 w-4 text-success"
                aria-hidden="true"
              />
              <span className="text-muted-foreground">
                Message cleanup complete
              </span>
            </>
          )}
        </div>
        <Button size="sm" disabled={cleanupInProgress} className="gap-1.5">
          {cleanupInProgress ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <DownloadCloud className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Import {totalCount} / {totalCount}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Checkbox checked aria-label="Select all rows" />
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Payment type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DEMO_ROWS.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Checkbox
                    checked
                    aria-label={`Select row ${row.rowNumber}`}
                  />
                </TableCell>
                <TableCell>{row.bookingDate}</TableCell>
                <TableCell>
                  <Cell
                    state={states[row.id]}
                    original={row.original}
                    cleaned={row.cleaned}
                  />
                </TableCell>
                <TableCell>{formatNok(row.amountNok)}</TableCell>
                <TableCell>{row.paymentType}</TableCell>
                <TableCell className="text-muted-foreground">
                  Uncategorized
                </TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PrototypeSwitcher
        current={variant}
        label={label}
        onChange={setVariant}
      />
    </div>
  );
}
