import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ColumnMapping } from "@/lib/import/csv/column-mapping";
import { POST } from "./route";

const { prismaMock, stageParsedImportRowsMock } = vi.hoisted(() => ({
  prismaMock: {
    account: { findUnique: vi.fn() },
  },
  stageParsedImportRowsMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/import/review-stage", () => ({
  stageParsedImportRows: stageParsedImportRowsMock,
}));

const STAGED_RESULT = {
  summary: { imported: 1, duplicates: 0, ignoredReserved: 0, invalid: 0 },
  errors: [],
  review: {
    sessionId: "session-1",
    potentialDuplicates: 0,
    rows: [],
  },
};

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/imports/parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function formRequest(
  file: {
    bytes: Uint8Array;
    name: string;
    type: string;
  },
  fields: Record<string, string> = {},
): Request {
  const formData = new FormData();
  formData.set("accountId", "account-1");
  for (const [name, value] of Object.entries(fields)) {
    formData.set(name, value);
  }
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

const CSV_CONTENT = [
  "Bokføringsdato;Beløp;Tittel;Betalingstype",
  "01.01.2026;-100,00;Rema 1000;Kort",
  "Reservert;-20,00;Kiwi;Kort",
].join("\n");

const CSV_HEADER_SIGNATURE = "bokforingsdato|belop|tittel|betalingstype";

const CSV_MAPPING: ColumnMapping = {
  date: { index: 0, header: "Bokføringsdato" },
  amount: { kind: "signed", column: { index: 1, header: "Beløp" } },
  description: [{ index: 2, header: "Tittel" }],
  paymentType: { index: 3, header: "Betalingstype" },
};

const ACCOUNT_WITHOUT_MAPPING = {
  id: "account-1",
  csvColumnMapping: null,
  csvHeaderSignature: null,
};

describe("POST /api/imports/parse", () => {
  beforeEach(() => {
    prismaMock.account.findUnique.mockReset();
    prismaMock.account.findUnique.mockResolvedValue(ACCOUNT_WITHOUT_MAPPING);

    stageParsedImportRowsMock.mockReset();
    stageParsedImportRowsMock.mockResolvedValue(STAGED_RESULT);

    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MESSAGE_CLEANUP_ENABLED", "true");
    vi.stubEnv("TYPESAFE_API_KEY", "");
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
    expect(prismaMock.account.findUnique).not.toHaveBeenCalled();
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

  it("returns 400 CSV_HEADERS_NOT_FOUND when no line names the columns", async () => {
    const response = await POST(
      jsonRequest({ accountId: "account-1", csvContent: "01.01.2026;100,00" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "CSV_HEADERS_NOT_FOUND",
      message:
        "No header row was found in this CSV. The first non-blank line must name its columns.",
    });
  });

  it("returns the headers, sample rows and a guessed mapping when the account has no saved mapping", async () => {
    const response = await POST(
      jsonRequest({ accountId: "account-1", csvContent: CSV_CONTENT }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      mappingRequired: true,
      columnMapping: {
        headers: ["Bokføringsdato", "Beløp", "Tittel", "Betalingstype"],
        sampleRows: [
          {
            sourceRowNumber: 2,
            cells: ["01.01.2026", "-100,00", "Rema 1000", "Kort"],
          },
          {
            sourceRowNumber: 3,
            cells: ["Reservert", "-20,00", "Kiwi", "Kort"],
          },
        ],
        guess: {
          mapping: {
            date: { index: 0, header: "Bokføringsdato" },
            amount: {
              kind: "signed",
              column: { index: 1, header: "Beløp" },
            },
            description: [{ index: 2, header: "Tittel" }],
            paymentType: { index: 3, header: "Betalingstype" },
          },
          sources: {
            date: "heuristic",
            amount: "heuristic",
            description: "heuristic",
            paymentType: "heuristic",
          },
        },
      },
    });
    expect(stageParsedImportRowsMock).not.toHaveBeenCalled();
  });

  it("stages straight away with the account's saved mapping when the headers match", async () => {
    prismaMock.account.findUnique.mockResolvedValue({
      id: "account-1",
      csvColumnMapping: CSV_MAPPING,
      csvHeaderSignature: CSV_HEADER_SIGNATURE,
    });

    const response = await POST(
      jsonRequest({ accountId: "account-1", csvContent: CSV_CONTENT }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mappingRequired).toBeUndefined();
    expect(body.review).toEqual(STAGED_RESULT.review);
    expect(body.columnMapping.guess.sources).toEqual({
      date: "saved",
      amount: "saved",
      description: "saved",
      paymentType: "saved",
    });
    expect(stageParsedImportRowsMock).toHaveBeenCalledWith(prismaMock, {
      accountId: "account-1",
      parsed: {
        rows: [
          {
            bookingDate: "2026-01-01",
            amountNok: -100,
            currency: "NOK",
            sender: "",
            recipient: "",
            name: "",
            title: "Rema 1000",
            paymentType: "Kort",
          },
        ],
        errors: [],
        summary: {
          imported: 1,
          duplicates: 0,
          ignoredReserved: 1,
          invalid: 0,
        },
      },
    });
  });

  it("asks for a mapping when the saved one was confirmed on different headers", async () => {
    prismaMock.account.findUnique.mockResolvedValue({
      id: "account-1",
      csvColumnMapping: CSV_MAPPING,
      csvHeaderSignature: "dato|forklaring|rentedato|utfrakonto|innpakonto",
    });

    const response = await POST(
      jsonRequest({ accountId: "account-1", csvContent: CSV_CONTENT }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).mappingRequired).toBe(true);
    expect(stageParsedImportRowsMock).not.toHaveBeenCalled();
  });

  it("stages with a confirmed mapping sent alongside the uploaded file", async () => {
    const descriptionAndType: ColumnMapping = {
      ...CSV_MAPPING,
      description: [
        { index: 2, header: "Tittel" },
        { index: 3, header: "Betalingstype" },
      ],
    };

    const response = await POST(
      formRequest(
        {
          bytes: new TextEncoder().encode(CSV_CONTENT),
          name: "transactions.csv",
          type: "text/csv",
        },
        { columnMapping: JSON.stringify(descriptionAndType) },
      ),
    );

    expect(response.status).toBe(200);
    const [, staged] = stageParsedImportRowsMock.mock.calls[0];
    expect(
      staged.parsed.rows.map((row: { title: string }) => row.title),
    ).toEqual(["Rema 1000 Kort"]);
  });

  it("returns 400 INVALID_COLUMN_MAPPING for a malformed confirmed mapping", async () => {
    const response = await POST(
      jsonRequest({
        accountId: "account-1",
        csvContent: CSV_CONTENT,
        columnMapping: { ...CSV_MAPPING, description: [] },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_COLUMN_MAPPING",
      message:
        "The column mapping must name a date column, an amount and at least one description column.",
    });
    expect(stageParsedImportRowsMock).not.toHaveBeenCalled();
  });

  it("returns 400 COLUMN_MAPPING_MISMATCH when the mapping names columns the file lacks", async () => {
    const response = await POST(
      jsonRequest({
        accountId: "account-1",
        csvContent: CSV_CONTENT,
        columnMapping: {
          ...CSV_MAPPING,
          description: [{ index: 2, header: "Forklaring" }],
        },
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("COLUMN_MAPPING_MISMATCH");
    expect(stageParsedImportRowsMock).not.toHaveBeenCalled();
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
      jsonRequest({
        accountId: "account-1",
        csvContent: CSV_CONTENT,
        columnMapping: CSV_MAPPING,
      }),
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
      jsonRequest({
        accountId: "account-1",
        csvContent: CSV_CONTENT,
        columnMapping: CSV_MAPPING,
      }),
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
      jsonRequest({
        accountId: "account-1",
        csvContent: CSV_CONTENT,
        columnMapping: CSV_MAPPING,
      }),
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

    const csvClaimingPdf = await POST(
      formRequest({
        bytes: new TextEncoder().encode(CSV_CONTENT),
        name: "statement.pdf",
        type: "application/pdf",
      }),
    );

    expect(csvClaimingPdf.status).toBe(200);
    expect((await csvClaimingPdf.json()).mappingRequired).toBe(true);
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
