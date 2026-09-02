import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { prismaMock, stageParsedImportRowsMock, getMessageCleanupSettingsMock } =
  vi.hoisted(() => ({
    prismaMock: {
      account: {
        findUnique: vi.fn(),
      },
      importProviderMapping: {
        findMany: vi.fn(),
      },
    },
    stageParsedImportRowsMock: vi.fn(),
    getMessageCleanupSettingsMock: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/import/review-stage", () => ({
  stageParsedImportRows: stageParsedImportRowsMock,
}));
vi.mock("@/lib/import/message-cleanup-settings", () => ({
  getMessageCleanupSettings: getMessageCleanupSettingsMock,
}));

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/imports/parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const stagedResult = {
  summary: { imported: 1, duplicates: 0, ignoredReserved: 0, invalid: 0 },
  errors: [],
  review: {
    sessionId: "session-1",
    potentialDuplicates: 0,
    messageCleanupUnavailableReason: null,
    rows: [],
  },
};

describe("POST /api/imports/parse", () => {
  beforeEach(() => {
    prismaMock.account.findUnique.mockReset();
    prismaMock.importProviderMapping.findMany.mockReset();
    stageParsedImportRowsMock.mockReset();
    getMessageCleanupSettingsMock.mockReset();

    prismaMock.account.findUnique.mockResolvedValue({ id: "account-1" });
    getMessageCleanupSettingsMock.mockResolvedValue({
      modelId: undefined,
      prompt: undefined,
    });
    stageParsedImportRowsMock.mockResolvedValue(stagedResult);
  });

  it("rejects a payload missing accountId or csvContent", async () => {
    const response = await POST(jsonRequest({ csvContent: "a;b" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "INVALID_IMPORT_PAYLOAD",
    });
  });

  it("returns 404 when the account does not exist", async () => {
    prismaMock.account.findUnique.mockResolvedValue(null);

    const response = await POST(
      jsonRequest({ accountId: "missing", csvContent: "Dato;Beløp\n1;2" }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "ACCOUNT_NOT_FOUND",
    });
  });

  it("requires explicit provider selection when detection is uncertain with candidates", async () => {
    prismaMock.importProviderMapping.findMany.mockResolvedValue([
      {
        id: "provider-1",
        providerName: "Bank A",
        mappingVersion: 1,
        normalizationRules: {
          requiredHeaders: ["Dato", "Beløp", "Ekstra"],
        },
        fieldMappings: [
          { sourceField: "Dato", canonicalField: "bookingDate" },
          { sourceField: "Beløp", canonicalField: "amount" },
          { sourceField: "Tittel", canonicalField: "title" },
        ],
      },
    ]);

    const response = await POST(
      jsonRequest({
        accountId: "account-1",
        csvContent: "Dato;Beløp\n2026-01-01;100,00",
      }),
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("PROVIDER_SELECTION_REQUIRED");
    expect(stageParsedImportRowsMock).not.toHaveBeenCalled();
  });

  it("stages rows with the built-in adapter when no provider mapping matches", async () => {
    prismaMock.importProviderMapping.findMany.mockResolvedValue([]);

    const response = await POST(
      jsonRequest({
        accountId: "account-1",
        csvContent:
          "Bokføringsdato;Beløp;Avsender;Mottaker;Navn;Tittel;Valuta;Betalingstype\n01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort",
      }),
    );

    expect(response.status).toBe(200);
    expect(stageParsedImportRowsMock).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({
        accountId: "account-1",
        adapter: expect.objectContaining({ id: "built-in-norwegian" }),
      }),
      expect.anything(),
    );
  });

  it("honors an explicit provider override and stages with that provider's compiled adapter", async () => {
    prismaMock.importProviderMapping.findMany.mockResolvedValue([
      {
        id: "provider-1",
        providerName: "Bank A",
        mappingVersion: 1,
        normalizationRules: {},
        fieldMappings: [
          { sourceField: "Dato", canonicalField: "bookingDate" },
          { sourceField: "Beløp", canonicalField: "amount" },
          { sourceField: "Tittel", canonicalField: "title" },
        ],
      },
    ]);

    const response = await POST(
      jsonRequest({
        accountId: "account-1",
        providerId: "provider-1",
        csvContent: "Dato;Beløp;Tittel\n2026-01-01;100,00;Rent",
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.detection.state).toBe("certain");
    expect(body.detection.providerId).toBe("provider-1");
    expect(stageParsedImportRowsMock).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({
        adapter: expect.objectContaining({ id: "provider-1" }),
      }),
      expect.anything(),
    );
  });

  it("returns PROVIDER_NOT_FOUND when the selected provider id does not exist", async () => {
    prismaMock.importProviderMapping.findMany.mockResolvedValue([]);

    const response = await POST(
      jsonRequest({
        accountId: "account-1",
        providerId: "missing-provider",
        csvContent: "Dato;Beløp\n2026-01-01;100,00",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "PROVIDER_NOT_FOUND",
    });
  });

  it("returns a stable PROVIDER_MAPPING_INVALID diagnostic for an explicitly selected but unusable mapping", async () => {
    prismaMock.importProviderMapping.findMany.mockResolvedValue([
      {
        id: "provider-1",
        providerName: "Bank A",
        mappingVersion: 1,
        normalizationRules: { encoding: "UTF-8" },
        fieldMappings: [
          { sourceField: "Dato", canonicalField: "bookingDate" },
          { sourceField: "Beløp", canonicalField: "amount" },
          { sourceField: "Tittel", canonicalField: "title" },
        ],
      },
    ]);

    const response = await POST(
      jsonRequest({
        accountId: "account-1",
        providerId: "provider-1",
        csvContent: "Dato;Beløp\n2026-01-01;100,00",
      }),
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toBe("PROVIDER_MAPPING_INVALID");
    expect(body.code).toBe("INVALID_NORMALIZATION_RULES");
    expect(stageParsedImportRowsMock).not.toHaveBeenCalled();
  });

  it("serializes the staged summary, errors, and review in the response", async () => {
    prismaMock.importProviderMapping.findMany.mockResolvedValue([]);

    const response = await POST(
      jsonRequest({
        accountId: "account-1",
        csvContent:
          "Bokføringsdato;Beløp;Avsender;Mottaker;Navn;Tittel;Valuta;Betalingstype\n01.01.2026;100,00;Alice;Shop A;Groceries;Friday;NOK;Kort",
      }),
    );

    const body = await response.json();
    expect(body.summary).toEqual(stagedResult.summary);
    expect(body.errors).toEqual(stagedResult.errors);
    expect(body.review).toEqual(stagedResult.review);
  });
});
