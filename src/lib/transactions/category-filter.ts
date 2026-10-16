import type { Prisma } from "@prisma/client";

/** Category filter value meaning "transactions with no category". */
export const UNCATEGORIZED_VALUE = "__uncategorized__";

export function categoryFilterWhere(
  categoryIds: readonly string[],
): Prisma.TransactionWhereInput {
  const realIds = categoryIds.filter((id) => id !== UNCATEGORIZED_VALUE);
  const includesUncategorized = realIds.length < categoryIds.length;
  const inRealIds = { categoryId: { in: realIds } };

  if (!includesUncategorized) {
    return realIds.length > 0 ? inRealIds : {};
  }
  if (realIds.length === 0) {
    return { categoryId: null };
  }
  return { OR: [inRealIds, { categoryId: null }] };
}
