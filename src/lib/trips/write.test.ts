import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  createTestDatabase,
  type TestDatabase,
  teardownTestDatabase,
} from "../../../tests/support/prisma-test-db";
import {
  createTrip,
  deleteTrip,
  setTripMembership,
  tripInputSchema,
  tripMembershipChangeSchema,
  updateTrip,
} from "./write";

describe("trip schemas", () => {
  it("canonicalizes a trip to trimmed name and midnight-UTC days", () => {
    const parsed = tripInputSchema.parse({
      name: "  Lisboa  ",
      startDate: "2026-05-01",
      endDate: "2026-05-05",
    });

    expect({
      name: parsed.name,
      startDate: parsed.startDate.toISOString(),
      endDate: parsed.endDate.toISOString(),
    }).toEqual({
      name: "Lisboa",
      startDate: "2026-05-01T00:00:00.000Z",
      endDate: "2026-05-05T00:00:00.000Z",
    });
  });

  it("rejects an end date before the start date on the end date field", () => {
    const result = tripInputSchema.safeParse({
      name: "Lisboa",
      startDate: "2026-05-05",
      endDate: "2026-05-01",
    });

    expect(result.success ? null : result.error.flatten().fieldErrors).toEqual({
      endDate: ["Sluttdato kan ikke være før startdato."],
    });
  });

  it("asks for a missing date instead of a format, and keeps the format error for a bad one", () => {
    const empty = tripInputSchema.safeParse({
      name: "Lisboa",
      startDate: "",
      endDate: " ",
    });
    const missingEnd = tripInputSchema.safeParse({
      name: "Lisboa",
      startDate: "2026-05-01",
      endDate: "",
    });
    const malformed = tripInputSchema.safeParse({
      name: "Lisboa",
      startDate: "2026-05-01",
      endDate: "2026-13-40",
    });

    expect(empty.success ? null : empty.error.flatten().fieldErrors).toEqual({
      startDate: ["Velg en startdato."],
      endDate: ["Velg en sluttdato."],
    });
    expect(
      missingEnd.success ? null : missingEnd.error.flatten().fieldErrors,
    ).toEqual({ endDate: ["Velg en sluttdato."] });
    expect(
      malformed.success ? null : malformed.error.flatten().fieldErrors,
    ).toEqual({ endDate: ["Datoen må ha formatet ÅÅÅÅ-MM-DD."] });
  });

  it.each(["add", "remove"] as const)(
    "accepts 500 %s ids and rejects 501",
    (field) => {
      const ids = Array.from({ length: 500 }, (_, index) => `row-${index}`);
      const change = { tripId: "t", add: [], remove: [], [field]: ids };
      expect(tripMembershipChangeSchema.parse(change)[field]).toEqual(ids);
      expect(
        tripMembershipChangeSchema.safeParse({
          ...change,
          [field]: [...ids, "row-500"],
        }).success,
      ).toBe(false);
    },
  );

  it("dedupes ids and rejects a change that adds and removes the same row", () => {
    expect(
      tripMembershipChangeSchema.parse({
        tripId: "t",
        add: ["a", "a", "b"],
        remove: [],
      }),
    ).toEqual({ tripId: "t", add: ["a", "b"], remove: [] });

    const clash = tripMembershipChangeSchema.safeParse({
      tripId: "t",
      add: ["a"],
      remove: ["a"],
    });
    expect(
      clash.success ? [] : clash.error.issues.map((i) => i.message),
    ).toEqual(["En transaksjon kan ikke både legges til og fjernes."]);
  });
});

describe("trip writes (real database)", () => {
  let db: TestDatabase;
  let accountId: string;

  beforeEach(async () => {
    db = await createTestDatabase();
    accountId = (
      await db.client.account.create({ data: { name: "Brukskonto" } })
    ).id;
  });

  afterEach(async () => {
    await teardownTestDatabase(db);
  });

  function trip(name: string) {
    return createTrip(
      db.client,
      tripInputSchema.parse({
        name,
        startDate: "2026-05-01",
        endDate: "2026-05-05",
      }),
    );
  }

  async function transaction(id: string) {
    await db.client.transaction.create({
      data: {
        id,
        accountId,
        bookingDate: new Date("2026-05-02T00:00:00.000Z"),
        amountNok: -100,
        currency: "NOK",
        normalizedMerchant: id,
      },
    });
  }

  async function tripIds() {
    const rows = await db.client.transaction.findMany({
      select: { id: true, tripId: true },
      orderBy: { id: "asc" },
    });
    return Object.fromEntries(rows.map((row) => [row.id, row.tripId]));
  }

  it("converges to the same members however often the change runs", async () => {
    const lisboa = await trip("Lisboa");
    await transaction("a");
    await transaction("b");
    await transaction("c");
    const change = { tripId: lisboa.id, add: ["a", "b"], remove: [] };

    expect(await setTripMembership(db.client, change)).toEqual({
      added: 2,
      removed: 0,
    });
    expect(await setTripMembership(db.client, change)).toEqual({
      added: 0,
      removed: 0,
    });
    expect(await tripIds()).toEqual({ a: lisboa.id, b: lisboa.id, c: null });

    const removeB = { tripId: lisboa.id, add: [], remove: ["b"] };
    expect(await setTripMembership(db.client, removeB)).toEqual({
      added: 0,
      removed: 1,
    });
    expect(await setTripMembership(db.client, removeB)).toEqual({
      added: 0,
      removed: 0,
    });
    expect(await tripIds()).toEqual({ a: lisboa.id, b: null, c: null });
  });

  it("moves a row between trips on add but never untags another trip's row on remove", async () => {
    const lisboa = await trip("Lisboa");
    const roma = await trip("Roma");
    await transaction("a");
    await transaction("b");
    await setTripMembership(db.client, {
      tripId: roma.id,
      add: ["a", "b"],
      remove: [],
    });

    const result = await setTripMembership(db.client, {
      tripId: lisboa.id,
      add: ["a"],
      remove: ["b"],
    });

    expect(result).toEqual({ added: 1, removed: 0 });
    expect(await tripIds()).toEqual({ a: lisboa.id, b: roma.id });
  });

  it("rejects a change for a missing trip without touching any row", async () => {
    await transaction("a");

    await expect(
      setTripMembership(db.client, { tripId: "gone", add: ["a"], remove: [] }),
    ).rejects.toMatchObject({ code: "P2025" });
    expect(await tripIds()).toEqual({ a: null });
  });

  it("deleting a trip un-tags its transactions and keeps them", async () => {
    const lisboa = await trip("Lisboa");
    await transaction("a");
    await setTripMembership(db.client, {
      tripId: lisboa.id,
      add: ["a"],
      remove: [],
    });

    await deleteTrip(db.client, lisboa.id);

    expect(await tripIds()).toEqual({ a: null });
    expect(await db.client.trip.count()).toBe(0);
  });

  it("renames and re-dates a trip in place", async () => {
    const lisboa = await trip("Lisboa");

    await updateTrip(
      db.client,
      lisboa.id,
      tripInputSchema.parse({
        name: "Lisboa og Porto",
        startDate: "2026-04-30",
        endDate: "2026-05-08",
      }),
    );

    const stored = await db.client.trip.findUniqueOrThrow({
      where: { id: lisboa.id },
    });
    expect({
      name: stored.name,
      startDate: stored.startDate.toISOString().slice(0, 10),
      endDate: stored.endDate.toISOString().slice(0, 10),
    }).toEqual({
      name: "Lisboa og Porto",
      startDate: "2026-04-30",
      endDate: "2026-05-08",
    });
  });
});
