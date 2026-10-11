"use server";

import { rm } from "node:fs/promises";
import path from "node:path";
import {
  readSelfUpdateStatus,
  selfUpdateStateDir,
  spawnSelfUpdate,
} from "@/lib/self-update/self-update";
import {
  executeServerMutation,
  type MutationActionResult,
  mutationError,
} from "@/lib/server-actions/mutation-result";

type StartSelfUpdateErrorCode =
  | "SELF_UPDATE_DISABLED"
  | "SELF_UPDATE_RUNNING"
  | "SELF_UPDATE_FAILED";

const START_TIMEOUT_MS = 5000;
const START_POLL_MS = 100;

export async function startSelfUpdateAction(): Promise<
  MutationActionResult<{ sha: string }, StartSelfUpdateErrorCode>
> {
  const root = process.env.SELF_UPDATE_ROOT;
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? "unknown";

  if (!root) {
    return mutationError(
      "SELF_UPDATE_DISABLED",
      "Self-update is only available in the standalone production build.",
    );
  }

  if ((await readSelfUpdateStatus(root, sha)).phase === "running") {
    return mutationError(
      "SELF_UPDATE_RUNNING",
      "An update is already running.",
    );
  }

  return executeServerMutation({
    execute: async () => {
      // Without the previous result, the next status the client sees is
      // unambiguously from this run.
      await rm(path.join(selfUpdateStateDir(root), "result"), { force: true });
      spawnSelfUpdate(root);

      const deadline = Date.now() + START_TIMEOUT_MS;
      while ((await readSelfUpdateStatus(root, sha)).phase === "never-run") {
        if (Date.now() > deadline) {
          throw new Error("The self-update script did not start.");
        }
        await new Promise((resolve) => setTimeout(resolve, START_POLL_MS));
      }
      return { sha };
    },
    fallbackError: {
      code: "SELF_UPDATE_FAILED",
      message: "Could not start the update.",
    },
  });
}
