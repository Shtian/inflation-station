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

export class DuplicateImportReviewRowDecisionError extends Error {
  readonly rowIds: string[];

  constructor(rowIds: string[]) {
    super(
      `Duplicate decisions were submitted for the same staged row: ${rowIds.join(", ")}`,
    );
    this.name = "DuplicateImportReviewRowDecisionError";
    this.rowIds = rowIds;
  }
}

export class UnknownImportReviewRowDecisionError extends Error {
  readonly rowIds: string[];

  constructor(rowIds: string[]) {
    super(
      `Submitted row IDs do not belong to this review session: ${rowIds.join(", ")}`,
    );
    this.name = "UnknownImportReviewRowDecisionError";
    this.rowIds = rowIds;
  }
}

type ImportReviewSubmitSessionRow = {
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
};

type ImportReviewSubmitSession = {
  id: string;
  accountId: string;
  invalidCount: number;
  rows: ImportReviewSubmitSessionRow[];
};

type ImportReviewSubmitTxClient = {
  importReviewSession: {
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
  category: {
    findMany(args: {
      where: {
        id: { in: string[] };
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

type ImportReviewSubmitDbClient = {
  $transaction<T>(
    fn: (tx: ImportReviewSubmitTxClient) => Promise<T>,
  ): Promise<T>;
};

type SubmitReviewRow = {
  rowId: string;
  categoryId: string | null;
  selectedMessage: string;
  note?: string | null;
};

function findDuplicateRowIds(rowIds: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const rowId of rowIds) {
    if (seen.has(rowId)) {
      duplicates.add(rowId);
    }
    seen.add(rowId);
  }

  return Array.from(duplicates);
}

export async function submitImportReview(
  db: ImportReviewSubmitDbClient,
  params: {
    sessionId: string;
    rows: SubmitReviewRow[];
  },
): Promise<SubmitImportReviewResult> {
  return db.$transaction(async (tx) => {
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

    const submittedRowIds = params.rows.map((row) => row.rowId);
    const duplicateRowIds = findDuplicateRowIds(submittedRowIds);
    if (duplicateRowIds.length > 0) {
      throw new DuplicateImportReviewRowDecisionError(duplicateRowIds);
    }

    const sessionRowIds = new Set(session.rows.map((row) => row.id));
    const unknownRowIds = submittedRowIds.filter(
      (rowId) => !sessionRowIds.has(rowId),
    );
    if (unknownRowIds.length > 0) {
      throw new UnknownImportReviewRowDecisionError(unknownRowIds);
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

    const submittedRowIdSet = new Set(submittedRowIds);
    const finalizedRows = session.rows
      .filter((row) => submittedRowIdSet.has(row.id))
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

    return {
      summary: {
        imported: count,
        invalid: session.invalidCount,
      },
    };
  });
}
