import { createServerFn } from "@tanstack/react-start";
import { startSelfUpdateAction } from "@/app/actions/start-self-update";

// `details` on the error result is typed `unknown`, which fails the strict
// serializable-output check.
export const startSelfUpdateFn = createServerFn({
  method: "POST",
  strict: { output: false },
}).handler(() => startSelfUpdateAction());
