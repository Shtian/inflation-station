export function isTransfer(transaction: {
  category: { kind: string } | null;
}): boolean {
  return transaction.category?.kind === "TRANSFER";
}
