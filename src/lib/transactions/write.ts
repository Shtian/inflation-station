import { PaymentType, type Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { parseIsoDate } from "../iso-date";
import { toMerchantColumns } from "./merchant";
import {
  MAX_TRANSACTION_NOTE_LENGTH,
  MAX_TRANSACTION_NOTE_LENGTH_MESSAGE,
} from "./note";

const TRANSACTION_CURRENCY = "NOK";

const TRANSACTION_WRITE_SELECT = {
  id: true,
} satisfies Prisma.TransactionSelect;

export type TransactionWriteResult = Prisma.TransactionGetPayload<{
  select: typeof TRANSACTION_WRITE_SELECT;
}>;

type TransactionWriteDb = {
  transaction: {
    create(args: {
      data: Prisma.TransactionUncheckedCreateInput;
      select: typeof TRANSACTION_WRITE_SELECT;
    }): Promise<TransactionWriteResult>;
    update(args: {
      where: { id: string };
      data: Prisma.TransactionUncheckedUpdateInput;
      select: typeof TRANSACTION_WRITE_SELECT;
    }): Promise<TransactionWriteResult>;
  };
};

function normalizeNote(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function nullWhenAbsent<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

const bookingDateSchema = z
  .string()
  .trim()
  .refine((value) => parseIsoDate(value) !== null, {
    message: "bookingDate må ha formatet ÅÅÅÅ-MM-DD.",
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
  "tripId",
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
    tripId: z.string().trim().min(1).nullable().optional(),
    id: z.never().optional(),
    accountId: z.never().optional(),
    createdAt: z.never().optional(),
    updatedAt: z.never().optional(),
  })
  .strict()
  .refine(
    (value) => MUTABLE_FIELD_KEYS.some((key) => value[key] !== undefined),
    {
      message: "Minst ett felt som kan endres, må oppgis.",
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
): Promise<TransactionWriteResult> {
  return db.transaction.create({
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
    select: TRANSACTION_WRITE_SELECT,
  });
}

export async function updateTransaction(
  db: TransactionWriteDb,
  params: {
    transactionId: string;
    updates: TransactionUpdateIntent;
  },
): Promise<TransactionWriteResult> {
  // Prisma reads `undefined` in `data` as "leave this column alone".
  return db.transaction.update({
    where: { id: params.transactionId },
    data: {
      categoryId: params.updates.categoryId,
      bookingDate: params.updates.bookingDate,
      amountNok: params.updates.amountNok,
      paymentType: params.updates.paymentType,
      note: params.updates.note,
      tripId: params.updates.tripId,
      ...params.updates.merchant,
    },
    select: TRANSACTION_WRITE_SELECT,
  });
}

export type MissingUpdateReference = "trip" | "category";

/**
 * SQLite reports a foreign-key failure (P2003) without naming the column, so
 * after one the caller asks which reference the update wrote that is gone.
 */
export async function findMissingUpdateReference(
  db: Pick<PrismaClient, "trip">,
  updates: Pick<TransactionUpdateIntent, "tripId">,
): Promise<MissingUpdateReference> {
  if (typeof updates.tripId !== "string") {
    return "category";
  }

  const trip = await db.trip.findUnique({
    where: { id: updates.tripId },
    select: { id: true },
  });

  return trip ? "category" : "trip";
}
