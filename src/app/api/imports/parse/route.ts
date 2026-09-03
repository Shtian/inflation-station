import { NextResponse } from "next/server";
import { parseNorwegianBankCsv } from "@/lib/import/csv-parser";
import { getMessageCleanupSettings } from "@/lib/import/message-cleanup-settings";
import type { ProviderAdapter } from "@/lib/import/provider-adapter/adapter";
import { createCsvStatement } from "@/lib/import/provider-adapter/csv-statement";
import { detectProviderFromAdapters } from "@/lib/import/provider-adapter/detection";
import { loadProviderAdapters } from "@/lib/import/provider-adapter/repository";
import { stageParsedImportRows } from "@/lib/import/review-stage";
import { prisma } from "@/lib/prisma";

type ParseImportPayload = {
  accountId: string;
  csvContent: string;
  providerId: string | null;
};

function badRequest(error: string, message: string) {
  return NextResponse.json({ error, message }, { status: 400 });
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

    let csvContent: string | null = null;

    if (file instanceof File) {
      csvContent = await file.text();
    } else if (typeof file === "string") {
      csvContent = file;
    } else {
      const content = formData.get("csvContent");
      csvContent = typeof content === "string" ? content : null;
    }

    if (csvContent === null) {
      return null;
    }

    return {
      accountId,
      csvContent,
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
    csvContent: payload.csvContent,
    providerId,
  };
}

export async function POST(request: Request) {
  const payload = await parseImportPayload(request);

  if (!payload) {
    return badRequest(
      "INVALID_IMPORT_PAYLOAD",
      "Expected accountId and CSV content via multipart form-data or JSON payload.",
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

  const csvContent = payload.csvContent.trim();
  if (!csvContent) {
    return badRequest(
      "CSV_FILE_REQUIRED",
      "A CSV file is required for transaction import.",
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

  const messageCleanupSettings = await getMessageCleanupSettings(prisma);
  const parsed = selectedAdapter
    ? selectedAdapter.parse(statement)
    : parseNorwegianBankCsv(csvContent);

  const staged = await stageParsedImportRows(
    prisma,
    {
      accountId,
      parsed,
    },
    {
      openAiCleanupModel: messageCleanupSettings.modelId,
      openAiCleanupSystemPrompt: messageCleanupSettings.prompt,
      openAiCleanupEnabled:
        process.env.OPENAI_MESSAGE_CLEANUP_ENABLED?.trim().toLowerCase() !==
        "false",
      openAiApiKey: process.env.OPENAI_API_KEY,
    },
  );

  return NextResponse.json({
    detection,
    summary: staged.summary,
    errors: staged.errors,
    review: staged.review,
  });
}
