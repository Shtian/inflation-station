import type { TypedEnvSchema } from "varlock/env";
import { afterEach, vi } from "vite-plus/test";

type ConfigEnv = {
  -readonly [Key in keyof TypedEnvSchema]: TypedEnvSchema[Key];
};

/**
 * The config every unit test starts from: the required items set, every
 * optional key absent, and the flags at their schema defaults. It never reads
 * `.env`, so a developer's real keys cannot leak into a test.
 */
const BASELINE: ConfigEnv = {
  DATABASE_URL: "file:./prisma/unit-test-unused.db",
  OPENAI_MESSAGE_CLEANUP_ENABLED: true,
  OPENAI_HINT_SUGGESTIONS_ENABLED: true,
};

const config = vi.hoisted(() => ({}) as ConfigEnv);

vi.mock("varlock/env", () => ({ ENV: config }));

function reset() {
  for (const key of Object.keys(config) as (keyof ConfigEnv)[]) {
    delete config[key];
  }
  Object.assign(config, BASELINE);
}

reset();
afterEach(reset);

/** Overrides config items for the current test. Reset after each test. */
export function stubConfig(overrides: Partial<ConfigEnv>) {
  Object.assign(config, overrides);
}
