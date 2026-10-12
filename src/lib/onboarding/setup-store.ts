import type { Prisma, PrismaClient } from "@prisma/client";
import type { CategoryKindName, SetupSnapshot } from "./progress";

export type AccountInput = { name: string; institution?: string | null };

export type CategoryInput = {
  name: string;
  kind: CategoryKindName;
  classifierHint?: string | null;
};

export type BatchResult = { created: string[]; existing: string[] };

export async function loadSetupSnapshot(
  db: PrismaClient,
): Promise<SetupSnapshot> {
  const [accounts, categories] = await Promise.all([
    db.account.findMany({
      select: { name: true, institution: true },
      orderBy: { createdAt: "asc" },
    }),
    db.category.findMany({
      select: { name: true, kind: true, classifierHint: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
  ]);
  return { accounts, categories };
}

function nameKey(name: string): string {
  return name.trim().toLocaleLowerCase("nb");
}

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// The schema's unique index is case-sensitive, but "dnb" and "DNB" are the same
// account to the user. One transaction keeps a retried call from adding both.
async function createMissing<T extends { name: string }>(
  db: PrismaClient,
  items: T[],
  readNames: (tx: Prisma.TransactionClient) => Promise<string[]>,
  create: (
    tx: Prisma.TransactionClient,
    name: string,
    item: T,
  ) => Promise<unknown>,
): Promise<BatchResult> {
  return db.$transaction(async (tx) => {
    const known = new Map(
      (await readNames(tx)).map((name) => [nameKey(name), name]),
    );
    const created: string[] = [];
    const existing: string[] = [];
    for (const item of items) {
      const name = item.name.trim();
      const knownName = known.get(nameKey(name));
      if (knownName !== undefined) {
        if (!existing.includes(knownName) && !created.includes(knownName)) {
          existing.push(knownName);
        }
        continue;
      }
      await create(tx, name, item);
      known.set(nameKey(name), name);
      created.push(name);
    }
    return { created, existing };
  });
}

export function createAccounts(
  db: PrismaClient,
  items: AccountInput[],
): Promise<BatchResult> {
  return createMissing(
    db,
    items,
    async (tx) =>
      (await tx.account.findMany({ select: { name: true } })).map(
        (account) => account.name,
      ),
    (tx, name, item) =>
      tx.account.create({
        data: { name, institution: optionalText(item.institution) },
      }),
  );
}

export function createCategories(
  db: PrismaClient,
  items: CategoryInput[],
): Promise<BatchResult> {
  return createMissing(
    db,
    items,
    async (tx) =>
      (await tx.category.findMany({ select: { name: true } })).map(
        (category) => category.name,
      ),
    (tx, name, item) =>
      tx.category.create({
        data: {
          name,
          kind: item.kind,
          classifierHint: optionalText(item.classifierHint),
        },
      }),
  );
}
