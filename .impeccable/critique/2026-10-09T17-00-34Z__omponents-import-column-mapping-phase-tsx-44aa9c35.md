---
target: the new import page (Map Columns step)
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/shtian/.t3/worktrees/inflation-station/t3code-b62fe9a2/src/app/import/components/import-column-mapping-phase.tsx"
target_fingerprint: "sha256:b29bb4b8b6fbb640141e3f3556796adc2947dabea5a23e5ce2943d4e4a9bf62b"
target_path: /Users/shtian/.t3/worktrees/inflation-station/t3code-b62fe9a2/src/app/import/components/import-column-mapping-phase.tsx
timestamp: 2026-10-09T17-00-34Z
slug: omponents-import-column-mapping-phase-tsx-44aa9c35
---
# Critique: Map Columns step (import-column-mapping-phase.tsx)

Total 24/40 (Acceptable). P0: 0, P1: 3.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 3 | Stepper flashes to step 4 "Review & Import" while parsing, then falls back to step 3 (import-uploader.tsx:53-66) |
| 2 | Match real world | 3 | Good banking copy; "Guessed"/"Not found" are system terms |
| 3 | User control | 2 | No reset to suggestion; toggling amount kind loses provenance |
| 4 | Consistency | 2 | Native 13px radios beside custom Checkbox; primary action on top unlike sibling steps; date example format flips |
| 5 | Error prevention | 2 | Every column offered for every field; same column allowed for money in and out |
| 6 | Recognition | 3 | Sample values on every card and an example on every row |
| 7 | Flexibility | 2 | One row open at a time; no description reorder |
| 8 | Minimalist | 3 | Banner over-weighted; "Not used" + "Not found" redundancy |
| 9 | Error recovery | 2 | Disabled Confirm gives no reason; preview vanishes when incomplete; errors not tied to fields |
| 10 | Help | 2 | Payment type, description joining, and "reserved" unexplained |

Priority issues:
1. [P1] Stepper/phase flash during parse (import-uploader.tsx:53-66).
2. [P1] Mobile (390px): banner squeezes text to ~80-120px column; row label w-28 + non-shrinking source label truncate the column/example.
3. [P1] Proof hidden, claim loud: preview collapsed and removed when incomplete; Confirm above the rows.
4. [P2] Option overload + weak prevention: 5-6 cards per decision, 10 in split mode; no type ranking; in=out allowed.
5. [P2] A11y/state honesty: aria-label hides samples from SR; status icons aria-hidden; no live region; faint focus ring (~2.7-3:1) and no focus-within on cards; 13px radios; preview toggle 20px tall.

Detector: CLI 0 findings; browser overlay 2 findings, both app-shell false positives (footer hash contrast, app-wide font).
