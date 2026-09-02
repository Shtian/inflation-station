import { NextResponse } from "next/server";
import { getMessageCleanupSettings } from "@/lib/import/message-cleanup-settings";
import {
  builtInProviderAdapter,
  detectProvider,
  loadProviderAdapters,
} from "@/lib/import/provider-adapter";
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

  // Load and compile every persisted provider mapping once, at the
  // repository seam, so detection and parsing run against the same compiled
  // adapters instead of re-querying and re-interpreting raw JSON per phase.
  const { adapters, compilationFailures } = await loadProviderAdapters(prisma);
  const detectedProvider = detectProvider(csvContent, adapters);
  let detection = detectedProvider;
  let selectedAdapter = adapters.find(
    (adapter) => adapter.id === detection.providerId,
  );

  if (payload.providerId) {
    selectedAdapter = adapters.find(
      (adapter) => adapter.id === payload.providerId,
    );

    if (!selectedAdapter) {
      const invalidMapping = compilationFailures.find(
        (failure) => failure.providerId === payload.providerId,
      );

      if (invalidMapping) {
        // Mapping configuration failures return a stable diagnostic; an
        // explicitly selected provider that fails compilation is never
        // silently swapped for another adapter.
        return NextResponse.json(
          {
            error: "PROVIDER_MAPPING_INVALID",
            message: invalidMapping.message,
            code: invalidMapping.code,
          },
          { status: 422 },
        );
      }

      return badRequest(
        "PROVIDER_NOT_FOUND",
        "The selected provider could not be found.",
      );
    }

    const selectedCandidate = detectedProvider.candidates.find(
      (candidate) => candidate.providerId === selectedAdapter?.id,
    );

    detection = {
      ...detectedProvider,
      state: "certain",
      providerId: selectedAdapter.id,
      providerName: selectedAdapter.providerName,
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

  // No persisted provider matched at all: fall back to the built-in
  // Norwegian bank adapter, itself compiled behind the same interface.
  const activeAdapter = selectedAdapter ?? builtInProviderAdapter;

  const messageCleanupSettings = await getMessageCleanupSettings(prisma);

  const staged = await stageParsedImportRows(
    prisma,
    {
      accountId,
      csvContent,
      adapter: activeAdapter,
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
