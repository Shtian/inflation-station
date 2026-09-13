import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const INTEGRATED_SPEC_DIR = path.resolve(__dirname, "../integrated");
const LOCK_DECLARATION = "lock: INTEGRATED_DB_LOCK";

async function readIntegratedSpecs(): Promise<
  { name: string; source: string }[]
> {
  const entries = await readdir(INTEGRATED_SPEC_DIR);

  return Promise.all(
    entries
      .filter((entry) => entry.endsWith(".integrated.ts"))
      .map(async (name) => ({
        name,
        source: await readFile(path.join(INTEGRATED_SPEC_DIR, name), "utf8"),
      })),
  );
}

function testsMissing(source: string, needle: string): number[] {
  return source
    .split(/^test\(/m)
    .slice(1)
    .flatMap((body, index) => (body.includes(needle) ? [] : [index + 1]));
}

/**
 * An integrated test that forgets its lock truncates the database while
 * another test is mid-flight, which surfaces as some unrelated test failing
 * intermittently. Catching that here costs less than debugging it there.
 */
describe("integrated specs", () => {
  it("declare the shared lock on every test", async () => {
    const specs = await readIntegratedSpecs();
    expect(specs.map((spec) => spec.name)).not.toEqual([]);

    const offenders = specs.flatMap((spec) =>
      testsMissing(spec.source, LOCK_DECLARATION).map(
        (position) => `${spec.name} test #${position}`,
      ),
    );

    expect(offenders).toEqual([]);
  });

  it("never intercept network traffic", async () => {
    const specs = await readIntegratedSpecs();

    const offenders = specs
      .filter((spec) => spec.source.includes("page.route("))
      .map((spec) => spec.name);

    expect(offenders).toEqual([]);
  });
});
