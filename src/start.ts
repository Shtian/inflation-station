import {
  sentryGlobalFunctionMiddleware,
  sentryGlobalRequestMiddleware,
} from "@sentry/tanstackstart-react";
import { createStart } from "@tanstack/react-start";
import { z } from "zod";

// zod installs its English messages as a side effect of its entry module, but
// declares `sideEffects: false`, so Rolldown drops that call and every issue
// reads "Invalid input".
z.config(z.locales.en());

export const startInstance = createStart(() => ({
  requestMiddleware: [sentryGlobalRequestMiddleware],
  functionMiddleware: [sentryGlobalFunctionMiddleware],
}));
