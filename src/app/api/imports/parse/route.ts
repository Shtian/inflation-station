import { NextResponse } from "next/server";
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
import type { ProviderAdapter } from "@/lib/import/provider-adapter/adapter";
import { createBuiltInNorwegianAdapter } from "@/lib/import/provider-adapter/built-in-norwegian";
import { createCsvStatement } from "@/lib/import/provider-adapter/csv-statement";
import {
  detectProviderFromAdapters,
  type ProviderDetectionResult,
} from "@/lib/import/provider-adapter/detection";
import { loadProviderAdapters } from "@/lib/import/provider-adapter/repository";
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
  providerId: string | null;
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
    const providerIdValue = formData.get("providerId");
    const providerId =
      typeof providerIdValue === "string" && providerIdValue.trim().length > 0
        ? providerIdValue.trim()
        : null;

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
      providerId,
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

  const providerId =
    typeof payload.providerId === "string" &&
    payload.providerId.trim().length > 0
      ? payload.providerId.trim()
      : null;

  return {
    accountId: payload.accountId,
    source: { kind: "csv", content: payload.csvContent },
    providerId,
  };
}

async function stageAndRespond(options: {
  accountId: string;
  detection: ProviderDetectionResult;
  parsed: CsvParserResult;
  reconciliation: StatementReconciliation | null;
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
    detection: options.detection,
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
    // PDF detection matches an issuer letterhead or it fails, so there is no
    // uncertain state to hand back for the provider-selection dialog.
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
    select: { id: true },
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

  const { adapters, configurationErrors } = await loadProviderAdapters(prisma);
  const statement = createCsvStatement(csvContent);
  const detectedProvider = detectProviderFromAdapters(adapters, statement);
  let detection = detectedProvider;
  let selectedAdapter: ProviderAdapter | null = null;

  if (payload.providerId) {
    const selectedProviderId = payload.providerId;
    const adapter = adapters.find(
      (candidate) => candidate.providerId === selectedProviderId,
    );

    if (!adapter) {
      const configurationError = configurationErrors.find(
        (error) => error.details?.providerMappingId === selectedProviderId,
      );

      if (configurationError) {
        return NextResponse.json(
          {
            error: "PROVIDER_MAPPING_CONFIGURATION_ERROR",
            message: configurationError.message,
            code: configurationError.code,
          },
          { status: 400 },
        );
      }

      return badRequest(
        "PROVIDER_NOT_FOUND",
        "The selected provider could not be found.",
      );
    }

    selectedAdapter = adapter;
    const selectedCandidate = detectedProvider.candidates.find(
      (candidate) => candidate.providerId === adapter.providerId,
    );

    detection = {
      ...detectedProvider,
      state: "certain",
      providerId: adapter.providerId,
      providerName: adapter.providerName,
      score: selectedCandidate?.score ?? detectedProvider.score,
    };
  } else if (detection.state !== "certain" && detection.candidates.length > 0) {
    return NextResponse.json(
      {
        error: "PROVIDER_SELECTION_REQUIRED",
        message:
          "Provider detection is uncertain. Select a provider and parse again.",
        detection,
      },
      { status: 409 },
    );
  }

  if (!selectedAdapter && detection.providerId) {
    selectedAdapter =
      adapters.find(
        (candidate) => candidate.providerId === detection.providerId,
      ) ?? null;
  }

  const adapter = selectedAdapter ?? createBuiltInNorwegianAdapter();

  return stageAndRespond({
    accountId,
    detection,
    parsed: adapter.parse(statement),
    reconciliation: null,
  });
}
