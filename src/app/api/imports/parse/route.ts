import { NextResponse } from "next/server";
import {
  type ColumnMapping,
  type ColumnMappingGuess,
  columnMappingFitsHeaders,
  parseColumnMapping,
} from "@/lib/import/csv/column-mapping";
import type { TokenizedCsvRow } from "@/lib/import/csv/csv-statement";
import {
  COLUMN_MAPPING_SAMPLE_ROWS,
  guessColumnMapping,
  resolveSavedColumnMapping,
  savedColumnMappingGuess,
} from "@/lib/import/csv/guess-column-mapping";
import {
  type CsvTable,
  parseMappedCsv,
  readCsvTable,
} from "@/lib/import/csv/parse-mapped-csv";
import type { CsvParserResult } from "@/lib/import/csv-parser";
import {
  planCleanupChunks,
  toCleanupCandidates,
} from "@/lib/import/message-cleanup/plan";
import type { CleanupDisabledReason } from "@/lib/import/message-cleanup/reasons";
import { extractStatementItems } from "@/lib/import/pdf/extract-items";
import {
  detectPdfStatementExtractor,
  PDF_STATEMENT_EXTRACTORS,
} from "@/lib/import/pdf/registry";
import {
  type StatementReconciliation,
  statementDriftNok,
} from "@/lib/import/pdf/statement-items";
import { stageParsedImportRows } from "@/lib/import/review-stage";
import { prisma } from "@/lib/prisma";

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];

type ParseImportSource =
  | { kind: "csv"; content: string }
  | { kind: "pdf"; bytes: Uint8Array };

type ParseImportPayload = {
  accountId: string;
  source: ParseImportSource;
  /** Absent when the request carries none; null when it carries a malformed one. */
  columnMapping: ColumnMapping | null | undefined;
};

type PdfDetection = {
  state: "certain";
  providerId: string;
  providerName: string;
  score: number;
  matchedHeaders: string[];
  candidates: [];
};

/** What the column-mapping step needs to show, edit and preview a mapping. */
type CsvColumnMappingProposal = {
  headers: string[];
  sampleRows: TokenizedCsvRow[];
  guess: ColumnMappingGuess;
};

type ParseReconciliation = StatementReconciliation & { driftNok: number };

function badRequest(error: string, message: string) {
  return NextResponse.json({ error, message }, { status: 400 });
}

function resolveCleanupDisabledReason(): CleanupDisabledReason | null {
  const enabled =
    process.env.OPENAI_MESSAGE_CLEANUP_ENABLED?.trim().toLowerCase() !==
    "false";

  if (!enabled) {
    return "disabled";
  }

  return process.env.OPENAI_API_KEY?.trim() ? null : "key_missing";
}

// The mime type, the form field name and the filename are all client claims.
// The leading bytes are the only part of an upload the client cannot misreport.
function toUploadSource(bytes: Uint8Array): ParseImportSource {
  return PDF_SIGNATURE.every((byte, index) => bytes[index] === byte)
    ? { kind: "pdf", bytes }
    : { kind: "csv", content: new TextDecoder().decode(bytes) };
}

function sourceByteLength(source: ParseImportSource): number {
  return source.kind === "pdf"
    ? source.bytes.byteLength
    : Buffer.byteLength(source.content, "utf8");
}

function parseColumnMappingJson(value: string): ColumnMapping | null {
  try {
    return parseColumnMapping(JSON.parse(value));
  } catch {
    return null;
  }
}

async function parseImportPayload(
  request: Request,
): Promise<ParseImportPayload | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return null;
    }

    const accountId = formData.get("accountId");
    const file = formData.get("file");
    const columnMappingValue = formData.get("columnMapping");

    if (typeof accountId !== "string") {
      return null;
    }

    let source: ParseImportSource | null = null;

    if (file instanceof File) {
      source = toUploadSource(new Uint8Array(await file.arrayBuffer()));
    } else if (typeof file === "string") {
      source = { kind: "csv", content: file };
    } else {
      const content = formData.get("csvContent");
      source = typeof content === "string" ? { kind: "csv", content } : null;
    }

    if (source === null) {
      return null;
    }

    return {
      accountId,
      source,
      columnMapping:
        typeof columnMappingValue === "string"
          ? parseColumnMappingJson(columnMappingValue)
          : undefined,
    };
  }

  const payload = await request.json().catch(() => null);

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.accountId !== "string" ||
    typeof payload.csvContent !== "string"
  ) {
    return null;
  }

  return {
    accountId: payload.accountId,
    source: { kind: "csv", content: payload.csvContent },
    columnMapping:
      payload.columnMapping === undefined
        ? undefined
        : parseColumnMapping(payload.columnMapping),
  };
}

async function stageAndRespond(options: {
  accountId: string;
  parsed: CsvParserResult;
  reconciliation: StatementReconciliation | null;
  detection?: PdfDetection;
  columnMapping?: CsvColumnMappingProposal;
}) {
  const staged = await stageParsedImportRows(prisma, {
    accountId: options.accountId,
    parsed: options.parsed,
  });

  const cleanup = planCleanupChunks({
    sessionId: staged.review.sessionId ?? "",
    disabledReason: resolveCleanupDisabledReason(),
    candidates: toCleanupCandidates(staged.review.rows),
  });

  const reconciliation: ParseReconciliation | null = options.reconciliation && {
    ...options.reconciliation,
    driftNok: statementDriftNok(options.reconciliation),
  };

  return NextResponse.json({
    ...(options.detection ? { detection: options.detection } : {}),
    ...(options.columnMapping ? { columnMapping: options.columnMapping } : {}),
    summary: staged.summary,
    errors: staged.errors,
    review: staged.review,
    cleanup,
    reconciliation,
  });
}

async function parsePdfImport(accountId: string, bytes: Uint8Array) {
  const items = await extractStatementItems(bytes).catch(() => []);

  if (items.length === 0) {
    return badRequest(
      "PDF_TEXT_EXTRACTION_FAILED",
      "No text could be read from this PDF. A scanned or photographed statement carries only an image, so ask your provider for the PDF they generated.",
    );
  }

  const extractor = detectPdfStatementExtractor(items);

  if (!extractor) {
    const supported = PDF_STATEMENT_EXTRACTORS.map(
      (candidate) => candidate.providerName,
    ).join(", ");
    return badRequest(
      "PDF_PROVIDER_NOT_RECOGNIZED",
      `No supported card issuer was found in this PDF. Supported: ${supported}.`,
    );
  }

  const { parsed, reconciliation } = extractor.extract(items);

  if (parsed.rows.length === 0) {
    return badRequest(
      "PDF_NO_TRANSACTIONS_FOUND",
      `This PDF was read as a ${extractor.providerName} statement but holds no transactions.`,
    );
  }

  return stageAndRespond({
    accountId,
    detection: {
      state: "certain",
      providerId: extractor.providerId,
      providerName: extractor.providerName,
      score: 1,
      matchedHeaders: [],
      candidates: [],
    },
    parsed,
    reconciliation,
  });
}

async function parseCsvImport(options: {
  account: {
    id: string;
    csvColumnMapping: unknown;
    csvHeaderSignature: string | null;
  };
  table: CsvTable;
  columnMapping: ColumnMapping | null | undefined;
}) {
  const { account, table } = options;

  if (table.headers.length === 0) {
    return badRequest(
      "CSV_HEADERS_NOT_FOUND",
      "No header row was found in this CSV. The first non-blank line must name its columns.",
    );
  }

  if (options.columnMapping === null) {
    return badRequest(
      "INVALID_COLUMN_MAPPING",
      "The column mapping must name a date column, an amount and at least one description column.",
    );
  }

  const sampleRows = table.rows.slice(0, COLUMN_MAPPING_SAMPLE_ROWS);
  const confirmed =
    options.columnMapping ?? resolveSavedColumnMapping(account, table.headers);

  if (confirmed) {
    if (!columnMappingFitsHeaders(confirmed, table.headers)) {
      return badRequest(
        "COLUMN_MAPPING_MISMATCH",
        "The column mapping names columns this file does not have. Map the columns again.",
      );
    }

    return stageAndRespond({
      accountId: account.id,
      parsed: parseMappedCsv(table, confirmed),
      reconciliation: null,
      columnMapping: {
        headers: table.headers,
        sampleRows,
        guess: savedColumnMappingGuess(confirmed),
      },
    });
  }

  const guess = await guessColumnMapping({
    headers: table.headers,
    sampleRows: sampleRows.map((row) => row.cells),
  });

  return NextResponse.json({
    mappingRequired: true,
    columnMapping: { headers: table.headers, sampleRows, guess },
  });
}

export async function POST(request: Request) {
  const payload = await parseImportPayload(request);

  if (!payload) {
    return badRequest(
      "INVALID_IMPORT_PAYLOAD",
      "Expected accountId and a CSV or PDF upload via multipart form-data, or accountId and csvContent via JSON payload.",
    );
  }

  if (sourceByteLength(payload.source) > MAX_IMPORT_FILE_BYTES) {
    return NextResponse.json(
      {
        error: "IMPORT_FILE_TOO_LARGE",
        message: "The file is larger than the 10 MB import limit.",
      },
      { status: 413 },
    );
  }

  const accountId = payload.accountId.trim();
  if (!accountId) {
    return badRequest("ACCOUNT_ID_REQUIRED", "An account must be selected.");
  }

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true, csvColumnMapping: true, csvHeaderSignature: true },
  });

  if (!account) {
    return NextResponse.json({ error: "ACCOUNT_NOT_FOUND" }, { status: 404 });
  }

  if (payload.source.kind === "pdf") {
    return parsePdfImport(accountId, payload.source.bytes);
  }

  const csvContent = payload.source.content.trim();
  if (!csvContent) {
    return badRequest(
      "CSV_FILE_REQUIRED",
      "A statement file is required for transaction import.",
    );
  }

  return parseCsvImport({
    account,
    table: readCsvTable(csvContent),
    columnMapping: payload.columnMapping,
  });
}
