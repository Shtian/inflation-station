type TransactionDeleteOneDbClient = {
  transaction: {
    delete(args: { where: { id: string } }): Promise<{
      id: string;
    }>;
  };
};

type TransactionDeleteManyDbClient = {
  transaction: {
    deleteMany(args: {
      where: { id: { in: string[] } };
    }): Promise<{ count: number }>;
  };
};

export async function deleteTransaction(
  db: TransactionDeleteOneDbClient,
  transactionId: string,
): Promise<void> {
  await db.transaction.delete({
    where: { id: transactionId },
  });
}

export async function deleteTransactions(
  db: TransactionDeleteManyDbClient,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) {
    throw new Error("ids must be a non-empty array");
  }

  const result = await db.transaction.deleteMany({
    where: { id: { in: ids } },
  });

  return result.count;
}
