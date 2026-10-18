import type { PrismaClient } from "@prisma/client";
import { detectRecurringCharges } from "./detect";
import type { IsoDay } from "./model";
import { reviewSubscriptions, type SubscriptionReview } from "./review";

export async function loadSubscriptionReview(
  db: PrismaClient,
  today: IsoDay,
): Promise<SubscriptionReview> {
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

  const candidates = detectRecurringCharges(
    transactions.map((transaction) => ({
      ...transaction,
      bookingDate: transaction.bookingDate.toISOString().slice(0, 10),
      amountNok: transaction.amountNok.toNumber(),
    })),
  );

  return reviewSubscriptions(
    candidates,
    new Map(decisions.map((row) => [row.normalizedMerchant, row.status])),
    today,
  );
}
