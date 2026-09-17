# Import message cleanup streams as parallel chunk requests, not SSE

Status: accepted, not yet implemented. Tracked by #114.

`POST /api/imports/parse` used to block on one OpenAI call covering every row in
the CSV. Measured at 300 rows on `gpt-5.4-nano`, that call needs about 96
seconds against a 90 second timeout, so it returned `unavailableReason:
"timeout"` and zero suggestions. The feature did not degrade at scale, it failed.

Cleanup therefore moves off the parse request. Parse stages the rows and returns
a `CleanupPlan`, a pure list of `{index, rowIds}` produced by
`planCleanupChunks`. The review table renders immediately with original
messages, rule-prefilled categories, and duplicate flags. The client then issues
one `POST /api/imports/cleanup` per chunk, several at a time, and patches rows
as each response lands.

Chunk boundaries are planned, never stored. `planCleanupChunks` runs once in the
parse route to publish the plan and again in the chunk route to re-derive
identical boundaries from the same session. The chunk endpoint reads rows and
returns suggestions. It writes nothing.

## Considered options

**Server-sent events over one long-lived response.** The natural shape for
"stream results as they arrive", and it keeps chunk size and concurrency hidden
behind a single server module rather than leaking them to the client.

Rejected on testability, which we measured rather than argued. A throwaway
Playwright probe against this repo's own Playwright showed that
`page.route().fulfill()` with a `text/event-stream` body delivers the entire
body in exactly one `reader.read()`. Frames parse correctly, so a frame parser
would be unit-testable, but the stubbed suite cannot demonstrate that chunk one
reaches the table before chunk two. Incremental arrival is the entire point of
the feature, and proving it would have required the integrated suite, which
holds very few specs and costs a real server per assertion.

Discrete requests map one to one onto discrete `page.route` interceptions, so
staged arrival, out-of-order completion, and single-chunk failure are all
provable in the cheap suite that `tests/e2e/us-016-import-route-upload.e2e.ts`
already uses.

Choosing discrete requests also deletes a protocol. There is no frame format, no
reconnect handling, no stream lifecycle, and cancelling is
`controller.abort()` rather than a teardown path.

**Persisting suggestions to a new `ImportReviewRow.cleanedMessage` column,
written as each chunk lands.** Considered alongside SSE, and it would survive a
page refresh.

Rejected for two reasons. A refresh already discards `parseResult`, the category
decisions, the notes, and the row selection, so persisting only the AI
suggestion builds half of session resume while leaving the expensive human
decisions unsaved. More seriously, the persist-then-announce ordering it
requires opens a window where the server holds a cleaned merchant name the
client has never rendered. Since that variant also moved message resolution
server-side at commit time, a submit landing inside that window would write text
the user never saw. A review screen's whole promise is that what you see is what
gets saved.

**Polling a status endpoint.** Rejected as strictly worse than the chosen shape.
It needs the same number of round trips, adds a diff on the client to work out
what is new, and delivers results later than a push of the same data.

## Consequences

- **The chunk endpoint is idempotent because it writes nothing.** Retrying a
  failed chunk is a re-POST with no compensating logic, and retrying twice is
  harmless.
- **Chunk size and concurrency are client-visible.** The client receives
  `rowIds` per chunk so it can show which rows are still pending. This is the
  price paid for the testability above.
- **Suggestions live in client state and do not survive a refresh.** Accepted,
  because everything else on that screen already behaves the same way.
- **A pending suggestion resolves to the original message.** Confirming an
  import mid-flight therefore needs no special-case code in the submit path, and
  persists exactly what the table showed at the click.
- **Message state is two maps with one writer each.** The suggestion map is
  written only by the code applying a chunk result, and the override map only by
  the user's toggle. Neither writer can see the other's map, so a late-arriving
  suggestion cannot flip a row the user already touched. A missing override
  entry means "no explicit choice yet", which is a distinct state from "chose
  original", and nothing seeds that map.
- **The eager seeding block in `use-import-workflow.ts` is deleted.** The review
  table already carries the correct fallback for a row with no suggestion. Eager
  seeding was the only reason that fallback never fired.
- **Calls move to `generateObject` with a zod schema.** Measured
  latency-neutral at 14.29s against 14.47s for the hand-parsed `generateText`
  path, so roughly forty lines of fence-stripping, brace-slicing, and manual
  type guards are deleted for free.
- **A schema does not guarantee completeness.** A response holding 20
  suggestions is as schema-valid as one holding 300, and `gpt-5.6-luna` really
  does return 20 of 300 on a single large call. Completeness is checked by
  comparing requested row numbers against returned ones, not by the schema.
- **Constants are measured, not guessed.** Chunk size 25 and client concurrency
  6, from the benchmark at `src/lib/import/cleanup-bench.test.ts`. Concurrency 4
  costs about six seconds on a 300 row import and 12 buys nothing over 6. Chunk
  size 15 loses to per-request overhead.
