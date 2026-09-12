# US-003 Migration Inventory: Toast + Field Targets

This inventory captures the current inline success feedback and non-`Field` form surfaces that drive the upcoming Sonner + `@/components/ui/field` migrations.

## 1) Inline success feedback targeted for Sonner migration

| Route area | File path | Current success state/output | Message string(s) |
| --- | --- | --- | --- |
| Accounts CRUD | `src/app/accounts/use-accounts-manager.ts` | `setAccountNotice(...)` | `"Account added."`, `"Account updated."`, `"Account removed."` |
| Accounts notice rendering | `src/app/accounts/accounts-manager.tsx` | Inline success `<p>` when `accountNotice` is set | Renders `accountNotice` |
| Categories + rules CRUD | `src/app/categories/categories-manager.tsx` | `setNotice(...)` | `"Category added."`, `"Category removed."`, `"Category renamed."`, `"Category rule added."`, `"Category rule removed."` |
| Categories notice rendering | `src/app/categories/categories-manager.tsx` | Inline success `<p>` when `notice` is set | Renders `notice` |
| Provider mappings CRUD | `src/app/import-provider-mappings/provider-mappings-manager.tsx` | `setNotice(...)` | `"Provider mapping added."`, `"Provider mapping updated."`, `"Provider mapping removed."` |
| Provider mappings notice rendering | `src/app/import-provider-mappings/provider-mappings-manager.tsx` | Inline success `<output>` when `notice` is set | Renders `notice` |
| Import submit completion | `src/app/import/use-import-workflow.ts` | `setSubmitNotice(...)` on successful `/api/imports/submit` | `"Import complete. Imported {imported}, skipped {skipped}, potential duplicates {potentialDuplicates}, invalid {invalid}."` |
| Import upload phase notice rendering | `src/app/import/components/import-upload-phase.tsx` | Inline success `<output>` when `submitNotice` is set | Renders `submitNotice` |
| Import review phase notice rendering | `src/app/import/components/import-review-phase.tsx` | Inline success `<output>` when `submitNotice` is set | Renders `submitNotice` |
| Message cleanup settings saves | `src/app/import/settings/message-cleanup/message-cleanup-settings-manager.tsx` | `setSuccess(...)` after successful save/model change | `"System prompt saved."`, `"Cleanup model saved."` |
| Message cleanup settings success rendering | `src/app/import/settings/message-cleanup/message-cleanup-settings-manager.tsx` | Inline success `<p>` when `success` is set | Renders `success` |
| Monthly review settings saves | `src/app/monthly-review/settings/monthly-review-settings-manager.tsx` | `setSuccess(...)` after successful save/model change | `"System prompt saved."`, `"Generation model saved."` |
| Monthly review settings success rendering | `src/app/monthly-review/settings/monthly-review-settings-manager.tsx` | Inline success `<p>` when `success` is set | Renders `success` |

## 2) Form surfaces not yet using `@/components/ui/field`

Current grep baseline under `src/app/**`: `@/components/ui/label` appears in 12 files; `@/components/ui/field` appears only in `src/app/import/components/import-review-phase.tsx`.

### In-scope for current PRD stories

| Story ID | File path | Notes |
| --- | --- | --- |
| US-011 | `src/app/accounts/components/create-account-section.tsx` | Create account inputs still use `Label` + `Input` grouping. |
| US-012 | `src/app/categories/components/category-management-section.tsx` | New category + rename dialog fields still use `Label` + controls. |
| US-013 | `src/app/categories/components/rules-management-section.tsx` | Rule category/merchant/payment/priority/scope inputs still use `Label` + controls. |
| US-014 | `src/app/import-provider-mappings/components/add-provider-mapping-dialog.tsx` | Provider/mapping version inputs still use ad-hoc label/input structure. |
| US-014 | `src/app/import-provider-mappings/components/edit-provider-mapping-dialog.tsx` | Provider/mapping version inputs still use ad-hoc label/input structure. |
| US-014 | `src/app/import-provider-mappings/components/provider-mapping-string-badge-input.tsx` | Label + input + inline error not yet using `FieldError` semantics. |
| US-015 | `src/app/transactions/components/edit-transaction-dialog.tsx` | Dialog controls still use `Label` + control blocks. |
| US-016 | `src/app/import/settings/message-cleanup/message-cleanup-settings-manager.tsx` | Model + prompt controls still use `Label` + control blocks. |
| US-017 | `src/app/monthly-review/settings/monthly-review-settings-manager.tsx` | Model + prompt controls still use `Label` + control blocks. |
| US-018 | `src/app/import/components/import-upload-phase.tsx` | Account/file input labeling still uses ad-hoc `Label` structure. |

### Out-of-scope for this migration track

| File path | Reason |
| --- | --- |
| `src/app/(overview)/overview-dashboard.tsx` | Dashboard filtering controls are not included in US-011 through US-018 scope. |
| `src/app/transactions/components/transactions-table-section.tsx` | Toolbar filter controls are outside the edit-dialog-focused scope in this PRD. |

## 3) E2E tests asserting inline success text that need toast assertion updates

| Test file | Current inline success assertions |
| --- | --- |
| `tests/e2e/us-011-account-import-ui.e2e.ts` | `"Account added."`, `"Account updated."`, `"Account removed."` |
| `tests/e2e/us-015-categories-route-management.e2e.ts` | `"Category added."`, `"Category renamed."`, `"Category rule added."`, `"Category rule removed."`, `"Category removed."` |
| `tests/e2e/us-019-provider-mapping-admin-ui.e2e.ts` | `"Provider mapping added."`, `"Provider mapping updated."` |
| `tests/e2e/us-020-monthly-review-route.e2e.ts` | `"System prompt saved."` |

## 4) Coverage gaps to carry into implementation

- `Provider mapping removed.` is emitted in UI logic but not currently asserted by E2E.
- Message cleanup settings success strings (`System prompt saved.`, `Cleanup model saved.`) currently have no Playwright success-toast assertion coverage.
