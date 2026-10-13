# Monthly Review Route AGENTS

Load this when working in `src/app/monthly-review`.

- Keep timeline fetch/render state in `monthly-review-manager.tsx`; render manager from `page.tsx`. Timeline cards stay deterministic: each links to `/monthly-review/[monthStart]` and shows a small AI review-state indicator, with no inline AI text or generate actions.
- The month in review deck lives in `[monthStart]/`. `month-in-review.tsx` fetches `GET /api/monthly-review/[monthStart]` client-side so the stubbed Playwright suite can intercept it, and owns slide navigation (buttons, progress segments, arrows/Home/End/Escape, touch taps and swipes, `?slide=<id>` in the URL) and the generate flow.
- Add or reorder slides in the `MONTH_IN_REVIEW_SLIDES` registry in `[monthStart]/month-in-review.slides.tsx`. Each entry's `isAvailable(review)` drops slides without data and `world(review)` picks its color world from `month-in-review.worlds.ts`; keep both out of render conditionals.
- AI generation happens only on the deck's finale slide: `Skriv en oppsummering`/`Skriv oppsummeringen på nytt`/`Prøv igjen` open a confirmation dialog before `POST /api/monthly-review/generate`, then the deck refetches the month.
- Treat primary metric as `monthlyBalanceNok` (`totalIncomeNok - totalSpendNok`) with explicit spend/income companions.
- Keep prompt settings UI state/feedback in `settings/monthly-review-settings-manager.tsx`.
- In monthly review settings, emit save success confirmations via Sonner toasts and keep load/save failures as inline alerts.
- During monthly review settings Field migrations, keep `SelectTrigger`/`Textarea` ids unchanged and pair them with `FieldLabel htmlFor` to preserve label wiring and selectors.
