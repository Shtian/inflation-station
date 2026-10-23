import { createServerFn } from "@tanstack/react-start";
import { updateMessageCleanupSettingsAction } from "@/app/actions/update-message-cleanup-settings";

// Validation stays in the shared mutation, which owns the error contract; see
// `trips/-server.ts` for why output is not strict.
const passThrough = (input: unknown) => input;

export const updateMessageCleanupSettingsFn = createServerFn({
  method: "POST",
  strict: { output: false },
})
  .validator(passThrough)
  .handler(({ data }) => updateMessageCleanupSettingsAction(data));
