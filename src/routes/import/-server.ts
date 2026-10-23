import { createServerFn } from "@tanstack/react-start";
import { saveAccountCsvColumnMappingAction } from "@/app/actions/save-account-csv-column-mapping";

// Validation stays in the shared mutation, which owns the error contract; see
// `trips/-server.ts` for why output is not strict.
const passThrough = (input: unknown) => input;

export const saveAccountCsvColumnMappingFn = createServerFn({
  method: "POST",
  strict: { output: false },
})
  .validator(passThrough)
  .handler(({ data }) => saveAccountCsvColumnMappingAction(data));
