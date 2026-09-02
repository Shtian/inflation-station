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
  invalidCount: number;
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

type ImportReviewSubmitSessionClient = {
  findUnique(args: {
    where: { id: string };
    select: {
      id: true;
      accountId: true;
      invalidCount: true;
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

type ImportReviewSubmitCategoryClient = {
  findMany(args: {
    where: {
      id: { in: string[] };
    };
    select: { id: true };
  }): Promise<Array<{ id: string }>>;
};

type ImportReviewSubmitTransactionRecordClient = {
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

type ImportReviewSubmitDbClient = {
  importReviewSession: ImportReviewSubmitSessionClient;
  category: ImportReviewSubmitCategoryClient;
  transaction: ImportReviewSubmitTransactionRecordClient;
  $transaction<T>(
    fn: (tx: ImportReviewSubmitTransactionClient) => Promise<T>,
  ): Promise<T>;
};

/**
 * The subset of the db client's session/category/transaction operations
 * available inside the atomic consume transaction. Structurally identical to
 * the outer client's shapes - Prisma's transaction client (`tx`) exposes the
 * same model API as the top-level client.
 */
type ImportReviewSubmitTransactionClient = {
  importReviewSession: ImportReviewSubmitSessionClient;
  category: ImportReviewSubmitCategoryClient;
  transaction: ImportReviewSubmitTransactionRecordClient;
};

type SubmitReviewRow = {
  rowId: string;
  categoryId: string | null;
  selectedMessage: string;
  note?: string | null;
};

/**
 * Defensive floor/guard against a malformed `invalidCount`. The value is now
 * sourced entirely from server-owned session state (never from caller
 * input), so this is no longer defending against an untrusted client - it's
 * cheap insurance against the field ending up negative or non-finite via a
 * future bug or manual db edit, and it keeps the summary contract (a
 * non-negative integer) honest regardless of where the number came from.
 */
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
  },
): Promise<SubmitImportReviewResult> {
  const { count, invalidCount } = await db.$transaction(async (tx) => {
    const session = await tx.importReviewSession.findUnique({
      where: {
        id: params.sessionId,
      },
      select: {
        id: true,
        accountId: true,
        invalidCount: true,
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

    const submittedRowIds = new Set(params.rows.map((r) => r.rowId));
    const finalizedRows = session.rows
      .filter((row) => submittedRowIds.has(row.id))
      .map((row) => {
        const selectedMessage =
          row.id in selectedMessageByRowId
            ? selectedMessageByRowId[row.id]
            : row.title;

        return {
          ...row,
          title: selectedMessage,
          normalizedMerchant: normalizeImportMerchant(
            row.name,
            selectedMessage,
          ),
          categoryId:
            row.id in categoryByRowId
              ? categoryByRowId[row.id]
              : row.categoryId,
          amountNok: Number.parseFloat(row.amountNok.toString()),
          note: row.id in noteByRowId ? noteByRowId[row.id] : null,
        };
      });

    const selectedCategoryIds = Array.from(
      new Set(
        finalizedRows
          .map((row) => row.categoryId)
          .filter(
            (categoryId): categoryId is string =>
              typeof categoryId === "string",
          ),
      ),
    );

    if (selectedCategoryIds.length > 0) {
      const validCategories = await tx.category.findMany({
        where: {
          id: { in: selectedCategoryIds },
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
        ? await tx.transaction.createMany({
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

    await tx.importReviewSession.delete({
      where: {
        id: session.id,
      },
    });

    return { count, invalidCount: session.invalidCount };
  });

  return {
    summary: {
      imported: count,
      invalid: toNormalizedInvalidCount(invalidCount),
    },
  };
}
