import type { PaymentType } from "@prisma/client";
import { normalizeImportMerchant } from "./normalization";
import { buildTransactionFingerprint } from "./transaction-dedupe";

export type SubmitImportReviewSummary = {
  imported: number;
  potentialDuplicates: number;
  invalid: number;
  skipped: number;
};

export type SubmitImportReviewResult = {
  summary: SubmitImportReviewSummary;
};

export class ImportReviewSessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Import review session ${sessionId} not found`);
    this.name = "ImportReviewSessionNotFoundError";
  }
}

export class InvalidImportReviewCategoryError extends Error {
  readonly categoryIds: string[];

  constructor(categoryIds: string[]) {
    super("One or more selected categories are invalid for this account.");
    this.name = "InvalidImportReviewCategoryError";
    this.categoryIds = categoryIds;
  }
}

type ImportReviewSubmitSession = {
  id: string;
  accountId: string;
  rows: Array<{
    id: string;
    rowNumber: number;
    bookingDate: Date;
    amountNok: { toString(): string } | number;
    currency: string;
    normalizedMerchant: string;
    paymentType: PaymentType;
    sender: string;
    recipient: string;
    name: string;
    title: string;
    categoryId: string | null;
  }>;
};

type ExistingTransactionFingerprintSource = {
  bookingDate: Date;
  amountNok: { toString(): string } | number;
  normalizedMerchant: string;
  paymentType: PaymentType;
};

type ImportReviewSubmitDbClient = {
  importReviewSession: {
    findUnique(args: {
      where: { id: string };
      select: {
        id: true;
        accountId: true;
        rows: {
          select: {
            id: true;
            rowNumber: true;
            bookingDate: true;
            amountNok: true;
            currency: true;
            normalizedMerchant: true;
            paymentType: true;
            sender: true;
            recipient: true;
            name: true;
            title: true;
            categoryId: true;
          };
          orderBy: {
            rowNumber: "asc";
          };
        };
      };
    }): Promise<ImportReviewSubmitSession | null>;
    delete(args: { where: { id: string } }): Promise<{ id: string }>;
  };
  category: {
    findMany(args: {
      where: {
        id: { in: string[] };
        OR: Array<{ accountId: string } | { accountId: null }>;
      };
      select: { id: true };
    }): Promise<Array<{ id: string }>>;
  };
  transaction: {
    findMany(args: {
      where: { accountId: string };
      select: {
        bookingDate: true;
        amountNok: true;
        normalizedMerchant: true;
        paymentType: true;
      };
    }): Promise<ExistingTransactionFingerprintSource[]>;
    createMany(args: {
      data: Array<{
        accountId: string;
        categoryId: string | null;
        bookingDate: Date;
        amountNok: number;
        currency: "NOK";
        normalizedMerchant: string;
        paymentType: PaymentType;
        note: string | null;
      }>;
    }): Promise<{ count: number }>;
  };
};

type SubmitReviewRow = {
  rowId: string;
  categoryId: string | null;
  selectedMessage: string;
  note?: string | null;
};

function toNormalizedInvalidCount(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function buildExistingFingerprints(
  accountId: string,
  transactions: ExistingTransactionFingerprintSource[],
): Set<string> {
  return new Set(
    transactions.map((transaction) =>
      buildTransactionFingerprint({
        accountId,
        bookingDate: transaction.bookingDate.toISOString().slice(0, 10),
        amountNok: Number.parseFloat(transaction.amountNok.toString()),
        normalizedMerchant: transaction.normalizedMerchant,
        paymentType: transaction.paymentType,
      }),
    ),
  );
}

export async function submitImportReview(
  db: ImportReviewSubmitDbClient,
  params: {
    sessionId: string;
    rows: SubmitReviewRow[];
    invalidCount: number;
  },
): Promise<SubmitImportReviewResult> {
  const session = await db.importReviewSession.findUnique({
    where: {
      id: params.sessionId,
    },
    select: {
      id: true,
      accountId: true,
      rows: {
        select: {
          id: true,
          rowNumber: true,
          bookingDate: true,
          amountNok: true,
          currency: true,
          normalizedMerchant: true,
          paymentType: true,
          sender: true,
          recipient: true,
          name: true,
          title: true,
          categoryId: true,
        },
        orderBy: {
          rowNumber: "asc",
        },
      },
    },
  });

  if (!session) {
    throw new ImportReviewSessionNotFoundError(params.sessionId);
  }

  const categoryByRowId = params.rows.reduce<Record<string, string | null>>(
    (acc, row) => {
      acc[row.rowId] = row.categoryId;
      return acc;
    },
    {},
  );
  const selectedMessageByRowId = params.rows.reduce<Record<string, string>>(
    (acc, row) => {
      acc[row.rowId] = row.selectedMessage;
      return acc;
    },
    {},
  );
  const noteByRowId = params.rows.reduce<Record<string, string | null>>(
    (acc, row) => {
      acc[row.rowId] = row.note ?? null;
      return acc;
    },
    {},
  );

  const finalizedRows = session.rows.map((row) => {
    const selectedMessage =
      row.id in selectedMessageByRowId
        ? selectedMessageByRowId[row.id]
        : row.title;

    return {
      ...row,
      title: selectedMessage,
      normalizedMerchant: normalizeImportMerchant(row.name, selectedMessage),
      categoryId:
        row.id in categoryByRowId ? categoryByRowId[row.id] : row.categoryId,
      amountNok: Number.parseFloat(row.amountNok.toString()),
      note: row.id in noteByRowId ? noteByRowId[row.id] : null,
    };
  });

  const selectedCategoryIds = Array.from(
    new Set(
      finalizedRows
        .map((row) => row.categoryId)
        .filter(
          (categoryId): categoryId is string => typeof categoryId === "string",
        ),
    ),
  );

  if (selectedCategoryIds.length > 0) {
    const validCategories = await db.category.findMany({
      where: {
        id: { in: selectedCategoryIds },
        OR: [{ accountId: session.accountId }, { accountId: null }],
      },
      select: {
        id: true,
      },
    });

    const validCategoryIds = new Set(
      validCategories.map((category) => category.id),
    );
    const invalidCategoryIds = selectedCategoryIds.filter(
      (categoryId) => !validCategoryIds.has(categoryId),
    );

    if (invalidCategoryIds.length > 0) {
      throw new InvalidImportReviewCategoryError(invalidCategoryIds);
    }
  }

  const existingTransactions = await db.transaction.findMany({
    where: {
      accountId: session.accountId,
    },
    select: {
      bookingDate: true,
      amountNok: true,
      normalizedMerchant: true,
      paymentType: true,
    },
  });

  const existingFingerprints = buildExistingFingerprints(
    session.accountId,
    existingTransactions,
  );

  const uploadFingerprintCounts = finalizedRows.reduce((counts, row) => {
    const fingerprint = buildTransactionFingerprint({
      accountId: session.accountId,
      bookingDate: row.bookingDate.toISOString().slice(0, 10),
      amountNok: row.amountNok,
      normalizedMerchant: row.normalizedMerchant,
      paymentType: row.paymentType,
    });

    counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  const potentialDuplicates = finalizedRows.reduce((count, row) => {
    const fingerprint = buildTransactionFingerprint({
      accountId: session.accountId,
      bookingDate: row.bookingDate.toISOString().slice(0, 10),
      amountNok: row.amountNok,
      normalizedMerchant: row.normalizedMerchant,
      paymentType: row.paymentType,
    });

    if (
      existingFingerprints.has(fingerprint) ||
      (uploadFingerprintCounts.get(fingerprint) ?? 0) > 1
    ) {
      return count + 1;
    }

    return count;
  }, 0);

  const seenFingerprints = new Set(existingFingerprints);
  const rowsToInsert = finalizedRows.filter((row) => {
    const fingerprint = buildTransactionFingerprint({
      accountId: session.accountId,
      bookingDate: row.bookingDate.toISOString().slice(0, 10),
      amountNok: row.amountNok,
      normalizedMerchant: row.normalizedMerchant,
      paymentType: row.paymentType,
    });

    if (seenFingerprints.has(fingerprint)) {
      return false;
    }

    seenFingerprints.add(fingerprint);
    return true;
  });

  if (rowsToInsert.length > 0) {
    await db.transaction.createMany({
      data: rowsToInsert.map((row) => ({
        accountId: session.accountId,
        categoryId: row.categoryId,
        bookingDate: row.bookingDate,
        amountNok: row.amountNok,
        currency: "NOK",
        normalizedMerchant: row.normalizedMerchant,
        paymentType: row.paymentType,
        note: row.note,
      })),
    });
  }

  await db.importReviewSession.delete({
    where: {
      id: session.id,
    },
  });

  return {
    summary: {
      imported: rowsToInsert.length,
      potentialDuplicates,
      invalid: toNormalizedInvalidCount(params.invalidCount),
      skipped: finalizedRows.length - rowsToInsert.length,
    },
  };
}
