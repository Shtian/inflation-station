import { PaymentType } from "@prisma/client";
import { z } from "zod";
import type { TransactionListRow } from "./list";

type DecimalLike = { toString(): string } | number;

type TransactionUpdateRecord = {
  id: string;
  accountId: string;
  categoryId: string | null;
  category: {
    name: string;
  } | null;
  bookingDate: Date;
  amountNok: DecimalLike;
  currency: string;
  normalizedMerchant: string;
  paymentType: PaymentType;
  createdAt: Date;
  updatedAt: Date;
};

type TransactionUpdateDbClient = {
  transaction: {
    update(args: {
      where: { id: string };
      data: {
        categoryId?: string | null;
        bookingDate?: Date;
        amountNok?: number;
        currency: string;
        normalizedMerchant?: string;
        paymentType?: PaymentType;
      };
      select: {
        id: true;
        accountId: true;
        categoryId: true;
        category: {
          select: {
            name: true;
          };
        };
        bookingDate: true;
        amountNok: true;
        currency: true;
        normalizedMerchant: true;
        paymentType: true;
        createdAt: true;
        updatedAt: true;
      };
    }): Promise<TransactionUpdateRecord>;
  };
};

const MUTABLE_FIELD_KEYS = [
  "categoryId",
  "bookingDate",
  "amountNok",
  "normalizedMerchant",
  "paymentType",
] as const;

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const yearNumber = Number.parseInt(year, 10);
  const monthNumber = Number.parseInt(month, 10);
  const dayNumber = Number.parseInt(day, 10);
  const parsed = new Date(
    Date.UTC(yearNumber, monthNumber - 1, dayNumber, 0, 0, 0, 0),
  );

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== yearNumber ||
    parsed.getUTCMonth() !== monthNumber - 1 ||
    parsed.getUTCDate() !== dayNumber
  ) {
    return null;
  }

  return parsed;
}

const bookingDateSchema = z
  .string()
  .trim()
  .refine((value) => parseIsoDate(value) !== null, {
    message: "Expected bookingDate in YYYY-MM-DD format.",
  })
  .transform((value) => parseIsoDate(value) as Date);

const transactionUpdatePayloadSchema = z
  .object({
    categoryId: z.string().trim().min(1).nullable().optional(),
    bookingDate: bookingDateSchema.optional(),
    amountNok: z.number().finite().optional(),
    normalizedMerchant: z.string().trim().min(1).optional(),
    paymentType: z.nativeEnum(PaymentType).optional(),
    id: z.never().optional(),
    accountId: z.never().optional(),
    createdAt: z.never().optional(),
    updatedAt: z.never().optional(),
  })
  .strict()
  .refine(
    (value) => MUTABLE_FIELD_KEYS.some((key) => value[key] !== undefined),
    {
      message: "At least one mutable field must be provided.",
    },
  );

export type TransactionUpdatePayload = z.infer<
  typeof transactionUpdatePayloadSchema
>;

function toNumber(value: DecimalLike): number {
  return Number.parseFloat(value.toString());
}

function toTransactionListRow(
  record: TransactionUpdateRecord,
): TransactionListRow {
  return {
    id: record.id,
    accountId: record.accountId,
    categoryId: record.categoryId,
    categoryName: record.category?.name ?? null,
    bookingDate: record.bookingDate.toISOString().slice(0, 10),
    amountNok: toNumber(record.amountNok),
    currency: record.currency,
    normalizedMerchant: record.normalizedMerchant,
    paymentType: record.paymentType,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function parseTransactionUpdatePayload(payload: unknown) {
  return transactionUpdatePayloadSchema.safeParse(payload);
}

export async function updateTransaction(
  db: TransactionUpdateDbClient,
  params: {
    transactionId: string;
    updates: TransactionUpdatePayload;
  },
): Promise<TransactionListRow> {
  const transaction = await db.transaction.update({
    where: { id: params.transactionId },
    data: {
      currency: "NOK",
      ...(params.updates.categoryId !== undefined
        ? { categoryId: params.updates.categoryId }
        : {}),
      ...(params.updates.bookingDate !== undefined
        ? { bookingDate: params.updates.bookingDate }
        : {}),
      ...(params.updates.amountNok !== undefined
        ? { amountNok: params.updates.amountNok }
        : {}),
      ...(params.updates.normalizedMerchant !== undefined
        ? { normalizedMerchant: params.updates.normalizedMerchant }
        : {}),
      ...(params.updates.paymentType !== undefined
        ? { paymentType: params.updates.paymentType }
        : {}),
    },
    select: {
      id: true,
      accountId: true,
      categoryId: true,
      category: {
        select: {
          name: true,
        },
      },
      bookingDate: true,
      amountNok: true,
      currency: true,
      normalizedMerchant: true,
      paymentType: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return toTransactionListRow(transaction);
}
