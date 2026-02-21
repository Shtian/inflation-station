# Server Action Mutation Architecture (US-001)

## Standard Mutation Pattern

Use this pattern for low-risk mutation migrations from `/api/*` routes to Server Actions:

1. Validate action input with Zod at the action boundary.
2. Return typed action results with a stable union shape:
   - `ok: true` with `data`
   - `ok: false` with `error.code`, `error.message`, and optional `error.details`
3. Keep domain writes in `src/lib/*` modules; actions orchestrate validation, mutation, and revalidation.
4. Preserve existing error codes and messages where possible to keep UI parity.
5. Trigger `revalidatePath` for pages that render the mutated state.

## Shared Convention

- Shared helper: `src/lib/server-actions/mutation-result.ts`
  - `mutationValidationError` for flattened Zod validation errors.
  - `executeServerMutation` for consistent typed fallback error mapping.
- Reused by:
  - `src/app/actions/update-message-cleanup-settings.ts`
  - `src/app/actions/update-monthly-review-system-prompt.ts`

## Authorization Guardrail

The current app is local-first and has no user-session authorization layer in these routes today. To avoid weakening security when auth is introduced, each new Server Action must keep an explicit authorization step before mutation execution (even if it is currently a pass-through check), and return a typed `UNAUTHORIZED`/`FORBIDDEN` action error when applicable.

## API-to-Action Migration Map

| Current route mutation | Current behavior contract | Planned server action equivalent | Revalidation target |
| --- | --- | --- | --- |
| `PUT /api/imports/message-cleanup-settings` | Validates `{ promptText, modelId? }`, rejects unknown model ids, returns settings view payload, returns `INVALID_MESSAGE_CLEANUP_SETTINGS_PAYLOAD`, `INVALID_MESSAGE_CLEANUP_MODEL_ID`, `MESSAGE_CLEANUP_SETTINGS_UPDATE_FAILED` | `updateMessageCleanupSettingsAction(input)` in `src/app/actions/update-message-cleanup-settings.ts` with same payload shape and error codes | `/import/settings/message-cleanup` |
| `PUT /api/monthly-review/system-prompt` | Validates `{ promptText, modelId? }`, rejects unknown model ids, returns settings payload, returns `INVALID_MONTHLY_REVIEW_SYSTEM_PROMPT_PAYLOAD`, `INVALID_MONTHLY_REVIEW_MODEL_ID`, `MONTHLY_REVIEW_SYSTEM_PROMPT_UPDATE_FAILED` | `updateMonthlyReviewSystemPromptAction(input)` in `src/app/actions/update-monthly-review-system-prompt.ts` with same payload shape and error codes | `/monthly-review/settings` |
| `POST /api/import-provider-mappings` and `PATCH /api/import-provider-mappings/[providerMappingId]` | Performs Zod payload validation, duplicate/required canonical field checks, merchant signal requirement, unique/not-found mapping | Planned follow-up action module in `src/app/actions/*provider-mapping*.ts` preserving existing error-code contract used by `provider-mappings-manager.tsx` | `/import-provider-mappings` |
