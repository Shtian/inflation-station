type TransactionDeleteDbClient = {
  transaction: {
    delete(args: { where: { id: string } }): Promise<{
      id: string;
    }>;
  };
};

export async function deleteTransaction(
  db: TransactionDeleteDbClient,
  transactionId: string,
): Promise<void> {
  await db.transaction.delete({
    where: { id: transactionId },
  });
}
