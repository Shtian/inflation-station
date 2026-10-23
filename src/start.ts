import {
  sentryGlobalFunctionMiddleware,
  sentryGlobalRequestMiddleware,
} from "@sentry/tanstackstart-react";
import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { z } from "zod";

// zod installs its English messages as a side effect of its entry module, but
// declares `sideEffects: false`, so Rolldown drops that call and every issue
// reads "Invalid input".
z.config(z.locales.en());

// Server functions are same-origin RPC endpoints, so reject cross-site calls.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [sentryGlobalRequestMiddleware, csrfMiddleware],
  functionMiddleware: [sentryGlobalFunctionMiddleware],
}));
