# Monthly Review Route AGENTS

Load this when working in `src/app/monthly-review`.

- Keep timeline fetch/render state in `monthly-review-manager.tsx`; render manager from `page.tsx`.
- Show explicit per-month empty-state text for `NOT_GENERATED`.
- Expose per-month `Generate review` and `Regenerate review` actions with confirmation dialog before `POST /api/monthly-review/generate`.
- Refresh timeline rows after successful generation mutations.
- Render state-specific card messaging for `GENERATING` and `FAILED`, plus preview/full-text toggle for generated reviews.
- Treat primary metric as `monthlyBalanceNok` (`totalIncomeNok - totalSpendNok`) with explicit spend/income companions.
- Keep prompt settings UI state/feedback in `settings/monthly-review-settings-manager.tsx`.
- In monthly review settings, emit save success confirmations via Sonner toasts and keep load/save failures as inline alerts.
- During monthly review settings Field migrations, keep `SelectTrigger`/`Textarea` ids unchanged and pair them with `FieldLabel htmlFor` to preserve label wiring and selectors.
