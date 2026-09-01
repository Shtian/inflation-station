import { PaymentType } from "@prisma/client";
import { z } from "zod";
import type { TransactionListRow } from "./list";
import {
  MAX_TRANSACTION_NOTE_LENGTH,
  MAX_TRANSACTION_NOTE_LENGTH_MESSAGE,
} from "./note";

type DecimalLike = { toString(): string } | number;

type TransactionCreateRecord = {
  id: string;
  accountId: string;
  account: {
    name: string;
  };
  categoryId: string | null;
  category: {
    name: string;
  } | null;
  bookingDate: Date;
  amountNok: DecimalLike;
  currency: string;
  normalizedMerchant: string;
  merchant: string | null;
  paymentType: PaymentType;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TransactionCreateDbClient = {
  transaction: {
    create(args: {
      data: {
        accountId: string;
        bookingDate: Date;
        amountNok: number;
        merchant: string;
        normalizedMerchant: string;
        currency: string;
        paymentType: PaymentType;
        categoryId?: string;
        note?: string;
      };
      select: {
        id: true;
        accountId: true;
        account: {
          select: {
            name: true;
          };
        };
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
        merchant: true;
        paymentType: true;
        note: true;
        createdAt: true;
        updatedAt: true;
      };
    }): Promise<TransactionCreateRecord>;
  };
};

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

const transactionCreatePayloadSchema = z
  .object({
    accountId: z.string().trim().min(1),
    bookingDate: bookingDateSchema,
    amountNok: z.number().finite(),
    merchant: z.string().trim().min(1),
    paymentType: z.nativeEnum(PaymentType),
    categoryId: z.string().trim().min(1).optional(),
    note: z
      .string()
      .max(MAX_TRANSACTION_NOTE_LENGTH, MAX_TRANSACTION_NOTE_LENGTH_MESSAGE)
      .optional(),
  })
  .strict();

export type TransactionCreatePayload = z.infer<
  typeof transactionCreatePayloadSchema
>;

function toNumber(value: DecimalLike): number {
  return Number.parseFloat(value.toString());
}

function toTransactionListRow(
  record: TransactionCreateRecord,
): TransactionListRow {
  return {
    id: record.id,
    accountId: record.accountId,
    accountName: record.account.name,
    categoryId: record.categoryId,
    categoryName: record.category?.name ?? null,
    bookingDate: record.bookingDate.toISOString().slice(0, 10),
    amountNok: toNumber(record.amountNok),
    currency: record.currency,
    normalizedMerchant: record.normalizedMerchant,
    merchant: record.merchant,
    paymentType: record.paymentType,
    note: record.note,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function parseTransactionCreatePayload(payload: unknown) {
  return transactionCreatePayloadSchema.safeParse(payload);
}

export async function createTransaction(
  db: TransactionCreateDbClient,
  payload: TransactionCreatePayload,
): Promise<TransactionListRow> {
  const transaction = await db.transaction.create({
    data: {
      accountId: payload.accountId,
      bookingDate: payload.bookingDate,
      amountNok: payload.amountNok,
      merchant: payload.merchant.trim(),
      normalizedMerchant: payload.merchant.trim().toLowerCase(),
      currency: "NOK",
      paymentType: payload.paymentType,
      ...(payload.categoryId !== undefined
        ? { categoryId: payload.categoryId }
        : {}),
      ...(payload.note !== undefined ? { note: payload.note } : {}),
    },
    select: {
      id: true,
      accountId: true,
      account: {
        select: {
          name: true,
        },
      },
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
      merchant: true,
      paymentType: true,
      note: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return toTransactionListRow(transaction);
}
