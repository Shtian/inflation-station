import type { PaymentType } from "@prisma/client";
import { normalizeImportMerchant } from "./normalization";

export type SubmitImportReviewSummary = {
  imported: number;
  invalid: number;
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
    createMany(args: {
      data: Array<{
        accountId: string;
        categoryId: string | null;
        bookingDate: Date;
        amountNok: number;
        currency: "NOK";
        normalizedMerchant: string;
        merchant: string;
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

  const { count } =
    finalizedRows.length > 0
      ? await db.transaction.createMany({
          data: finalizedRows.map((row) => ({
            accountId: session.accountId,
            categoryId: row.categoryId,
            bookingDate: row.bookingDate,
            amountNok: row.amountNok,
            currency: "NOK",
            normalizedMerchant: row.normalizedMerchant,
            merchant: row.title,
            paymentType: row.paymentType,
            note: row.note,
          })),
        })
      : { count: 0 };

  await db.importReviewSession.delete({
    where: {
      id: session.id,
    },
  });

  return {
    summary: {
      imported: count,
      invalid: toNormalizedInvalidCount(params.invalidCount),
    },
  };
}
