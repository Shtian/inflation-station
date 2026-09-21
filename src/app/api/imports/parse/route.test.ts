import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CsvParserResult,
  parseNorwegianBankCsv,
} from "@/lib/import/csv-parser";
import type {
  ProviderAdapter,
  ProviderAdapterDetectionCandidate,
} from "@/lib/import/provider-adapter/adapter";
import type { ProviderMappingConfigurationError } from "@/lib/import/provider-adapter/mapping-definition";
import { POST } from "./route";

const { prismaMock, loadProviderAdaptersMock, stageParsedImportRowsMock } =
  vi.hoisted(() => ({
    prismaMock: {
      account: { findUnique: vi.fn() },
    },
    loadProviderAdaptersMock: vi.fn(),
    stageParsedImportRowsMock: vi.fn(),
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

function formRequest(file: {
  bytes: Uint8Array;
  name: string;
  type: string;
}): Request {
  const formData = new FormData();
  formData.set("accountId", "account-1");
  formData.set(
    "file",
    new File([file.bytes as BlobPart], file.name, { type: file.type }),
  );

  return new Request("http://localhost/api/imports/parse", {
    method: "POST",
    body: formData,
  });
}

const FIXTURE_PDF = new URL(
  "../../../../lib/import/pdf/__fixtures__/trumf-2026-09.pdf",
  import.meta.url,
);

function readFixturePdf(): Promise<Uint8Array> {
  return readFile(FIXTURE_PDF).then((bytes) => new Uint8Array(bytes));
}

// pdfjs rejects a PDF without an xref table, so the synthetic cases below need
// a real one rather than a `%PDF-` header over arbitrary bytes.
function syntheticPdf(text: string | null): Uint8Array {
  const content = text === null ? "" : `BT /F1 12 Tf 48 780 Td (${text}) Tj ET`;
  const bodies = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [index, body] of bodies.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }

  const startxref = pdf.length;
  pdf += `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<</Size ${bodies.length + 1}/Root 1 0 R>>\nstartxref\n${startxref}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
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

    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MESSAGE_CLEANUP_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 400 when the payload is missing required fields", async () => {
    const response = await POST(jsonRequest({ accountId: "account-1" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_IMPORT_PAYLOAD",
      message:
        "Expected accountId and a CSV or PDF upload via multipart form-data, or accountId and csvContent via JSON payload.",
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
      message: "A statement file is required for transaction import.",
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
    expect(body.reconciliation).toBeNull();
    expect(body.cleanup).toEqual({
      status: "planned",
      sessionId: STAGED_RESULT.review.sessionId,
      chunks: [],
    });

    expect(bankA.parse).not.toHaveBeenCalled();
    expect(bankB.parse).toHaveBeenCalledTimes(1);
    expect(stageParsedImportRowsMock).toHaveBeenCalledWith(prismaMock, {
      accountId: "account-1",
      parsed: parseResult,
    });
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
    expect(stageParsedImportRowsMock).toHaveBeenCalledWith(prismaMock, {
      accountId: "account-1",
      parsed: parseNorwegianBankCsv(CSV_CONTENT),
    });
  });

  it("issues no OpenAI request and returns a planned cleanup chunk per row", async () => {
    stageParsedImportRowsMock.mockResolvedValue({
      ...STAGED_RESULT,
      review: {
        ...STAGED_RESULT.review,
        rows: [
          {
            id: "row-1",
            rowNumber: 2,
            bookingDate: "2026-01-01",
            amountNok: -100,
            currency: "NOK",
            normalizedMerchant: "joker",
            paymentType: "CARD",
            sender: "",
            recipient: "",
            name: "Joker",
            title: "Oslo",
            categoryId: null,
            potentialDuplicate: false,
          },
        ],
      },
    });

    const response = await POST(
      jsonRequest({ accountId: "account-1", csvContent: CSV_CONTENT }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.cleanup).toEqual({
      status: "planned",
      sessionId: "session-1",
      chunks: [{ index: 0, rowIds: ["row-1"] }],
    });
  });

  it("returns cleanup unavailable with key_missing when OPENAI_API_KEY is unset", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const response = await POST(
      jsonRequest({ accountId: "account-1", csvContent: CSV_CONTENT }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.cleanup).toEqual({
      status: "unavailable",
      reason: "key_missing",
      rowIds: [],
    });
  });

  it("returns cleanup unavailable with disabled when OPENAI_MESSAGE_CLEANUP_ENABLED is false", async () => {
    vi.stubEnv("OPENAI_MESSAGE_CLEANUP_ENABLED", "false");

    const response = await POST(
      jsonRequest({ accountId: "account-1", csvContent: CSV_CONTENT }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.cleanup).toEqual({
      status: "unavailable",
      reason: "disabled",
      rowIds: [],
    });
  });

  it("returns 413 when a CSV upload exceeds the 10 MB limit", async () => {
    const response = await POST(
      formRequest({
        bytes: new Uint8Array(10 * 1024 * 1024 + 1).fill(0x61),
        name: "transactions.csv",
        type: "text/csv",
      }),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: "IMPORT_FILE_TOO_LARGE",
      message: "The file is larger than the 10 MB import limit.",
    });
    expect(stageParsedImportRowsMock).not.toHaveBeenCalled();
  });

  it("stages a PDF statement's rows and reports its reconciliation drift", async () => {
    const response = await POST(
      formRequest({
        bytes: await readFixturePdf(),
        name: "trumf-2026-09.pdf",
        type: "application/pdf",
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.detection).toEqual({
      state: "certain",
      providerId: "trumf",
      providerName: "Trumf Kredittkort",
      score: 1,
      matchedHeaders: [],
      candidates: [],
    });
    expect(body.reconciliation).toEqual({
      openingNok: -10000,
      movementNok: 8907.94,
      closingNok: -1092.06,
      driftNok: 0,
    });
    expect(body.summary).toEqual(STAGED_RESULT.summary);
    expect(body.cleanup).toEqual({
      status: "planned",
      sessionId: "session-1",
      chunks: [],
    });

    const [, staged] = stageParsedImportRowsMock.mock.calls[0];
    expect(staged.accountId).toBe("account-1");
    expect(staged.parsed.rows).toHaveLength(39);
    expect(staged.parsed.rows[0]).toEqual({
      bookingDate: "17.08.2026",
      amountNok: 49595.55,
      currency: "NOK",
      sender: "",
      recipient: "",
      name: "",
      title: "NORDVIK 101 Testveien TESTBY",
      paymentType: "Kort",
    });
    expect(loadProviderAdaptersMock).not.toHaveBeenCalled();
  });

  it("reads the upload kind from its leading bytes, not its mime type or filename", async () => {
    const pdfClaimingCsv = await POST(
      formRequest({
        bytes: await readFixturePdf(),
        name: "transactions.csv",
        type: "text/csv",
      }),
    );

    expect(pdfClaimingCsv.status).toBe(200);
    expect((await pdfClaimingCsv.json()).detection.providerId).toBe("trumf");
    expect(loadProviderAdaptersMock).not.toHaveBeenCalled();

    const csvClaimingPdf = await POST(
      formRequest({
        bytes: new TextEncoder().encode(CSV_CONTENT),
        name: "statement.pdf",
        type: "application/pdf",
      }),
    );

    expect(csvClaimingPdf.status).toBe(200);
    expect((await csvClaimingPdf.json()).reconciliation).toBeNull();
    expect(loadProviderAdaptersMock).toHaveBeenCalledTimes(1);
  });

  it("returns 400 PDF_TEXT_EXTRACTION_FAILED when the PDF carries no text layer", async () => {
    const response = await POST(
      formRequest({
        bytes: syntheticPdf(null),
        name: "scanned.pdf",
        type: "application/pdf",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "PDF_TEXT_EXTRACTION_FAILED",
      message:
        "No text could be read from this PDF. A scanned or photographed statement carries only an image, so ask your provider for the PDF they generated.",
    });
    expect(stageParsedImportRowsMock).not.toHaveBeenCalled();
  });

  it("returns 400 PDF_TEXT_EXTRACTION_FAILED when the PDF cannot be opened at all", async () => {
    const response = await POST(
      formRequest({
        bytes: new TextEncoder().encode("%PDF-1.7\ntruncated"),
        name: "broken.pdf",
        type: "application/pdf",
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("PDF_TEXT_EXTRACTION_FAILED");
    expect(stageParsedImportRowsMock).not.toHaveBeenCalled();
  });

  it("returns 400 PDF_PROVIDER_NOT_RECOGNIZED for an issuer no extractor claims", async () => {
    const response = await POST(
      formRequest({
        bytes: syntheticPdf("Some other bank AS"),
        name: "other-bank.pdf",
        type: "application/pdf",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "PDF_PROVIDER_NOT_RECOGNIZED",
      message:
        "No supported card issuer was found in this PDF. Supported: Trumf Kredittkort, SAS Amex Premium.",
    });
    expect(stageParsedImportRowsMock).not.toHaveBeenCalled();
  });

  it("returns 400 PDF_NO_TRANSACTIONS_FOUND when the matched extractor finds no rows", async () => {
    const response = await POST(
      formRequest({
        bytes: syntheticPdf("NorgesGruppen Finans AS"),
        name: "empty-trumf.pdf",
        type: "application/pdf",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "PDF_NO_TRANSACTIONS_FOUND",
      message:
        "This PDF was read as a Trumf Kredittkort statement but holds no transactions.",
    });
    expect(stageParsedImportRowsMock).not.toHaveBeenCalled();
  });
});
