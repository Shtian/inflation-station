import type { PrismaClient } from "@prisma/client";
import { detectRecurringCharges } from "./detect";
import type { IsoDay } from "./model";
import {
  recurringMerchants,
  reviewSubscriptions,
  type SubscriptionReview,
} from "./review";

async function loadDetection(db: PrismaClient) {
  const [transactions, decisions] = await Promise.all([
    db.transaction.findMany({
      where: { amountNok: { lt: 0 } },
      select: {
        id: true,
        bookingDate: true,
        amountNok: true,
        normalizedMerchant: true,
        merchant: true,
        category: { select: { kind: true } },
      },
    }),
    db.subscriptionDecision.findMany({
      select: { normalizedMerchant: true, status: true },
    }),
  ]);

  return {
    candidates: detectRecurringCharges(
      transactions.map((transaction) => ({
        ...transaction,
        bookingDate: transaction.bookingDate.toISOString().slice(0, 10),
        amountNok: transaction.amountNok.toNumber(),
      })),
    ),
    decisions: new Map(
      decisions.map((row) => [row.normalizedMerchant, row.status]),
    ),
  };
}

export async function loadSubscriptionReview(
  db: PrismaClient,
  today: IsoDay,
): Promise<SubscriptionReview> {
  const { candidates, decisions } = await loadDetection(db);
  return reviewSubscriptions(candidates, decisions, today);
}

export async function loadRecurringMerchants(
  db: PrismaClient,
): Promise<Set<string>> {
  const { candidates, decisions } = await loadDetection(db);
  return recurringMerchants(candidates, decisions);
}
