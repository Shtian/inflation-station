import type { CategoryKind } from "@prisma/client";

export function inferCategoryKind(amountNok: number | null): CategoryKind {
  if (amountNok !== null && amountNok > 0) {
    return "INCOME";
  }

  return "EXPENSE";
}
