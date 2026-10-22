import { createServerFn } from "@tanstack/react-start";
import { deleteAssistantThreadAction } from "@/app/actions/delete-assistant-thread";
import { renameAssistantThreadAction } from "@/app/actions/rename-assistant-thread";

// Validation stays in the shared mutation so the error contract matches the
// Next action; see `trips/-server.ts` for why output is not strict.
const passThrough = (input: unknown) => input;

export const deleteAssistantThreadFn = createServerFn({
  method: "POST",
  strict: { output: false },
})
  .validator(passThrough)
  .handler(({ data }) => deleteAssistantThreadAction(data));

export const renameAssistantThreadFn = createServerFn({
  method: "POST",
  strict: { output: false },
})
  .validator(passThrough)
  .handler(({ data }) => renameAssistantThreadAction(data));
