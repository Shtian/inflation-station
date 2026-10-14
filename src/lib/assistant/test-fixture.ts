import type { PrismaClient } from "@prisma/client";

export function localMidnight(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export async function seedAssistantFixture(client: PrismaClient) {
  await client.account.createMany({
    data: [
      { id: "acc-main", name: "Brukskonto", institution: "DNB" },
      { id: "acc-card", name: "Kredittkort", isActive: false },
    ],
  });
  await client.category.createMany({
    data: [
      { id: "cat-food", name: "Mat", kind: "EXPENSE" },
      { id: "cat-travel", name: "Reise", kind: "EXPENSE" },
      { id: "cat-transfer", name: "Overføring", kind: "TRANSFER" },
      { id: "cat-salary", name: "Lønn", kind: "INCOME" },
    ],
  });

  const transactions: Array<{
    id: string;
    bookingDate: Date;
    amountNok: number;
    categoryId: string | null;
    accountId: string;
    merchant: string | null;
    normalizedMerchant: string;
  }> = [
    {
      id: "aug-31",
      bookingDate: localMidnight("2026-08-31"),
      amountNok: -1000,
      categoryId: "cat-food",
      accountId: "acc-main",
      merchant: "Rema 1000",
      normalizedMerchant: "rema 1000",
    },
    {
      id: "sep-01-local",
      bookingDate: localMidnight("2026-09-01"),
      amountNok: -100.1,
      categoryId: "cat-food",
      accountId: "acc-main",
      merchant: "Rema 1000",
      normalizedMerchant: "rema 1000",
    },
    {
      id: "sep-01-utc",
      bookingDate: new Date(Date.UTC(2026, 8, 1)),
      amountNok: -50.2,
      categoryId: "cat-food",
      accountId: "acc-card",
      merchant: "KIWI Majorstuen",
      normalizedMerchant: "kiwi majorstuen",
    },
    {
      id: "sep-10-refund",
      bookingDate: localMidnight("2026-09-10"),
      amountNok: 40,
      categoryId: "cat-food",
      accountId: "acc-main",
      merchant: "Rema 1000",
      normalizedMerchant: "rema 1000",
    },
    {
      id: "sep-15-uncategorized",
      bookingDate: localMidnight("2026-09-15"),
      amountNok: -200,
      categoryId: null,
      accountId: "acc-main",
      merchant: "KIWI Majorstuen",
      normalizedMerchant: "kiwi majorstuen",
    },
    {
      id: "sep-15-transfer",
      bookingDate: localMidnight("2026-09-15"),
      amountNok: -5000,
      categoryId: "cat-transfer",
      accountId: "acc-main",
      merchant: "Sparekonto",
      normalizedMerchant: "sparekonto",
    },
    {
      id: "sep-20-salary",
      bookingDate: localMidnight("2026-09-20"),
      amountNok: 30000,
      categoryId: "cat-salary",
      accountId: "acc-main",
      merchant: "Arbeidsgiver AS",
      normalizedMerchant: "arbeidsgiver as",
    },
    {
      id: "sep-30",
      bookingDate: localMidnight("2026-09-30"),
      amountNok: -0.3,
      categoryId: "cat-travel",
      accountId: "acc-card",
      merchant: null,
      normalizedMerchant: "",
    },
    {
      id: "oct-01",
      bookingDate: localMidnight("2026-10-01"),
      amountNok: -999,
      categoryId: "cat-travel",
      accountId: "acc-card",
      merchant: "Vy",
      normalizedMerchant: "vy",
    },
  ];
  for (const transaction of transactions) {
    await client.transaction.create({
      data: { ...transaction, currency: "NOK" },
    });
  }
}
