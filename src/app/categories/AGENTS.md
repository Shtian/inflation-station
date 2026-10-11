# Categories Route AGENTS

Load this when working in `src/app/categories`.

- Keep category/category-rule CRUD interactions in this route, backed by `/api/categories` and `/api/category-rules`.
- Keep shared scope-label and mutation-error helpers in `categories-manager.utils.ts`.
- Keep UI split into `components/category-management-section.tsx` and `components/rules-management-section.tsx`.
- Keep user-facing success/error feedback local to this route.
- Use Sonner `toast.success(...)` for successful category/category-rule CRUD feedback, while keeping blocking validation/API errors inline.
- For category form migrations, use shared `Field` primitives (`Field`, `FieldLabel`, `FieldContent`) and keep existing `Input`/`SelectTrigger` ids (including rename dialog ids) unchanged for accessible label wiring and stable tests.
- In `rules-management-section.tsx`, keep `CategoryCombobox` inside `FieldContent` and preserve its `id` (`rule-category`) so `FieldLabel htmlFor` remains screen-reader and test-selector friendly.
- The edit dialog's classifier hint field is `components/hint-editor/classifier-hint-editor.tsx`, driven by the pure `HintDraft` reducer in `hint-draft.ts` and fed by `GET /api/categories/[categoryId]/merchants`. Stubbed e2e specs must stub `**/api/categories/*/merchants` separately; the `**/api/categories/*` glob does not match it.
- The editor also reads `GET /api/categories/[categoryId]/hint-guess` (AI description and guessed merchants) only after the user clicks "Suggest with AI", never on open. Stub `**/api/categories/*/hint-guess` separately in every e2e spec that opens the edit dialog, so no test reaches OpenAI.
