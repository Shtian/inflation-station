import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  createTestDatabase,
  type TestDatabase,
  teardownTestDatabase,
} from "../../../tests/support/prisma-test-db";
import {
  createAccounts,
  createCategories,
  loadSetupSnapshot,
} from "./setup-store";

let testDb: TestDatabase;

beforeEach(async () => {
  testDb = await createTestDatabase();
});

afterEach(async () => {
  await teardownTestDatabase(testDb);
});

describe("createAccounts", () => {
  it("creates new accounts with trimmed names and institutions", async () => {
    const result = await createAccounts(testDb.client, [
      { name: "  Brukskonto ", institution: " DNB " },
      { name: "Sparekonto", institution: "  " },
    ]);

    expect(result).toEqual({
      created: ["Brukskonto", "Sparekonto"],
      existing: [],
    });
    expect((await loadSetupSnapshot(testDb.client)).accounts).toEqual([
      { name: "Brukskonto", institution: "DNB" },
      { name: "Sparekonto", institution: null },
    ]);
  });

  it("reports accounts that already exist under any casing", async () => {
    await testDb.client.account.create({
      data: { name: "Brukskonto", institution: "DNB" },
    });

    const result = await createAccounts(testDb.client, [
      { name: "brukskonto", institution: "Nordea" },
      { name: "Kredittkort" },
    ]);

    expect(result).toEqual({
      created: ["Kredittkort"],
      existing: ["Brukskonto"],
    });
    expect((await loadSetupSnapshot(testDb.client)).accounts).toEqual([
      { name: "Brukskonto", institution: "DNB" },
      { name: "Kredittkort", institution: null },
    ]);
  });

  it("creates a name repeated within one batch once", async () => {
    const result = await createAccounts(testDb.client, [
      { name: "Brukskonto" },
      { name: "BRUKSKONTO " },
    ]);

    expect(result).toEqual({ created: ["Brukskonto"], existing: [] });
    expect(await testDb.client.account.count()).toBe(1);
  });

  it("creates nothing when the same batch runs again", async () => {
    const batch = [
      { name: "Brukskonto", institution: "DNB" },
      { name: "Sparekonto", institution: "DNB" },
    ];
    await createAccounts(testDb.client, batch);

    const rerun = await createAccounts(testDb.client, batch);

    expect(rerun).toEqual({
      created: [],
      existing: ["Brukskonto", "Sparekonto"],
    });
    expect(await testDb.client.account.count()).toBe(2);
  });
});

describe("createCategories", () => {
  it("creates categories with kind and trimmed hint", async () => {
    const result = await createCategories(testDb.client, [
      {
        name: "Dagligvarer",
        kind: "EXPENSE",
        classifierHint: " Rema, Kiwi, Coop ",
      },
      { name: "Overføringer", kind: "TRANSFER", classifierHint: "" },
    ]);

    expect(result).toEqual({
      created: ["Dagligvarer", "Overføringer"],
      existing: [],
    });
    expect((await loadSetupSnapshot(testDb.client)).categories).toEqual([
      {
        name: "Dagligvarer",
        kind: "EXPENSE",
        classifierHint: "Rema, Kiwi, Coop",
      },
      { name: "Overføringer", kind: "TRANSFER", classifierHint: null },
    ]);
  });

  it("keeps an existing category untouched when the name matches", async () => {
    await testDb.client.category.create({
      data: { name: "Lønn", kind: "INCOME", classifierHint: "Arbeidsgiver" },
    });

    const result = await createCategories(testDb.client, [
      { name: "lønn ", kind: "EXPENSE", classifierHint: "Annet" },
    ]);

    expect(result).toEqual({ created: [], existing: ["Lønn"] });
    expect((await loadSetupSnapshot(testDb.client)).categories).toEqual([
      { name: "Lønn", kind: "INCOME", classifierHint: "Arbeidsgiver" },
    ]);
  });

  it("creates nothing when the same batch runs again", async () => {
    const batch = [
      { name: "Dagligvarer", kind: "EXPENSE" as const },
      { name: "Lønn", kind: "INCOME" as const },
    ];
    await createCategories(testDb.client, batch);

    const rerun = await createCategories(testDb.client, batch);

    expect(rerun).toEqual({ created: [], existing: ["Dagligvarer", "Lønn"] });
    expect(await testDb.client.category.count()).toBe(2);
  });
});
