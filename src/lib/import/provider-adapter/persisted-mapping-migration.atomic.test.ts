import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
  teardownTestDatabase,
} from "../../../../tests/support/prisma-test-db";
import { loadProviderAdapters } from "./repository";

const MIGRATION_SQL_PATH = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../prisma/migrations/20260904103000_migrate_provider_mappings_to_executable_v1/migration.sql",
);

/**
 * The data migration runs against an already-empty database when the harness
 * applies committed migrations, so replaying it here against legacy-shaped rows
 * is what actually proves it converts them.
 */
async function replayProviderMappingMigration(db: TestDatabase): Promise<void> {
  const statements = readFileSync(MIGRATION_SQL_PATH, "utf8")
    .split(";")
    .map((statement) =>
      statement
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((statement) => statement.length > 0);

  for (const statement of statements) {
    await db.client.$executeRawUnsafe(statement);
  }
}

describe("persisted provider mapping migration (real database)", () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase(db);
  });

  it("converts a legacy seeded mapping into one that compiles", async () => {
    await db.client.importProviderMapping.create({
      data: {
        providerName: "Nordea",
        mappingVersion: 1,
        normalizationRules: {
          dateFormat: "DD.MM.YYYY",
          decimalSeparator: ",",
          encoding: "UTF-8",
          delimiter: ";",
        },
        fieldMappings: {
          create: [
            { sourceField: "Bokføringsdato", canonicalField: "bookingDate" },
            { sourceField: "Beløp", canonicalField: "amountNok" },
            { sourceField: "Tittel", canonicalField: "normalizedMerchant" },
            { sourceField: "Tittel", canonicalField: "title" },
          ],
        },
      },
    });

    const before = await loadProviderAdapters(db.client);
    expect(before.adapters).toHaveLength(0);
    expect(before.configurationErrors[0]?.code).toBe(
      "UNKNOWN_NORMALIZATION_RULE",
    );

    await replayProviderMappingMigration(db);

    const after = await loadProviderAdapters(db.client);
    expect(after.configurationErrors).toEqual([]);
    expect(after.adapters.map((adapter) => adapter.providerName)).toEqual([
      "Nordea",
    ]);

    const persisted = await db.client.importProviderMapping.findFirstOrThrow({
      where: { providerName: "Nordea" },
      select: {
        normalizationRules: true,
        fieldMappings: {
          select: { sourceField: true, canonicalField: true },
          orderBy: { canonicalField: "asc" },
        },
      },
    });

    expect(persisted.normalizationRules).toEqual({
      dateFormat: "DD.MM.YYYY",
      decimalSeparator: ",",
      delimiter: ";",
    });
    expect(persisted.fieldMappings).toEqual([
      { sourceField: "Beløp", canonicalField: "amount" },
      { sourceField: "Bokføringsdato", canonicalField: "bookingDate" },
      { sourceField: "Tittel", canonicalField: "title" },
    ]);
  });

  it("promotes normalizedMerchant to title when it is the only merchant signal", async () => {
    await db.client.importProviderMapping.create({
      data: {
        providerName: "Merchant Only",
        mappingVersion: 1,
        normalizationRules: { encoding: "UTF-8" },
        fieldMappings: {
          create: [
            { sourceField: "Dato", canonicalField: "bookingDate" },
            { sourceField: "Beløp", canonicalField: "amount" },
            {
              sourceField: "Beskrivelse",
              canonicalField: "normalizedMerchant",
            },
          ],
        },
      },
    });

    await replayProviderMappingMigration(db);

    const after = await loadProviderAdapters(db.client);
    expect(after.configurationErrors).toEqual([]);
    expect(after.adapters).toHaveLength(1);

    const persisted =
      await db.client.importProviderFieldMapping.findFirstOrThrow({
        where: { sourceField: "Beskrivelse" },
        select: { canonicalField: true },
      });
    expect(persisted.canonicalField).toBe("title");
  });

  it("leaves an already-executable mapping untouched", async () => {
    await db.client.importProviderMapping.create({
      data: {
        providerName: "Already Valid",
        mappingVersion: 1,
        normalizationRules: { dateFormat: "YYYY-MM-DD", decimalSeparator: "." },
        fieldMappings: {
          create: [
            { sourceField: "Date", canonicalField: "bookingDate" },
            { sourceField: "Amount", canonicalField: "amount" },
            { sourceField: "Text", canonicalField: "title" },
          ],
        },
      },
    });

    await replayProviderMappingMigration(db);

    const persisted = await db.client.importProviderMapping.findFirstOrThrow({
      where: { providerName: "Already Valid" },
      select: {
        normalizationRules: true,
        fieldMappings: { select: { canonicalField: true } },
      },
    });

    expect(persisted.normalizationRules).toEqual({
      dateFormat: "YYYY-MM-DD",
      decimalSeparator: ".",
    });
    expect(persisted.fieldMappings).toHaveLength(3);
  });
});
