# PRD: Import Page UI Improvements

## Introduction

The import page currently uses a plain file `<input>` for CSV upload, a non-interactive provider
detection dropdown, and only button-text changes as loading feedback. This PRD covers a full UI
refresh optimised for desktop (≥1024 px): drag-and-drop file upload, an improved provider detection
flow (auto-detected badge + "Change" button), skeleton loading during parsing and review-table load,
and a better two-column desktop layout.

The main implementation target is
`src/app/import/import-uploader.tsx` (~831 lines, `"use client"`).

---

## Goals

- Replace the plain file input with a drag-and-drop drop zone that still supports click-to-browse.
- Make detected provider visible as a named badge; allow the user to change it via a clearly labelled
  button that opens a full provider selector.
- Add `Skeleton` placeholders while the CSV is being parsed and while the review table is
  initialising so the page never feels frozen.
- Use `useTransition` / deferred state to keep the UI responsive during heavy operations.
- Lay out the page in a two-column grid at the `lg` breakpoint (upload/config left, summary/table
  right) instead of the current single-column scroll.
- Add the missing shadcn `Skeleton` component (not yet present in `components/ui/`).

---

## User Stories

### US-001: Add shadcn Skeleton component

**Description:** As a developer, I need a `Skeleton` component in `components/ui/` so that other
stories can use it for loading placeholders.

**Acceptance Criteria:**
- [ ] Run `npx shadcn@latest add skeleton` (or manually create the component matching the shadcn
      pattern) to add `src/components/ui/skeleton.tsx`.
- [ ] `Skeleton` accepts `className` and renders an animated pulse placeholder.
- [ ] Typecheck passes.

---

### US-002: Implement drag-and-drop file upload area

**Description:** As a user, I want to drag a CSV file onto the import page so that I don't have to
navigate a file picker every time.

**Acceptance Criteria:**
- [ ] A clearly outlined drop zone (dashed border, rounded, with an upload icon and "Drag & drop
      your CSV here, or click to browse" copy) replaces the current plain `<Input type="file" />`.
- [ ] Drag-entering the zone highlights it visually (border colour change + subtle background tint).
- [ ] Dropping a file sets `selectedFile` state exactly as the current `onChange` handler does; no
      other behaviour changes downstream.
- [ ] Clicking anywhere inside the drop zone opens the native file picker (programmatic
      `fileInputRef.current.click()`).
- [ ] The hidden `<input type="file" accept=".csv,text/csv" />` is still present for accessibility
      and programmatic reset after successful import.
- [ ] When a file is selected (by drop or browse), display the filename and file size beneath the
      drop zone with a remove/clear button (×) that resets `selectedFile` and clears the input ref.
- [ ] The drop zone is implemented without adding a new npm dependency — use native HTML5 drag
      events (`onDragOver`, `onDragLeave`, `onDrop`).
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

---

### US-003: Improve provider detection UX

**Description:** As a user, I want to see which provider was auto-detected for my CSV and be able to
change it without re-uploading, so that I have confidence in the import mapping.

**Acceptance Criteria:**
- [ ] Before a file is selected the provider section is hidden (no empty dropdown shown).
- [ ] After a file is selected and a parse attempt has been made:
  - If detection state is `"certain"`: show a green `Badge` with the detected provider name and a
    ghost "Change" `Button` (pencil icon) next to it.
  - If detection state is `"uncertain"`: show a yellow `Badge` with the detected provider name
    (or "Unknown provider" if none), a "Change" `Button`, and a short helper text such as
    "Detection was uncertain — review and confirm below".
  - If detection state is `"missing"` (no provider found): show a red `Badge` labelled
    "No provider detected" and a prominent "Select provider" `Button`.
- [ ] Clicking "Change" / "Select provider" opens a `Dialog` (shadcn `dialog.tsx`) containing:
  - A list of all available providers (fetched or from `providerDetection.candidates`) rendered as
    selectable radio-card items.
  - Each card shows the provider name and, where available, a match-score indicator.
  - A "Confirm" button sets `selectedProvider` state and closes the dialog.
  - A "Cancel" button closes the dialog without changing state.
- [ ] After the user selects a different provider the badge updates immediately to reflect the
  chosen provider.
- [ ] The existing `<Select>` provider dropdown is removed.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

---

### US-004: Skeleton loading during CSV parsing

**Description:** As a user, I want to see skeleton placeholders while my CSV is being parsed so
that the UI feels responsive rather than frozen.

**Acceptance Criteria:**
- [ ] While `importLoading` is `true`, the area below the "Parse CSV" button shows:
  - A `Skeleton` block representing the parse-summary section (e.g. 4 skeleton rows mimicking
    the DL/DD summary list).
  - A `Skeleton` block representing the start of the review table (header row + ~5 body rows).
- [ ] The "Parse CSV" button itself is disabled and shows a `Loader2` spinner icon (lucide-react)
  with "Parsing…" label, replacing the current text-only change.
- [ ] When the parse response arrives the skeletons are replaced by real content without layout
  shift.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

---

### US-005: Skeleton loading while review table populates

**Description:** As a user, I want row-level skeletons to appear as category selects and other
per-row data hydrate so the table doesn't flash empty cells.

**Acceptance Criteria:**
- [ ] Extract the review table into its own component
  `src/app/import/import-review-table.tsx` (client component).
- [ ] Wrap the table in `React.Suspense` with a `<ReviewTableSkeleton />` fallback inside
  `import-uploader.tsx` so that the skeleton is shown whenever the table component suspends.
- [ ] `ReviewTableSkeleton` renders a `<Table>` shell with the same column count but `<Skeleton>`
  cells (shimmer) for ~8 rows.
- [ ] The "Submit reviewed rows" button remains outside the Suspense boundary and is shown only
  after the table has fully rendered.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

---

### US-006: Desktop two-column layout

**Description:** As a desktop user (≥1024 px), I want the upload controls and the review table to
use the available horizontal space so I don't have to scroll past a long left-side form to see my
transactions.

**Acceptance Criteria:**
- [ ] At `lg` and above the import page renders a two-column grid:
  - **Left column** (~380 px fixed or `lg:w-96`): account selector, drop zone, provider detection
    badge/button, parse button.
  - **Right column** (flex-1): parse summary, validation errors, and the review table.
- [ ] On screens below `lg` the layout is single-column (stacked), matching the existing behaviour.
- [ ] The review table column takes full remaining width at `lg`; horizontal scrolling is allowed
  inside the table container if the table is wider than the column.
- [ ] The left column is sticky (`lg:sticky lg:top-6 lg:self-start`) so controls stay visible while
  the user scrolls through a long review table.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

---

## Functional Requirements

- **FR-1:** The file upload area must accept `.csv` and `text/csv` MIME types via both drag-and-drop
  and click-to-browse; all other file types must be silently rejected (no state change, no error).
- **FR-2:** Drag-and-drop must work without any additional npm package; use native HTML5 drag events.
- **FR-3:** When a file is already selected and the user drops a new file, the new file replaces the
  previous one.
- **FR-4:** The provider "Change" dialog must list all providers from
  `providerDetection.candidates` when available; fall back to fetching the full provider list from
  the existing data source when candidates are empty (e.g. before first parse attempt).
- **FR-5:** After the user confirms a provider change, re-parsing is NOT automatic; the user
  must click "Parse CSV" again (this matches the current flow for re-parsing).
- **FR-6:** `importLoading` skeletons must replace — not be appended to — the actual parse summary
  and table; they must never appear simultaneously with real content.
- **FR-7:** The `Skeleton` component must follow the existing shadcn pattern (pulse animation via
  Tailwind `animate-pulse bg-muted`).
- **FR-8:** All new layout changes must be contained within `import-uploader.tsx` (and the new
  `import-review-table.tsx`); the `app/import/page.tsx` wrapper requires no changes.

---

## Non-Goals

- No changes to the parse or submit API routes.
- No mobile-specific redesign (mobile layout stays as-is).
- No new npm drag-and-drop library (e.g. `react-dropzone`).
- No changes to category-decision or message-decision logic inside the review table.
- No pagination or virtualisation of the review table.
- No toast/notification system; existing inline error/success messages are retained.
- No changes to the provider-mappings page.

---

## Design Considerations

- Use existing shadcn components throughout: `Badge`, `Button`, `Dialog`, `Table`, `Tooltip`,
  `Separator`, `Card`.
- The drop zone should use `border-dashed border-2 border-muted-foreground/25` at rest and
  `border-primary bg-primary/5` when a file is dragged over it.
- Provider badge colours: `variant="default"` (green-ish) for certain, `variant="secondary"` with
  amber text for uncertain, `variant="destructive"` for missing.
- Use `Loader2` from `lucide-react` (already a dependency) for spinner icons on async buttons.
- The two-column layout uses `className="flex flex-col lg:flex-row lg:items-start gap-6"`.

---

## Technical Considerations

- **Skeleton component:** Add via `npx shadcn@latest add skeleton` — this creates
  `src/components/ui/skeleton.tsx`.
- **Drag-and-drop state:** Add `isDraggingOver: boolean` via `useState`; set to `true` on
  `onDragOver` (with `e.preventDefault()` to allow drop), `false` on `onDragLeave` and `onDrop`.
- **Provider dialog:** The dialog receives the provider list as a prop and calls a setter callback
  on confirm; no new API calls needed if candidates are already in `providerDetection`.
- **Review table extraction:** `import-review-table.tsx` receives `rows`, `categories`,
  `categoryDecisions`, `messageDecisions`, and their dispatch callbacks as props. The Suspense
  boundary in `import-uploader.tsx` wraps `<ImportReviewTable />` with a `<ReviewTableSkeleton />`
  fallback; for Suspense to trigger, the component can use `React.lazy()` with a tiny artificial
  delay, or simply show the skeleton with a conditional while the parse is in-flight.
- **`useTransition`:** Wrap the `parseCSV` handler call with `startTransition` so React can keep
  the UI interactive (the existing `importLoading` state drives skeleton visibility).
- **Accessibility:** The drop zone must have `role="button"` and `tabIndex={0}` with an `onKeyDown`
  handler (`Enter`/`Space` triggers click); the hidden `<input>` keeps `aria-hidden="true"`.

---

## Success Metrics

- A file can be dropped onto the zone without clicking "Choose file" on any desktop browser.
- The detected provider is readable immediately after the first parse attempt (no hunting for the
  dropdown value).
- The parse button and its loading state are always visible on desktop without scrolling.
- No blank/flash state between "Parsing…" and the review table appearing.

---

## Open Questions

- Should the provider selector dialog show a search/filter input when there are more than ~10
  providers? (Assumed: yes — add a text filter input inside the dialog if the candidate list exceeds
  8 items.)
- Should dropping an invalid (non-CSV) file show an inline error inside the drop zone? (Assumed:
  yes — show a small `text-destructive` message for ~3 seconds then reset.)
