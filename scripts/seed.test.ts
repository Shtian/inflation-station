import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { expect, it } from "vitest";

const execFileAsync = promisify(execFile);

it("seeds a fresh database with two explicitly tagged trips and reseeds without duplicates", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "inflation-station-seed-"),
  );
  const databaseUrl = `file:${path.join(directory, "seed.db")}`;
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: databaseUrl }),
  });
  const seed = () =>
    execFileAsync("pnpm", ["db:seed"], {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: databaseUrl, TZ: "UTC" },
      timeout: 60_000,
    });
  const readTrips = () =>
    prisma.trip.findMany({
      orderBy: { startDate: "asc" },
      select: {
        name: true,
        startDate: true,
        endDate: true,
        transactions: {
          orderBy: [{ bookingDate: "asc" }, { normalizedMerchant: "asc" }],
          select: {
            bookingDate: true,
            normalizedMerchant: true,
            amountNok: true,
            account: { select: { name: true } },
            category: { select: { name: true, kind: true } },
          },
        },
      },
    });

  try {
    const firstRun = await seed();
    expect(firstRun.stdout).toContain("Seed complete.");
    const trips = await readTrips();
    expect(trips.map((trip) => trip.name)).toEqual(["Lisboa", "Bergen"]);
    expect(
      trips.map((trip) =>
        trip.transactions.map((transaction) => transaction.normalizedMerchant),
      ),
    ).toEqual([
      [
        "Norwegian fly til Lisboa",
        "Hotel Lisboa Plaza",
        "Metro Lisboa",
        "Time Out Market Lisboa",
      ],
      [
        "Vy tog til Bergen",
        "Hotel Norge Bergen",
        "Bryggeloftet Bergen",
        "Fløibanen Bergen",
      ],
    ]);
    for (const trip of trips) {
      expect(
        [...new Set(trip.transactions.map((tx) => tx.account.name))].sort(),
      ).toEqual(["Lønnskonto", "Visa Kredittkort"]);
      expect(trip.startDate.getUTCHours()).toBe(0);
      expect(trip.endDate.getUTCHours()).toBe(0);
      expect(trip.endDate.getTime()).toBeGreaterThan(trip.startDate.getTime());
      expect(
        trip.transactions.filter((tx) => tx.bookingDate < trip.startDate),
      ).toHaveLength(trip.name === "Lisboa" ? 2 : 1);
      expect(
        trip.transactions.filter(
          (tx) =>
            tx.bookingDate >= trip.startDate && tx.bookingDate <= trip.endDate,
        ),
      ).toHaveLength(trip.name === "Lisboa" ? 2 : 3);
      for (const transaction of trip.transactions) {
        expect(transaction.bookingDate.getUTCHours()).toBe(0);
        expect(transaction.amountNok.toNumber()).toBeLessThan(0);
        expect(transaction.category?.kind).toBe("EXPENSE");
      }
    }

    const reviews = await prisma.monthlyReview.findMany({
      orderBy: { monthStart: "asc" },
    });
    expect(reviews).toHaveLength(3);
    expect(trips[0].startDate.toISOString().slice(0, 7)).toBe(
      reviews[1].monthStart.toISOString().slice(0, 7),
    );
    expect(trips[1].startDate.toISOString().slice(0, 7)).toBe(
      reviews[2].monthStart.toISOString().slice(0, 7),
    );
    for (const review of reviews) {
      const monthEnd = new Date(review.monthStart);
      monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
      const transactions = await prisma.transaction.findMany({
        where: { bookingDate: { gte: review.monthStart, lt: monthEnd } },
        include: { account: true },
      });
      expect(transactions.length).toBeGreaterThan(20);
      const cardSpending = transactions
        .filter((tx) => tx.account.name === "Visa Kredittkort")
        .reduce((sum, tx) => sum + tx.amountNok.toNumber(), 0);
      const cardBill = transactions.find(
        (tx) => tx.normalizedMerchant === "Kredittkortbetaling Nordea",
      );
      expect(cardBill?.amountNok.toNumber()).toBeCloseTo(cardSpending, 2);
      if (review === reviews[1]) {
        expect(
          transactions.some(
            (tx) =>
              tx.tripId === null &&
              tx.bookingDate >= trips[0].startDate &&
              tx.bookingDate <= trips[0].endDate,
          ),
        ).toBe(true);
      }
    }

    const counts = await Promise.all([
      prisma.transaction.count(),
      prisma.categorizationSuggestion.count(),
      prisma.category.count(),
      prisma.account.count(),
      prisma.monthlyReview.count(),
    ]);
    await prisma.$disconnect();
    const secondRun = await seed();
    expect(secondRun.stdout).toContain("Seed complete.");
    expect(await readTrips()).toEqual(trips);
    expect(
      await Promise.all([
        prisma.transaction.count(),
        prisma.categorizationSuggestion.count(),
        prisma.category.count(),
        prisma.account.count(),
        prisma.monthlyReview.count(),
      ]),
    ).toEqual(counts);
  } finally {
    await prisma.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
}, 120_000);
