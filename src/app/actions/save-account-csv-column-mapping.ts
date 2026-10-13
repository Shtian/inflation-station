"use server";

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  columnMappingFitsHeaders,
  parseColumnMapping,
  toCsvHeaderSignature,
} from "@/lib/import/csv/column-mapping";
import { prisma } from "@/lib/prisma";
import {
  executeServerMutation,
  type MutationActionResult,
  mutationError,
  mutationValidationError,
} from "@/lib/server-actions/mutation-result";

const saveAccountCsvColumnMappingInputSchema = z.object({
  accountId: z.string().trim().min(1),
  headers: z.array(z.string()).min(1),
  mapping: z.unknown(),
});

type SaveAccountCsvColumnMappingErrorCode =
  | "INVALID_CSV_COLUMN_MAPPING_PAYLOAD"
  | "INVALID_CSV_COLUMN_MAPPING"
  | "ACCOUNT_NOT_FOUND"
  | "CSV_COLUMN_MAPPING_SAVE_FAILED";

type SaveAccountCsvColumnMappingResponse = {
  accountId: string;
  csvHeaderSignature: string;
};

function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2025"
  );
}

export async function saveAccountCsvColumnMappingAction(
  input: unknown,
): Promise<
  MutationActionResult<
    SaveAccountCsvColumnMappingResponse,
    SaveAccountCsvColumnMappingErrorCode
  >
> {
  const parsedInput = saveAccountCsvColumnMappingInputSchema.safeParse(input);

  if (!parsedInput.success) {
    return mutationValidationError(
      "INVALID_CSV_COLUMN_MAPPING_PAYLOAD",
      "Forventet accountId, filens kolonneoverskrifter og en kolonnekobling.",
      parsedInput.error,
    );
  }

  const { accountId, headers } = parsedInput.data;
  const mapping = parseColumnMapping(parsedInput.data.mapping);

  if (!mapping || !columnMappingFitsHeaders(mapping, headers)) {
    return mutationError(
      "INVALID_CSV_COLUMN_MAPPING",
      "Velg en datokolonne, et beløp og minst én beskrivelseskolonne fra denne filen.",
    );
  }

  const csvHeaderSignature = toCsvHeaderSignature(headers);

  return executeServerMutation({
    execute: async () => {
      await prisma.account.update({
        where: { id: accountId },
        data: {
          csvColumnMapping: mapping as Prisma.InputJsonObject,
          csvHeaderSignature,
        },
      });

      return { accountId, csvHeaderSignature };
    },
    mapError: (error) =>
      isRecordNotFound(error)
        ? { code: "ACCOUNT_NOT_FOUND", message: "Fant ikke kontoen." }
        : null,
    fallbackError: {
      code: "CSV_COLUMN_MAPPING_SAVE_FAILED",
      message: "Kunne ikke lagre kolonnekoblingen for denne kontoen.",
    },
  });
}
