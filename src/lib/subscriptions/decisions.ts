import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { SubscriptionDecisionStatus } from "./model";

export const subscriptionMerchantSchema = z.string().min(1).max(500);

export const subscriptionDecisionStatusSchema = z.enum([
  "CONFIRMED",
  "DISMISSED",
]);

export async function setSubscriptionDecision(
  db: PrismaClient,
  normalizedMerchant: string,
  status: SubscriptionDecisionStatus,
): Promise<void> {
  await db.subscriptionDecision.upsert({
    where: { normalizedMerchant },
    create: { normalizedMerchant, status },
    update: { status },
  });
}

export async function clearSubscriptionDecision(
  db: PrismaClient,
  normalizedMerchant: string,
): Promise<void> {
  await db.subscriptionDecision.deleteMany({ where: { normalizedMerchant } });
}
