import { PaymentType, type Prisma } from "@prisma/client";
import { z } from "zod";
import { toMerchantColumns } from "./merchant";
import {
  MAX_TRANSACTION_NOTE_LENGTH,
  MAX_TRANSACTION_NOTE_LENGTH_MESSAGE,
} from "./note";
import {
  TRANSACTION_ROW_SELECT,
  type TransactionRow,
  type TransactionRowRecord,
  toTransactionRow,
} from "./row";

const TRANSACTION_CURRENCY = "NOK";

type TransactionWriteDb = {
  transaction: {
    create(args: {
      data: Prisma.TransactionUncheckedCreateInput;
      select: typeof TRANSACTION_ROW_SELECT;
    }): Promise<TransactionRowRecord>;
    update(args: {
      where: { id: string };
      data: Prisma.TransactionUncheckedUpdateInput;
      select: typeof TRANSACTION_ROW_SELECT;
    }): Promise<TransactionRowRecord>;
  };
};

function normalizeNote(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function nullWhenAbsent<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

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

const merchantSchema = z.string().trim().min(1).transform(toMerchantColumns);

const noteTextSchema = z
  .string()
  .transform(normalizeNote)
  .refine(
    (value) => value === null || value.length <= MAX_TRANSACTION_NOTE_LENGTH,
    MAX_TRANSACTION_NOTE_LENGTH_MESSAGE,
  );

const MUTABLE_FIELD_KEYS = [
  "categoryId",
  "bookingDate",
  "amountNok",
  "merchant",
  "paymentType",
  "note",
] as const;

const transactionCreateSchema = z
  .object({
    accountId: z.string().trim().min(1),
    bookingDate: bookingDateSchema,
    amountNok: z.number().finite(),
    merchant: merchantSchema,
    paymentType: z.nativeEnum(PaymentType),
    categoryId: z.string().trim().min(1).optional(),
    note: noteTextSchema.nullish().transform(nullWhenAbsent),
  })
  .strict();

const transactionUpdateSchema = z
  .object({
    categoryId: z.string().trim().min(1).nullable().optional(),
    bookingDate: bookingDateSchema.optional(),
    amountNok: z.number().finite().optional(),
    merchant: merchantSchema.optional(),
    paymentType: z.nativeEnum(PaymentType).optional(),
    note: noteTextSchema.nullable().optional(),
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

export type TransactionCreateIntent = z.infer<typeof transactionCreateSchema>;

export type TransactionUpdateIntent = z.infer<typeof transactionUpdateSchema>;

export function parseTransactionCreatePayload(
  payload: unknown,
): z.ZodSafeParseResult<TransactionCreateIntent> {
  return transactionCreateSchema.safeParse(payload);
}

export function parseTransactionUpdatePayload(
  payload: unknown,
): z.ZodSafeParseResult<TransactionUpdateIntent> {
  return transactionUpdateSchema.safeParse(payload);
}

export async function createTransaction(
  db: TransactionWriteDb,
  intent: TransactionCreateIntent,
): Promise<TransactionRow> {
  const record = await db.transaction.create({
    data: {
      accountId: intent.accountId,
      bookingDate: intent.bookingDate,
      amountNok: intent.amountNok,
      currency: TRANSACTION_CURRENCY,
      paymentType: intent.paymentType,
      categoryId: intent.categoryId,
      note: intent.note,
      ...intent.merchant,
    },
    select: TRANSACTION_ROW_SELECT,
  });

  return toTransactionRow(record);
}

export async function updateTransaction(
  db: TransactionWriteDb,
  params: {
    transactionId: string;
    updates: TransactionUpdateIntent;
  },
): Promise<TransactionRow> {
  // Prisma reads `undefined` in `data` as "leave this column alone".
  const record = await db.transaction.update({
    where: { id: params.transactionId },
    data: {
      currency: TRANSACTION_CURRENCY,
      categoryId: params.updates.categoryId,
      bookingDate: params.updates.bookingDate,
      amountNok: params.updates.amountNok,
      paymentType: params.updates.paymentType,
      note: params.updates.note,
      ...params.updates.merchant,
    },
    select: TRANSACTION_ROW_SELECT,
  });

  return toTransactionRow(record);
}
