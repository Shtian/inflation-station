import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CsvParserResult } from "@/lib/import/csv-parser";
import type {
  ProviderAdapter,
  ProviderAdapterDetectionCandidate,
} from "@/lib/import/provider-adapter/adapter";
import type { ProviderMappingConfigurationError } from "@/lib/import/provider-adapter/mapping-definition";
import { POST } from "./route";

const {
  prismaMock,
  loadProviderAdaptersMock,
  stageParsedImportRowsMock,
  getMessageCleanupSettingsMock,
} = vi.hoisted(() => ({
  prismaMock: {
    account: { findUnique: vi.fn() },
  },
  loadProviderAdaptersMock: vi.fn(),
  stageParsedImportRowsMock: vi.fn(),
  getMessageCleanupSettingsMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/import/provider-adapter/repository", () => ({
  loadProviderAdapters: loadProviderAdaptersMock,
}));

vi.mock("@/lib/import/review-stage", () => ({
  stageParsedImportRows: stageParsedImportRowsMock,
}));

vi.mock("@/lib/import/message-cleanup-settings", () => ({
  getMessageCleanupSettings: getMessageCleanupSettingsMock,
}));

const EMPTY_PARSE_RESULT: CsvParserResult = {
  rows: [],
  errors: [],
  summary: { imported: 0, duplicates: 0, ignoredReserved: 0, invalid: 0 },
};

const STAGED_RESULT = {
  summary: { imported: 1, duplicates: 0, ignoredReserved: 0, invalid: 0 },
  errors: [],
  review: {
    sessionId: "session-1",
    potentialDuplicates: 0,
    messageCleanupUnavailableReason: null,
    rows: [],
  },
};

function createFakeAdapter(options: {
  providerId: string;
  providerName: string;
  score: number;
  requiredMatches: number;
  requiredTotal: number;
  parseResult?: CsvParserResult;
}): ProviderAdapter {
  const candidate: ProviderAdapterDetectionCandidate = {
    providerId: options.providerId,
    providerName: options.providerName,
    requiredMatches: options.requiredMatches,
    requiredTotal: options.requiredTotal,
    patternMatches: 0,
    score: options.score,
    matchedHeaders: [],
  };

  return {
    providerId: options.providerId,
    providerName: options.providerName,
    detect: vi.fn(() => candidate),
    parse: vi.fn(() => options.parseResult ?? EMPTY_PARSE_RESULT),
  };
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/imports/parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const CSV_CONTENT = "Bokføringsdato;Beløp\n01.01.2026;100,00";

describe("POST /api/imports/parse", () => {
  beforeEach(() => {
    prismaMock.account.findUnique.mockReset();
    prismaMock.account.findUnique.mockResolvedValue({ id: "account-1" });

    loadProviderAdaptersMock.mockReset();
    loadProviderAdaptersMock.mockResolvedValue({
      adapters: [],
      configurationErrors: [],
    });

    stageParsedImportRowsMock.mockReset();
    stageParsedImportRowsMock.mockResolvedValue(STAGED_RESULT);

    getMessageCleanupSettingsMock.mockReset();
    getMessageCleanupSettingsMock.mockResolvedValue({
      modelId: undefined,
      prompt: undefined,
      isDefaultModel: true,
      isDefaultPrompt: true,
    });
  });

  it("returns 400 when the payload is missing required fields", async () => {
    const response = await POST(jsonRequest({ accountId: "account-1" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_IMPORT_PAYLOAD",
      message:
        "Expected accountId and CSV content via multipart form-data or JSON payload.",
    });
    expect(loadProviderAdaptersMock).not.toHaveBeenCalled();
  });

  it("returns 400 when accountId is blank", async () => {
    const response = await POST(
      jsonRequest({ accountId: "   ", csvContent: CSV_CONTENT }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "ACCOUNT_ID_REQUIRED",
      message: "An account must be selected.",
    });
  });

  it("returns 404 when the account does not exist", async () => {
    prismaMock.account.findUnique.mockResolvedValue(null);

    const response = await POST(
      jsonRequest({ accountId: "missing-account", csvContent: CSV_CONTENT }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "ACCOUNT_NOT_FOUND",
    });
  });

  it("returns 400 when csvContent is blank", async () => {
    const response = await POST(
      jsonRequest({ accountId: "account-1", csvContent: "   " }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "CSV_FILE_REQUIRED",
      message: "A CSV file is required for transaction import.",
    });
  });

  it("loads adapters exactly once and requires explicit selection when detection is uncertain", async () => {
    const bankA = createFakeAdapter({
      providerId: "bank-a",
      providerName: "Bank A",
      score: 0.5,
      requiredMatches: 1,
      requiredTotal: 2,
    });
    const bankB = createFakeAdapter({
      providerId: "bank-b",
      providerName: "Bank B",
      score: 0.45,
      requiredMatches: 1,
      requiredTotal: 2,
    });
    loadProviderAdaptersMock.mockResolvedValue({
      adapters: [bankA, bankB],
      configurationErrors: [],
    });

    const response = await POST(
      jsonRequest({ accountId: "account-1", csvContent: CSV_CONTENT }),
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("PROVIDER_SELECTION_REQUIRED");
    expect(body.detection.state).toBe("uncertain");
    expect(body.detection.candidates).toHaveLength(2);
    expect(loadProviderAdaptersMock).toHaveBeenCalledTimes(1);
    expect(stageParsedImportRowsMock).not.toHaveBeenCalled();
  });

  it("runs the explicitly selected adapter and stages its parse output", async () => {
    const parseResult: CsvParserResult = {
      rows: [
        {
          bookingDate: "2026-01-01",
          amountNok: 100,
          currency: "NOK",
          sender: "",
          recipient: "",
          name: "Groceries",
          title: "",
          paymentType: "",
        },
      ],
      errors: [],
      summary: { imported: 1, duplicates: 0, ignoredReserved: 0, invalid: 0 },
    };
    const bankA = createFakeAdapter({
      providerId: "bank-a",
      providerName: "Bank A",
      score: 0.5,
      requiredMatches: 1,
      requiredTotal: 2,
    });
    const bankB = createFakeAdapter({
      providerId: "bank-b",
      providerName: "Bank B",
      score: 0.45,
      requiredMatches: 1,
      requiredTotal: 2,
      parseResult,
    });
    loadProviderAdaptersMock.mockResolvedValue({
      adapters: [bankA, bankB],
      configurationErrors: [],
    });

    const response = await POST(
      jsonRequest({
        accountId: "account-1",
        csvContent: CSV_CONTENT,
        providerId: "bank-b",
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.detection).toMatchObject({
      state: "certain",
      providerId: "bank-b",
      providerName: "Bank B",
    });
    expect(body.summary).toEqual(STAGED_RESULT.summary);
    expect(body.errors).toEqual(STAGED_RESULT.errors);
    expect(body.review).toEqual(STAGED_RESULT.review);

    expect(bankA.parse).not.toHaveBeenCalled();
    expect(bankB.parse).toHaveBeenCalledTimes(1);
    expect(stageParsedImportRowsMock).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({
        accountId: "account-1",
        csvContent: CSV_CONTENT,
        parsed: parseResult,
      }),
      expect.anything(),
    );
  });

  it("returns 400 PROVIDER_NOT_FOUND when the selected provider id is unknown", async () => {
    loadProviderAdaptersMock.mockResolvedValue({
      adapters: [],
      configurationErrors: [],
    });

    const response = await POST(
      jsonRequest({
        accountId: "account-1",
        csvContent: CSV_CONTENT,
        providerId: "does-not-exist",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "PROVIDER_NOT_FOUND",
      message: "The selected provider could not be found.",
    });
    expect(stageParsedImportRowsMock).not.toHaveBeenCalled();
  });

  it("returns a stable configuration-error response when the selected provider failed compilation, without falling back", async () => {
    const configurationError: ProviderMappingConfigurationError = {
      code: "UNKNOWN_NORMALIZATION_RULE",
      message: "Unknown normalization rule key(s): encoding.",
      providerName: "Broken Bank",
      details: { providerMappingId: "broken-bank", unknownKeys: ["encoding"] },
    };
    loadProviderAdaptersMock.mockResolvedValue({
      adapters: [],
      configurationErrors: [configurationError],
    });

    const response = await POST(
      jsonRequest({
        accountId: "account-1",
        csvContent: CSV_CONTENT,
        providerId: "broken-bank",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "PROVIDER_MAPPING_CONFIGURATION_ERROR",
      message: configurationError.message,
      code: "UNKNOWN_NORMALIZATION_RULE",
    });
    expect(stageParsedImportRowsMock).not.toHaveBeenCalled();
  });

  it("runs the certain automatic detection match without a second lookup", async () => {
    const parseResult: CsvParserResult = {
      ...EMPTY_PARSE_RESULT,
      summary: { imported: 2, duplicates: 0, ignoredReserved: 0, invalid: 0 },
    };
    const bankA = createFakeAdapter({
      providerId: "bank-a",
      providerName: "Bank A",
      score: 1,
      requiredMatches: 2,
      requiredTotal: 2,
      parseResult,
    });
    loadProviderAdaptersMock.mockResolvedValue({
      adapters: [bankA],
      configurationErrors: [],
    });

    const response = await POST(
      jsonRequest({ accountId: "account-1", csvContent: CSV_CONTENT }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.detection).toMatchObject({
      state: "certain",
      providerId: "bank-a",
      providerName: "Bank A",
    });
    expect(bankA.parse).toHaveBeenCalledTimes(1);
    expect(loadProviderAdaptersMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the built-in parser when no persisted provider is detected", async () => {
    loadProviderAdaptersMock.mockResolvedValue({
      adapters: [],
      configurationErrors: [],
    });

    const response = await POST(
      jsonRequest({ accountId: "account-1", csvContent: CSV_CONTENT }),
    );

    expect(response.status).toBe(200);
    expect(stageParsedImportRowsMock).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({
        accountId: "account-1",
        csvContent: CSV_CONTENT,
        parsed: undefined,
      }),
      expect.anything(),
    );
  });
});
