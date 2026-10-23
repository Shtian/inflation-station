import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
  teardownTestDatabase,
} from "../../../tests/support/prisma-test-db";
import {
  createTripMutation,
  deleteTripMutation,
  setTripMembershipMutation,
  updateTripMutation,
} from "./trip-mutations";

const { holder } = vi.hoisted(() => ({
  holder: { db: null as TestDatabase | null },
}));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return holder.db?.client;
  },
}));

beforeEach(async () => {
  holder.db = await createTestDatabase();
});

afterEach(async () => {
  if (holder.db) {
    await teardownTestDatabase(holder.db);
  }
});

function db() {
  return (holder.db as TestDatabase).client;
}

async function createLisboa() {
  const result = await createTripMutation({
    name: "Lisboa",
    startDate: "2026-05-01",
    endDate: "2026-05-05",
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.data.id;
}

describe("trip mutations", () => {
  it("creates a trip", async () => {
    const id = await createLisboa();

    const stored = await db().trip.findUniqueOrThrow({ where: { id } });
    expect(stored.name).toBe("Lisboa");
  });

  it("returns field errors for an end date before the start date", async () => {
    const result = await createTripMutation({
      name: "Lisboa",
      startDate: "2026-05-05",
      endDate: "2026-05-01",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INVALID_TRIP_PAYLOAD",
        message: "Sjekk feltene og prøv igjen.",
        details: {
          fieldErrors: { endDate: ["Sluttdato kan ikke være før startdato."] },
          formErrors: [],
        },
      },
    });
    expect(await db().trip.count()).toBe(0);
  });

  it("renames a trip", async () => {
    const id = await createLisboa();

    const result = await updateTripMutation({
      tripId: id,
      name: "Porto",
      startDate: "2026-05-01",
      endDate: "2026-05-03",
    });

    expect(result).toEqual({ ok: true, data: { id } });
    expect((await db().trip.findUniqueOrThrow({ where: { id } })).name).toBe(
      "Porto",
    );
  });

  it.each([
    [
      "update",
      () =>
        updateTripMutation({
          tripId: "gone",
          name: "Porto",
          startDate: "2026-05-01",
          endDate: "2026-05-03",
        }),
    ],
    ["delete", () => deleteTripMutation({ tripId: "gone" })],
    [
      "membership",
      () =>
        setTripMembershipMutation({ tripId: "gone", add: ["x"], remove: [] }),
    ],
  ])(
    "answers TRIP_NOT_FOUND to a %s of a missing trip",
    async (_label, run) => {
      expect(await run()).toEqual({
        ok: false,
        error: { code: "TRIP_NOT_FOUND", message: "Fant ikke turen." },
      });
    },
  );

  it("tags and untags transactions and reports the counts", async () => {
    const id = await createLisboa();
    const account = await db().account.create({ data: { name: "Brukskonto" } });
    await db().transaction.create({
      data: {
        id: "fly",
        accountId: account.id,
        bookingDate: new Date("2026-03-10T00:00:00.000Z"),
        amountNok: -2400,
        currency: "NOK",
        normalizedMerchant: "norwegian",
      },
    });

    expect(
      await setTripMembershipMutation({ tripId: id, add: ["fly"], remove: [] }),
    ).toEqual({ ok: true, data: { added: 1, removed: 0 } });
    expect(
      await setTripMembershipMutation({ tripId: id, add: [], remove: ["fly"] }),
    ).toEqual({ ok: true, data: { added: 0, removed: 1 } });
    expect(
      (await db().transaction.findUniqueOrThrow({ where: { id: "fly" } }))
        .tripId,
    ).toBeNull();
  });

  it("rejects an empty membership change", async () => {
    const result = await setTripMembershipMutation({
      tripId: "t",
      add: [],
      remove: [],
    });

    expect(result.ok ? null : result.error.code).toBe("INVALID_TRIP_PAYLOAD");
  });

  it("deletes a trip", async () => {
    const id = await createLisboa();

    expect(await deleteTripMutation({ tripId: id })).toEqual({
      ok: true,
      data: { id },
    });
    expect(await db().trip.count()).toBe(0);
  });
});
