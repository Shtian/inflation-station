import type { CategoryKind } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
  teardownTestDatabase,
} from "../../../tests/support/prisma-test-db";
import {
  listTripOptions,
  loadTripList,
  loadTripPage,
  parseTripSearch,
} from "./load";

describe("parseTripSearch", () => {
  it("returns null when the URL carries no search", () => {
    expect(parseTripSearch({})).toBeNull();
    expect(parseTripSearch({ q: "  ", belop: "" })).toBeNull();
  });

  it("reads Norwegian amounts and drops malformed dates", () => {
    expect(
      parseTripSearch({
        q: " fly ",
        fra: "2026-02-31",
        til: "2026-04-30",
        belop: "-2 400,50",
      }),
    ).toEqual({
      text: "fly",
      from: null,
      to: "2026-04-30",
      amountNok: 2400.5,
    });
    expect(parseTripSearch({ belop: "mye" })).toBeNull();
  });
});

describe("trip reads (real database)", () => {
  let db: TestDatabase;
  let accountId: string;
  const categoryIds = new Map<string, string>();

  beforeEach(async () => {
    db = await createTestDatabase();
    accountId = (
      await db.client.account.create({ data: { name: "Brukskonto" } })
    ).id;
    categoryIds.clear();
  });

  afterEach(async () => {
    await teardownTestDatabase(db);
  });

  async function category(name: string, kind: CategoryKind) {
    const created = await db.client.category.create({ data: { name, kind } });
    categoryIds.set(name, created.id);
  }

  async function trip(name: string, startDate: string, endDate: string) {
    return db.client.trip.create({
      data: {
        name,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T00:00:00.000Z`),
      },
    });
  }

  async function transaction(row: {
    id: string;
    date: string;
    amount: number;
    merchant: string;
    category?: string;
    tripId?: string;
  }) {
    await db.client.transaction.create({
      data: {
        id: row.id,
        accountId,
        bookingDate: new Date(`${row.date}T00:00:00.000Z`),
        amountNok: row.amount,
        currency: "NOK",
        merchant: row.merchant,
        normalizedMerchant: row.merchant.toLowerCase(),
        categoryId: row.category ? categoryIds.get(row.category) : undefined,
        tripId: row.tripId,
      },
    });
  }

  it("suggests in-range spending for an empty trip, then shows stored membership", async () => {
    await category("Restaurant", "EXPENSE");
    await category("Lønn", "INCOME");
    const lisboa = await trip("Lisboa", "2026-05-01", "2026-05-05");
    await transaction({
      id: "fly",
      date: "2026-03-10",
      amount: -2400,
      merchant: "Norwegian",
    });
    await transaction({
      id: "middag",
      date: "2026-05-02",
      amount: -600,
      merchant: "Time Out",
      category: "Restaurant",
    });
    await transaction({
      id: "lonn",
      date: "2026-05-05",
      amount: 30000,
      merchant: "Arbeidsgiver",
      category: "Lønn",
    });
    await transaction({
      id: "etter",
      date: "2026-05-06",
      amount: -50,
      merchant: "Kiosk",
    });

    const empty = await loadTripPage(db.client, lisboa.id, null);
    expect(empty?.inRange.map((row) => [row.id, row.defaultChecked])).toEqual([
      ["lonn", false],
      ["middag", true],
    ]);
    expect(empty?.search).toBeNull();

    await db.client.transaction.update({
      where: { id: "fly" },
      data: { tripId: lisboa.id },
    });
    const curated = await loadTripPage(db.client, lisboa.id, null);

    expect(curated?.summary.costNok).toBe(2400);
    expect(curated?.summary.beforeTrip.map((row) => row.merchant)).toEqual([
      "Norwegian",
    ]);
    expect(curated?.inRange.map((row) => [row.id, row.defaultChecked])).toEqual(
      [
        ["lonn", false],
        ["middag", false],
      ],
    );
    expect(await loadTripPage(db.client, "gone", null)).toBeNull();
  });

  it("leaves a recurring bill unchecked on a new trip and marks it recurring", async () => {
    await category("Strøm", "EXPENSE");
    await category("Restaurant", "EXPENSE");
    const lisboa = await trip("Lisboa", "2026-05-01", "2026-05-05");
    for (const [id, date] of [
      ["strom-mars", "2026-03-03"],
      ["strom-april", "2026-04-03"],
      ["strom-mai", "2026-05-03"],
    ]) {
      await transaction({
        id,
        date,
        amount: -900,
        merchant: "Fjordkraft",
        category: "Strøm",
      });
    }
    await transaction({
      id: "middag",
      date: "2026-05-02",
      amount: -600,
      merchant: "Time Out",
      category: "Restaurant",
    });

    const page = await loadTripPage(db.client, lisboa.id, null);

    expect(
      page?.inRange.map(({ id, defaultChecked, recurring }) => ({
        id,
        defaultChecked,
        recurring,
      })),
    ).toEqual([
      { id: "strom-mai", defaultChecked: false, recurring: true },
      { id: "middag", defaultChecked: true, recurring: false },
    ]);
  });

  it("searches by text, date and amount within a krone, never listing members", async () => {
    await category("Reise", "EXPENSE");
    const lisboa = await trip("Lisboa", "2026-05-01", "2026-05-05");
    await transaction({
      id: "fly",
      date: "2026-03-10",
      amount: -2400.4,
      merchant: "Norwegian Air",
      category: "Reise",
    });
    await transaction({
      id: "fly-retur",
      date: "2026-03-12",
      amount: 2399.5,
      merchant: "Norwegian Air refusjon",
    });
    await transaction({
      id: "fly-dyrt",
      date: "2026-03-11",
      amount: -2402,
      merchant: "Norwegian Air",
    });
    await transaction({
      id: "fly-gammel",
      date: "2025-12-01",
      amount: -2400,
      merchant: "Norwegian Air",
    });
    await transaction({
      id: "fly-tagget",
      date: "2026-03-10",
      amount: -2400,
      merchant: "Norwegian Air",
      tripId: lisboa.id,
    });

    const page = await loadTripPage(db.client, lisboa.id, {
      text: "norwegian",
      from: "2026-01-01",
      to: "2026-04-30",
      amountNok: 2400,
    });

    expect(
      page?.search?.results.map((row) => [row.id, row.defaultChecked]),
    ).toEqual([
      ["fly-retur", false],
      ["fly", false],
    ]);
    expect(page?.search?.truncated).toBe(false);

    const byCategory = await loadTripPage(db.client, lisboa.id, {
      text: "reise",
      from: null,
      to: null,
      amountNok: null,
    });
    expect(byCategory?.search?.results.map((row) => row.id)).toEqual(["fly"]);
  });

  it("caps search results at 50 and says so", async () => {
    const lisboa = await trip("Lisboa", "2026-05-01", "2026-05-05");
    for (let index = 0; index < 51; index += 1) {
      await transaction({
        id: `kaffe-${String(index).padStart(2, "0")}`,
        date: "2026-04-01",
        amount: -45,
        merchant: "Kaffebrenneriet",
      });
    }

    const page = await loadTripPage(db.client, lisboa.id, {
      text: "kaffe",
      from: null,
      to: null,
      amountNok: null,
    });

    expect(page?.search?.results.length).toBe(50);
    expect(page?.search?.truncated).toBe(true);
  });

  it("lists trips newest first with their cost, and offers them as options", async () => {
    const bergen = await trip("Bergen", "2026-02-01", "2026-02-02");
    const lisboa = await trip("Lisboa", "2026-05-01", "2026-05-05");
    await transaction({
      id: "tog",
      date: "2026-02-01",
      amount: -900,
      merchant: "Vy",
      tripId: bergen.id,
    });

    expect(await loadTripList(db.client)).toEqual([
      {
        id: lisboa.id,
        name: "Lisboa",
        startDate: "2026-05-01",
        endDate: "2026-05-05",
        days: 5,
        costNok: 0,
        perDayNok: 0,
        transactionCount: 0,
      },
      {
        id: bergen.id,
        name: "Bergen",
        startDate: "2026-02-01",
        endDate: "2026-02-02",
        days: 2,
        costNok: 900,
        perDayNok: 450,
        transactionCount: 1,
      },
    ]);
    expect((await listTripOptions(db.client)).map((t) => t.name)).toEqual([
      "Lisboa",
      "Bergen",
    ]);
  });
});
