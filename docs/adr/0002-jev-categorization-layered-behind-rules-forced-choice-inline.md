# Jev categorization is layered behind rules, forced-choice, and run inline

Status: accepted

We're adding Jev (TypeSafe AI's `Choice` primitive) as the categorizer for
transactions during import review, to cover merchants the manual substring
`CategoryRule` mapping doesn't handle. Three decisions ship together: the
existing rule engine still runs first and Jev is only called for rows it
doesn't match; Jev's declared alternatives always include an explicit
"Uncategorized" choice alongside the real categories, so a weak guess can't
get force-picked into a wrong category; and the calls happen inline,
synchronously, inside the same `/api/imports/parse` request — bounded by a
12-worker in-process pool — rather than as a separate background/chunked job.

## Considered options

**Replace the rule engine outright.** Simpler pipeline, one categorizer. Rejected
because it throws away deterministic, already-correct, free substring matches
users have hand-tuned, in exchange for a probabilistic call on every single
row.

**Run Jev as a background chunked job**, mirroring the existing message-cleanup
pattern (`src/app/import/message-cleanup/run-cleanup-chunks.ts`) — separate
requests per chunk from the client, cancellable via `AbortSignal`. Rejected:
that shape exists for cleanup because cleanup must survive being cancelled by
submit/reset/re-parse mid-flight. Jev's `Choice` calls are fast and one-shot
per row with no reason to outlive the request, so the added machinery (a
route per chunk, client-side orchestration, cancellation wiring) would buy
nothing.

**Let Jev pick freely among only the real categories**, no forced
"Uncategorized" option. Rejected because `Choice` always returns *a* pick from
whatever alternatives it's given — without an explicit escape hatch, a
low-confidence guess and a confident one are indistinguishable in the UI; both
just look like "picked category X."

## Consequences

- Confidence is never persisted past the import review session:
  `CategorizationSuggestion` rows are still deleted once applied to a
  `Transaction` (unchanged from before this decision), so the certainty bar
  only exists while reviewing an in-progress import, never on the main
  Transactions list.
- Jev sees only raw, uncleaned row text (`sender`, `recipient`, `name`,
  `title`) — message-cleanup's cleaned text isn't available yet at
  categorization time, since cleanup only runs afterward via the client-driven
  chunk cycle described above.
- The bar is suppressed whenever Jev's own pick is "Uncategorized," and shown
  only for Jev-sourced suggestions, never for rule matches (a substring match
  has no meaningful confidence to display).
