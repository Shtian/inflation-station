import { MonthlyReviewStatus, type PaymentType } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
  teardownTestDatabase,
} from "../../../tests/support/prisma-test-db";
import {
  buildMonthInReview,
  getMonthInReview,
  getMonthInReviewWithReview,
  type MonthInReviewTransactionRecord,
} from "./month-in-review";

// Transactions are stored as local midnight; pin a non-UTC zone so month and
// day bucketing is exercised the same way on every machine.
process.env.TZ = "Europe/Oslo";

const FOOD = { id: "cat-food", name: "Food", kind: "EXPENSE" };
const TRAVEL = { id: "cat-travel", name: "Travel", kind: "EXPENSE" };
const ELECTRONICS = {
  id: "cat-electronics",
  name: "Electronics",
  kind: "EXPENSE",
};
const HOUSING = { id: "cat-housing", name: "Housing", kind: "EXPENSE" };
const UTILITIES = { id: "cat-utilities", name: "Utilities", kind: "EXPENSE" };
const SALARY = { id: "cat-salary", name: "Salary", kind: "INCOME" };
const TRANSFER = { id: "cat-transfer", name: "Transfer", kind: "TRANSFER" };

function tx(
  id: string,
  isoDate: string,
  amountNok: number,
  normalizedMerchant: string,
  category: MonthInReviewTransactionRecord["category"],
  paymentType: PaymentType = "CARD",
): MonthInReviewTransactionRecord {
  return {
    id,
    bookingDate: new Date(`${isoDate}T10:00:00.000Z`),
    amountNok,
    normalizedMerchant,
    paymentType,
    category,
  };
}

function februaryDailySpend(
  byDate: Record<string, { spendNok: number; transactionCount: number }>,
) {
  return Array.from({ length: 28 }, (_, index) => {
    const date = `2026-02-${`${index + 1}`.padStart(2, "0")}`;
    return { date, ...(byDate[date] ?? { spendNok: 0, transactionCount: 0 }) };
  });
}

const NO_ADJACENT_BOOKING = { findFirst: vi.fn(async () => null) };

const februaryTransactions = [
  tx("feb-salary", "2026-02-01", 30000, "EMPLOYER", SALARY),
  tx("feb-bonus", "2026-02-15", 2000, "EMPLOYER", SALARY),
  tx("feb-nav", "2026-02-10", 1500, "NAV", null),
  tx("feb-tax", "2026-02-11", 400, "SKATTEETATEN", null),
  tx("feb-unknown-income", "2026-02-12", 100, "", null),
  tx("feb-transfer-out", "2026-02-03", -5000, "SAVINGS", TRANSFER),
  tx("feb-transfer-in", "2026-02-03", 5000, "CHECKING", TRANSFER),
  tx("feb-rema-1", "2026-02-02", -700, "REMA 1000", FOOD),
  tx("feb-rema-2", "2026-02-04", -300, "REMA 1000", FOOD),
  tx("feb-vy", "2026-02-04", -500, "VY", TRAVEL),
  tx("feb-uncat", "2026-02-04", -100, "  ", null),
  tx("feb-elkjop", "2026-02-14", -2400, "ELKJOP", ELECTRONICS),
  tx("feb-kiwi", "2026-02-20", -200, "KIWI", FOOD),
  tx("feb-narvesen", "2026-02-25", -50, "NARVESEN", FOOD),
  tx("feb-mortgage", "2026-02-20", -20000, "BOLIGLAN", HOUSING, "EFT"),
  tx("feb-power", "2026-02-20", -800, "TIBBER", UTILITIES, "EFT"),
  tx("feb-insurance", "2026-02-20", -450, "GJENSIDIGE", null, "EFT"),
];

const januaryTransactions = [
  tx("jan-salary", "2026-01-01", 30000, "EMPLOYER", SALARY),
  tx("jan-transfer", "2026-01-05", -1000, "SAVINGS", TRANSFER),
  tx("jan-rema", "2026-01-10", -1500, "REMA 1000", FOOD),
  tx("jan-vy", "2026-01-12", -200, "VY", TRAVEL),
];

describe("buildMonthInReview", () => {
  it("builds cashflow and category movers over all spend, and merchants and moments over everyday spend", () => {
    const result = buildMonthInReview({
      monthStart: "2026-02-01",
      monthTransactions: februaryTransactions,
      previousMonthTransactions: januaryTransactions,
    });

    expect(result).toEqual({
      monthStart: "2026-02-01",
      cashflow: {
        incomeNok: 34000,
        spendNok: 25500,
        netNok: 8500,
        savingsRate: 0.25,
      },
      previousMonth: {
        monthStart: "2026-01-01",
        incomeNok: 30000,
        spendNok: 1700,
        netNok: 28300,
      },
      spendTransactionCount: 10,
      categories: [
        {
          categoryId: "cat-housing",
          categoryName: "Housing",
          spendNok: 20000,
          share: 20000 / 25500,
          transactionCount: 1,
          deltaNok: 20000,
        },
        {
          categoryId: "cat-electronics",
          categoryName: "Electronics",
          spendNok: 2400,
          share: 2400 / 25500,
          transactionCount: 1,
          deltaNok: 2400,
        },
        {
          categoryId: "cat-food",
          categoryName: "Food",
          spendNok: 1250,
          share: 1250 / 25500,
          transactionCount: 4,
          deltaNok: -250,
        },
        {
          categoryId: "cat-utilities",
          categoryName: "Utilities",
          spendNok: 800,
          share: 800 / 25500,
          transactionCount: 1,
          deltaNok: 800,
        },
        {
          categoryId: null,
          categoryName: "Ukategorisert",
          spendNok: 550,
          share: 550 / 25500,
          transactionCount: 2,
          deltaNok: 550,
        },
        {
          categoryId: "cat-travel",
          categoryName: "Travel",
          spendNok: 500,
          share: 500 / 25500,
          transactionCount: 1,
          deltaNok: 300,
        },
      ],
      incomeSources: [
        { source: "EMPLOYER", amountNok: 32000 },
        { source: "NAV", amountNok: 1500 },
        { source: "SKATTEETATEN", amountNok: 400 },
      ],
      bills: {
        totalNok: 21250,
        count: 3,
        items: [
          { merchant: "BOLIGLAN", categoryName: "Housing", amountNok: 20000 },
          { merchant: "TIBBER", categoryName: "Utilities", amountNok: 800 },
          { merchant: "GJENSIDIGE", categoryName: null, amountNok: 450 },
        ],
      },
      everyday: {
        totalNok: 4250,
        count: 7,
        topMerchants: [
          {
            merchant: "ELKJOP",
            spendNok: 2400,
            share: 2400 / 4250,
            transactionCount: 1,
          },
          {
            merchant: "REMA 1000",
            spendNok: 1000,
            share: 1000 / 4250,
            transactionCount: 2,
          },
          {
            merchant: "VY",
            spendNok: 500,
            share: 500 / 4250,
            transactionCount: 1,
          },
          {
            merchant: "KIWI",
            spendNok: 200,
            share: 200 / 4250,
            transactionCount: 1,
          },
          {
            merchant: "Ukjent brukersted",
            spendNok: 100,
            share: 100 / 4250,
            transactionCount: 1,
          },
        ],
        biggestPurchase: {
          bookingDate: "2026-02-14",
          merchant: "ELKJOP",
          amountNok: 2400,
          categoryName: "Electronics",
        },
        busiestDay: {
          bookingDate: "2026-02-04",
          spendNok: 900,
          transactionCount: 3,
        },
        dailySpend: februaryDailySpend({
          "2026-02-02": { spendNok: 700, transactionCount: 1 },
          "2026-02-04": { spendNok: 900, transactionCount: 3 },
          "2026-02-14": { spendNok: 2400, transactionCount: 1 },
          "2026-02-20": { spendNok: 200, transactionCount: 1 },
          "2026-02-25": { spendNok: 50, transactionCount: 1 },
        }),
      },
    });
  });

  it("leaves comparisons and savings rate empty when there is no prior month or income", () => {
    const result = buildMonthInReview({
      monthStart: "2026-02-01",
      monthTransactions: [
        tx("feb-a", "2026-02-02", -300, "REMA 1000", null),
        tx("feb-b", "2026-02-09", -450, "VY", TRAVEL),
      ],
      previousMonthTransactions: [],
    });

    expect(result.cashflow).toEqual({
      incomeNok: 0,
      spendNok: 750,
      netNok: -750,
      savingsRate: null,
    });
    expect(result.previousMonth).toBeNull();
    expect(result.categories.map((category) => category.deltaNok)).toEqual([
      null,
      null,
    ]);
    expect(result.incomeSources).toEqual([]);
    expect(result.everyday.biggestPurchase).toEqual({
      bookingDate: "2026-02-09",
      merchant: "VY",
      amountNok: 450,
      categoryName: "Travel",
    });
    expect(result.everyday.busiestDay).toEqual({
      bookingDate: "2026-02-09",
      spendNok: 450,
      transactionCount: 1,
    });
  });

  it("returns empty facts for a month with only transfers", () => {
    const result = buildMonthInReview({
      monthStart: "2026-02-01",
      monthTransactions: [
        tx("feb-transfer", "2026-02-03", -5000, "SAVINGS", TRANSFER),
      ],
      previousMonthTransactions: [],
    });

    expect(result).toEqual({
      monthStart: "2026-02-01",
      cashflow: { incomeNok: 0, spendNok: 0, netNok: 0, savingsRate: null },
      previousMonth: null,
      spendTransactionCount: 0,
      categories: [],
      incomeSources: [],
      bills: { totalNok: 0, count: 0, items: [] },
      everyday: {
        totalNok: 0,
        count: 0,
        topMerchants: [],
        biggestPurchase: null,
        busiestDay: null,
        dailySpend: februaryDailySpend({}),
      },
    });
  });
});

describe("getMonthInReview", () => {
  it("queries the month and the prior month using local calendar bounds", async () => {
    const findMany = vi.fn(
      async ({ where }: { where: { bookingDate: { gte: Date } } }) =>
        where.bookingDate.gte.getMonth() === 0
          ? januaryTransactions
          : februaryTransactions,
    );

    const result = await getMonthInReview(
      { transaction: { findMany } },
      { monthStart: "2026-02-01" },
    );

    expect(findMany.mock.calls.map(([args]) => args.where.bookingDate)).toEqual(
      [
        {
          gte: new Date("2026-01-31T23:00:00.000Z"),
          lt: new Date("2026-02-28T23:00:00.000Z"),
        },
        {
          gte: new Date("2025-12-31T23:00:00.000Z"),
          lt: new Date("2026-01-31T23:00:00.000Z"),
        },
      ],
    );
    expect(result.cashflow.netNok).toBe(8500);
    expect(result.previousMonth?.spendNok).toBe(1700);
  });

  it("throws stable error for invalid monthStart input", async () => {
    const findMany = vi.fn(async () => []);

    await expect(
      getMonthInReview(
        { transaction: { findMany } },
        { monthStart: "2026-13-01" },
      ),
    ).rejects.toThrow("MONTH_START_INVALID");
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("getMonthInReviewWithReview", () => {
  it("attaches the persisted review state and recap", async () => {
    const result = await getMonthInReviewWithReview(
      {
        transaction: {
          findMany: vi.fn(async () => []),
          ...NO_ADJACENT_BOOKING,
        },
        monthlyReview: {
          findUnique: vi.fn(async () => ({
            status: MonthlyReviewStatus.GENERATED,
            generatedAt: new Date("2026-03-02T08:00:00.000Z"),
            errorMessage: null,
            recap: {
              headline: "Februar gikk i pluss.",
              points: ["Mat gikk ned.", "Sett av overskuddet."],
            },
          })),
        },
      },
      { monthStart: "2026-02-01" },
    );

    expect(result.reviewState).toBe("GENERATED");
    expect(result.generatedAt).toBe("2026-03-02T08:00:00.000Z");
    expect(result.recap).toEqual({
      headline: "Februar gikk i pluss.",
      points: ["Mat gikk ned.", "Sett av overskuddet."],
    });
  });

  it("reports NOT_GENERATED when no review row exists", async () => {
    const findUnique = vi.fn(async () => null);

    const result = await getMonthInReviewWithReview(
      {
        transaction: {
          findMany: vi.fn(async () => []),
          ...NO_ADJACENT_BOOKING,
        },
        monthlyReview: { findUnique },
      },
      { monthStart: "2026-02-01" },
    );

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { monthStart: new Date("2026-02-01T00:00:00.000Z") },
      }),
    );
    expect(result).toMatchObject({
      reviewState: "NOT_GENERATED",
      generatedAt: null,
      errorMessage: null,
      recap: null,
    });
  });
});

describe("local calendar months", () => {
  it("counts a row booked at local midnight on the 1st in that month and day", async () => {
    const localFirstOfSeptember = new Date(2026, 8, 1);
    expect(localFirstOfSeptember.toISOString()).toBe(
      "2026-08-31T22:00:00.000Z",
    );
    const rows: MonthInReviewTransactionRecord[] = [
      {
        id: "sep-rent",
        bookingDate: localFirstOfSeptember,
        amountNok: -20377,
        normalizedMerchant: "LANDLORD",
        paymentType: "CARD",
        category: { id: "cat-rent", name: "Rent", kind: "EXPENSE" },
      },
    ];
    const findMany = vi.fn(
      async ({ where }: { where: { bookingDate: { gte: Date; lt: Date } } }) =>
        rows.filter(
          (row) =>
            row.bookingDate >= where.bookingDate.gte &&
            row.bookingDate < where.bookingDate.lt,
        ),
    );

    const result = await getMonthInReview(
      { transaction: { findMany } },
      { monthStart: "2026-09-01" },
    );

    expect(result.cashflow.spendNok).toBe(20377);
    expect(result.previousMonth).toBeNull();
    expect(result.everyday.dailySpend[0]).toEqual({
      date: "2026-09-01",
      spendNok: 20377,
      transactionCount: 1,
    });
    expect(result.everyday.dailySpend).toHaveLength(30);
    expect(result.everyday.biggestPurchase).toEqual({
      bookingDate: "2026-09-01",
      merchant: "LANDLORD",
      amountNok: 20377,
      categoryName: "Rent",
    });
    expect(result.everyday.busiestDay).toEqual({
      bookingDate: "2026-09-01",
      spendNok: 20377,
      transactionCount: 1,
    });
  });
});

describe("adjacent months", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase(db);
  });

  it("points at the nearest months with non-transfer bookings, skipping transfer-only months", async () => {
    const account = await db.client.account.create({
      data: { name: "Brukskonto" },
    });
    const transfer = await db.client.category.create({
      data: { name: "Overføring", kind: "TRANSFER" },
    });
    const booking = (bookingDate: Date, categoryId: string | null) => ({
      accountId: account.id,
      bookingDate,
      amountNok: -100,
      currency: "NOK",
      normalizedMerchant: "MERCHANT",
      categoryId,
    });
    await db.client.transaction.createMany({
      data: [
        booking(new Date(2026, 6, 15), null),
        booking(new Date(2026, 7, 10), transfer.id),
        booking(new Date(2026, 8, 5), null),
        booking(new Date(2026, 9, 3), transfer.id),
        booking(new Date(2026, 10, 1), null),
      ],
    });

    const september = await getMonthInReviewWithReview(db.client, {
      monthStart: "2026-09-01",
    });
    const july = await getMonthInReviewWithReview(db.client, {
      monthStart: "2026-07-01",
    });

    expect(september.adjacentMonths).toEqual({
      previous: "2026-07-01",
      next: "2026-11-01",
    });
    expect(july.adjacentMonths).toEqual({ previous: null, next: "2026-09-01" });
  });
});
