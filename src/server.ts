// Imported from the bundled entry rather than through `node --import`, so the
// init shares the build SHA and the Sentry options with the client, and
// `node .output/server/index.mjs` needs no extra flags.
import "./instrument.server";
import { wrapFetchWithSentry } from "@sentry/tanstackstart-react";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

export default createServerEntry(
  wrapFetchWithSentry({
    fetch(request: Request) {
      return handler.fetch(request);
    },
  }),
);
