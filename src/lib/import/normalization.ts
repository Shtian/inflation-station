import { PaymentType } from "@prisma/client";
import { normalizeMerchantKey } from "@/lib/transactions/merchant";

export function normalizeImportToken(value: string): string {
  return normalizeMerchantKey(value);
}

export function normalizeImportPaymentType(value: string): PaymentType {
  const normalized = normalizeImportToken(value);

  if (
    ["kort", "card", "debitkort", "debit", "kortkjop", "kortkjoep"].includes(
      normalized,
    )
  ) {
    return PaymentType.CARD;
  }

  if (
    ["overforing", "overfoering", "transfer", "bankoverforing"].includes(
      normalized,
    )
  ) {
    return PaymentType.TRANSFER;
  }

  if (
    ["eft", "giro", "avtalegiro", "efaktura", "e faktura"].includes(normalized)
  ) {
    return PaymentType.EFT;
  }

  if (["cash", "kontant"].includes(normalized)) {
    return PaymentType.CASH;
  }

  return PaymentType.OTHER;
}

export function normalizeImportMerchant(name: string, title: string): string {
  return normalizeImportToken([name, title].join(" "));
}
